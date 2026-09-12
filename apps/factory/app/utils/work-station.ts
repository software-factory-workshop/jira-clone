import { z } from "zod";
import type { EveMessageData, MessageStreamEvent } from "eve/client";

export const stationSessionSchema = z.object({ sessionId: z.string().regex(/^wrun_[A-Za-z0-9_-]+$/), execution: z.enum(["owner", "dispatcher"]).optional(), ownerSessionId: z.string().optional(), deliveryId: z.string().min(1).optional(), operationId: z.string().uuid().optional() });
export const stationLinkSchema = z.object({ station: z.enum(["worker", "reviewer"]), run: z.string().regex(/^wrun_[A-Za-z0-9_-]+$/), execution: z.enum(["owner", "dispatcher"]).optional(), deliveryId: z.string().min(1).max(200).optional(), operationId: z.string().uuid().optional() });
export type StationLink = z.infer<typeof stationLinkSchema>;
export type StationKind = z.infer<typeof stationLinkSchema>["station"];

export function parsePullRequest(value: string): number | undefined {
  const text = value.trim();
  const number = /^\d+$/.test(text) ? Number(text) : undefined;
  if (number && Number.isSafeInteger(number)) return number;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return undefined;
    const match = /^\/software-factory-workshop\/jira-clone\/pull\/(\d+)\/?$/.exec(url.pathname);
    const parsed = Number(match?.[1]);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
  } catch { return undefined; }
}

const sha = z.string().regex(/^[a-f0-9]{40}$/);
const prUrl = z.string().refine(value => parsePullRequest(value) !== undefined && value.startsWith("https://"));
const command = z.object({ command: z.string(), exitCode: z.number(), stdout: z.string(), stderr: z.string(), truncated: z.boolean().optional() });
const workerResult = z.object({ station: z.literal("worker"), operationId: z.string().uuid().optional(), sessionId: z.string(), revision: sha, summary: z.string(), publication: z.object({ branch: z.string(), number: z.number().int().positive(), url: prUrl, headSha: sha, baseSha: sha, ownerSessionId: z.string().optional(), targetBranch: z.string().optional(), targetHeadSha: sha.optional(), parentPrNumber: z.number().int().positive().optional() }), commands: z.array(command) });
const reviewerResult = z.object({ station: z.literal("reviewer"), sessionId: z.string(), prNumber: z.number().int().positive(), url: prUrl, baseSha: sha, headSha: sha, verdict: z.enum(["approve", "changes_requested", "incomplete"]), summary: z.string(), findings: z.array(z.object({ severity: z.enum(["blocking", "nonblocking"]), path: z.string(), line: z.number().int().positive().optional(), message: z.string(), evidence: z.string() })), commands: z.array(command), limitations: z.array(z.string()), capturedAt: z.string() });
export function parseStationResult(value: unknown, operationId?: string) {
  const parsed = z.discriminatedUnion("station", [workerResult, reviewerResult]).safeParse(value);
  if (!parsed.success) return undefined;
  if (operationId && (parsed.data.station !== "worker" || parsed.data.operationId !== operationId)) return undefined;
  return parsed.data;
}

export function dispatchedTask(value: unknown): string | undefined {
  const parsed = z.object({ status: z.literal("working"), taskId: z.string().min(1) }).safeParse(value);
  return parsed.success ? parsed.data.taskId : undefined;
}

export function pendingStationRequests(data: EveMessageData, hasRecordedResult = false) {
  // A child can resume outside its parent, leaving proxied requests unresolved
  // in the parent projection. Only a recorded result supersedes those requests.
  if (hasRecordedResult) return [];
  return data.messages.flatMap(message => message.parts).flatMap(part => part.type === "dynamic-tool" && part.state === "approval-requested" && part.toolMetadata?.eve?.inputRequest ? [part.toolMetadata.eve.inputRequest] : []);
}

// The last turn boundary wins: cancellation of an earlier turn is not a stopped
// session after a steer or continuation starts a new turn.
export function latestStationTurn(events: readonly { type: string }[]) {
  for (const event of [...events].reverse()) {
    if (event.type === "turn.cancelled") return "cancelled";
    if (["turn.failed", "session.failed"].includes(event.type)) return "failed";
    if (event.type === "turn.completed") return "completed";
    if (["turn.started", "step.started", "message.received"].includes(event.type)) return "running";
  }
  return "unknown";
}

// Eve's Vue entry is browser-bundled; its generic client entry contains Node
// package aliases that conflict with Nuxt's #shared alias. Follow the public
// same-origin NDJSON route and keep Eve's Vue reducer for message projection.
export async function* readStationStream(sessionId: string, signal: AbortSignal): AsyncGenerator<MessageStreamEvent> {
  const response = await fetch(`/eve/v1/session/${encodeURIComponent(sessionId)}/stream?startIndex=0`, { cache: "no-store", signal });
  if (!response.ok || !response.body) throw new Error("Station stream is unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      if (chunk.done && buffer.trim()) { lines.push(buffer); buffer = ""; }
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (!event || typeof event.type !== "string" || !event.data || typeof event.data !== "object") throw new Error("Invalid station event");
        yield event;
      }
      if (chunk.done) break;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export type WorkMode = "create" | "revise" | "contribute";
export function workerRequest(mode: WorkMode, draft: { title: string; brief: string }, pr: string) {
  const brief = draft.brief.trim();
  if (!brief) throw new Error("Write the requested change in the brief above.");
  const prNumber = mode === "create" ? undefined : parsePullRequest(pr);
  if (mode !== "create" && !prNumber) throw new Error("Enter a PR number or a jira-clone GitHub pull-request URL.");
  if (mode === "revise") return { path: "/factory/stations/revisions", body: { prNumber, brief } };
  const title = draft.title.trim();
  if (!title) throw new Error("Add a title to the draft above.");
  return { path: "/factory/stations/worker", body: { title, brief, ...(mode === "contribute" ? { parentPrNumber: prNumber } : {}) } };
}

export function stationLaunchError(value: unknown) {
  const parsed = z.object({ data: z.object({ error: z.object({ code: z.string(), message: z.string() }) }) }).safeParse(value);
  if (!parsed.success) return "The station could not start. Your draft is unchanged; check access and try again.";
  const messages: Record<string, string> = {
    owner_unavailable: "The existing branch owner is unavailable. No replacement took control. You can explicitly choose a separate child PR instead.",
    ownership_unverified: "The PR’s branch ownership could not be verified. No worker was assigned to that branch.",
    stale_head: "The PR head changed. Refresh the PR and review its latest changes before retrying.",
    invalid_request: "The request is invalid. Check the PR and draft details before retrying.",
  };
  return messages[parsed.data.data.error.code] || "The station could not start. Your draft is unchanged; check access and try again.";
}

export function matchesStationDelivery(event: Pick<MessageStreamEvent, "meta">, deliveryId: string, started: boolean) {
  return event.meta?.deliveryIds?.includes(deliveryId) === true || (started && event.meta?.deliveryIds === undefined);
}
