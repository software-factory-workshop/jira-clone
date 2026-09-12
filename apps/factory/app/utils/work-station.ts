import { z } from "zod";

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
