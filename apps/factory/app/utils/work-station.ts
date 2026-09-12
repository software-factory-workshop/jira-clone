import { z } from "zod";
import type { EveMessageData, MessageStreamEvent } from "eve/client";

export const stationSessionSchema = z.object({ sessionId: z.string().regex(/^wrun_[A-Za-z0-9_-]+$/) });
export const stationLinkSchema = z.object({ station: z.enum(["worker", "reviewer"]), run: z.string().regex(/^wrun_[A-Za-z0-9_-]+$/) });
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
const workerResult = z.object({ station: z.literal("worker"), sessionId: z.string(), revision: sha, summary: z.string(), publication: z.object({ branch: z.string(), number: z.number().int().positive(), url: prUrl, headSha: sha, baseSha: sha }), commands: z.array(command) });
const reviewerResult = z.object({ station: z.literal("reviewer"), sessionId: z.string(), prNumber: z.number().int().positive(), url: prUrl, baseSha: sha, headSha: sha, verdict: z.enum(["approve", "changes_requested", "incomplete"]), summary: z.string(), findings: z.array(z.object({ severity: z.enum(["blocking", "nonblocking"]), path: z.string(), line: z.number().int().positive().optional(), message: z.string(), evidence: z.string() })), commands: z.array(command), limitations: z.array(z.string()), capturedAt: z.string() });
export function parseStationResult(value: unknown) {
  const parsed = z.discriminatedUnion("station", [workerResult, reviewerResult]).safeParse(value);
  return parsed.success ? parsed.data : undefined;
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
