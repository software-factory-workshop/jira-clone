import { z } from "zod";
import { createHash } from "node:crypto";
import { requiredCheckName } from "./factory-config.ts";
import { repository } from "./github.mjs";
import { mergeEligibility, type MergeDecision, type MergeFile, type MergeReview } from "./merge-policy.ts";
import { readBranch, readPull, readPullFiles, readPullsByHead, githubRequest, verifyOwnerCommit, workBranch, WorkError } from "./work-github.ts";

const sha = z.string().regex(/^[a-f0-9]{40}$/);

export const githubPullSnapshotSchema = z.object({
  number: z.number().int().positive(),
  url: z.string().url(),
  state: z.enum(["open", "closed"]),
  lifecycle: z.enum(["draft", "ready", "merged", "closed"]),
  draft: z.boolean(),
  merged: z.boolean(),
  headSha: sha,
  baseSha: sha,
  targetHeadSha: sha,
  targetBranch: z.string().min(1).max(240),
  mergeable: z.boolean().nullable(),
  mergeableState: z.string().max(120).optional(),
  mergeCommitSha: sha.optional(),
  changedFiles: z.number().int().nonnegative().optional(),
  /** When the host last read this from GitHub; lets reconcile reuse a fresh observation. */
  observedAt: z.string().datetime().optional(),
  checkedAt: z.string().datetime(),
  checks: z.object({
    status: z.enum(["passed", "pending", "failed"]),
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    requiredPassed: z.boolean(),
    failures: z.array(z.string().min(1).max(500)).max(100),
    pending: z.array(z.string().min(1).max(500)).max(100),
    blockers: z.array(z.string().min(1).max(700)).max(100),
  }).strict(),
  blockers: z.array(z.string().min(1).max(700)).max(100),
}).strict();

export type GithubPullSnapshot = z.infer<typeof githubPullSnapshotSchema>;

export interface PullPublicationBinding {
  number: number;
  url: string;
  headSha: string;
  targetHeadSha: string;
  targetBranch: string;
  ownerSessionId?: string;
}

export interface RecoveredPublication extends PullPublicationBinding {
  branch: string;
  ownerSessionId: string;
  operationId: string;
}

export interface MergeInspection {
  snapshot: GithubPullSnapshot;
  decision: MergeDecision;
}

type ProviderCheckRun = {
  name: string;
  status: string;
  conclusion?: string | null;
  app?: { slug?: string } | null;
};

type ProviderStatus = { state: string; context?: string };

const checkRunsResponseSchema = z.object({
  total_count: z.number().int().nonnegative(),
  check_runs: z.array(z.object({
    name: z.string().min(1).max(500),
    status: z.string().min(1).max(80),
    conclusion: z.string().nullable().optional(),
    app: z.object({ slug: z.string().optional() }).nullable().optional(),
  }).passthrough()),
}).passthrough();

const statusResponseSchema = z.object({
  total_count: z.number().int().nonnegative(),
  statuses: z.array(z.object({ state: z.string().min(1).max(80), context: z.string().max(500).optional() }).passthrough()),
}).passthrough();

function providerParse<T>(schema: z.ZodType<T>, value: unknown, description: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new WorkError("provider_unavailable", `GitHub returned an invalid ${description}.`);
  return parsed.data;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function checkLabel(name: string) {
  return name.trim() || "unnamed check";
}

export interface GithubCheckSummary {
  status: "passed" | "pending" | "failed";
  total: number;
  completed: number;
  requiredPassed: boolean;
  failures: string[];
  pending: string[];
  blockers: string[];
}

export function summarizeGithubChecks(
  runs: { total_count: number; check_runs: ProviderCheckRun[] },
  statuses: { total_count: number; statuses: ProviderStatus[] },
): GithubCheckSummary {
  const failures: string[] = [];
  const pending: string[] = [];
  const blockers: string[] = [];
  const inventoryComplete = runs.total_count === runs.check_runs.length && statuses.total_count === statuses.statuses.length;

  if (!inventoryComplete) blockers.push("GitHub check inventory is incomplete; merge eligibility cannot be confirmed.");

  let completed = 0;
  let requiredPassed = false;
  for (const run of runs.check_runs) {
    const label = checkLabel(run.name);
    if (run.status === "completed") {
      completed++;
      if (run.name === requiredCheckName && run.app?.slug === "github-actions" && run.conclusion === "success") requiredPassed = true;
      if (!run.conclusion || !["success", "neutral", "skipped"].includes(run.conclusion)) {
        failures.push(label);
        blockers.push(`GitHub check "${label}" failed.`);
      }
      if (run.name === requiredCheckName && run.app?.slug === "github-actions" && run.conclusion !== "success") {
        failures.push(label);
        blockers.push(`Required check "${requiredCheckName}" did not pass.`);
      }
    } else {
      pending.push(label);
      blockers.push(`GitHub check "${label}" is still ${run.status}.`);
    }
  }

  for (const status of statuses.statuses) {
    const label = checkLabel(status.context || "commit status");
    if (["success", "failure", "error"].includes(status.state)) completed++;
    if (["failure", "error"].includes(status.state)) {
      failures.push(label);
      blockers.push(`GitHub status "${label}" failed.`);
    } else if (status.state !== "success") {
      pending.push(label);
      blockers.push(`GitHub status "${label}" is ${status.state}.`);
    }
  }

  if (!requiredPassed) blockers.push(`Required check "${requiredCheckName}" has not passed on the candidate.`);
  const uniqueFailures = unique(failures);
  const uniquePending = unique(pending);
  const uniqueBlockers = unique(blockers);
  return {
    status: uniqueFailures.length ? "failed" : uniqueBlockers.length ? "pending" : "passed",
    total: runs.total_count + statuses.total_count,
    completed,
    requiredPassed,
    failures: uniqueFailures,
    pending: uniquePending,
    blockers: uniqueBlockers,
  };
}

function lifecycleFor(input: { state: string; draft?: boolean; merged?: boolean }) {
  if (input.merged === true) return "merged" as const;
  if (input.state === "closed") return "closed" as const;
  if (input.draft === true) return "draft" as const;
  return "ready" as const;
}

function exactPullUrl(url: string, number: number) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:"
      && parsed.hostname === "github.com"
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash
      && parsed.pathname === `/${repository}/pull/${number}`;
  } catch {
    return false;
  }
}

function validatedSnapshot(value: GithubPullSnapshot): GithubPullSnapshot {
  return githubPullSnapshotSchema.parse(value);
}

const publicationMarker = /<!--\s*Factory-Owner: ([^\r\n]+)\r?\nFactory-Operation: ([^\r\n]+)\r?\nFactory-Target: ([^\r\n]+)\r?\nFactory-Target-Head: ([a-f0-9]{40})\r?\nFactory-Session: ([a-f0-9]{64})\r?\nFactory-Base: ([a-f0-9]{40})\s*-->/g;

function markerFor(body: string | null, ownerSessionId: string, operationId: string, targetBranch?: string) {
  if (!body) return undefined;
  const sessionMarker = createHash("sha256").update(ownerSessionId).digest("hex");
  for (const match of body.matchAll(publicationMarker)) {
    const owner = match[1];
    const operation = match[2];
    const target = match[3];
    const targetHeadSha = match[4];
    const session = match[5];
    const baseSha = match[6];
    if (!owner || !operation || !target || !targetHeadSha || !session || !baseSha) continue;
    const normalizedTarget = target.trim();
    if (owner !== ownerSessionId || operation !== operationId || session !== sessionMarker || (targetBranch && normalizedTarget !== targetBranch)) continue;
    return { targetBranch: normalizedTarget, targetHeadSha, baseSha };
  }
}

/**
 * Recover a worker publication when the delivery cursor stopped before the
 * host recorded its result. The branch and operation marker are exact, and
 * the owner commit is checked before any GitHub lifecycle state is trusted.
 */
export async function recoverPublishedWork(token: string, ownerSessionId: string, operationId: string, targetBranch?: string, signal?: AbortSignal): Promise<RecoveredPublication | undefined> {
  z.string().min(1).max(240).parse(ownerSessionId);
  z.string().min(1).max(240).parse(operationId);
  const branch = workBranch(ownerSessionId);
  const candidates = await readPullsByHead(token, branch, targetBranch, signal);
  const matches = candidates.filter(candidate => {
    if (candidate.head.ref !== branch || !exactPullUrl(candidate.html_url, candidate.number)) return false;
    const marker = markerFor(candidate.body, ownerSessionId, operationId, targetBranch);
    return !!marker && marker.targetBranch === candidate.base.ref && marker.targetHeadSha === candidate.base.sha;
  });
  if (matches.length > 1) throw new WorkError("ownership_unverified", "Multiple GitHub pull requests match the delivery owner and operation.");
  const candidate = matches[0];
  if (!candidate) return undefined;
  const marker = markerFor(candidate.body, ownerSessionId, operationId, targetBranch);
  if (!marker || marker.targetBranch !== candidate.base.ref || marker.targetHeadSha !== candidate.base.sha) throw new WorkError("ownership_unverified", "The recovered pull request marker is not bound to its GitHub target.");
  const publication: RecoveredPublication = {
    number: candidate.number,
    url: candidate.html_url,
    headSha: candidate.head.sha,
    targetHeadSha: candidate.base.sha,
    targetBranch: candidate.base.ref,
    ownerSessionId,
    branch,
    operationId,
  };
  await verifyOwnerCommit(token, publication, ownerSessionId, signal, { operationId, targetBranch: candidate.base.ref, targetHeadSha: candidate.base.sha });
  return publication;
}

export async function readGithubPullSnapshot(token: string, publication: PullPublicationBinding, signal?: AbortSignal): Promise<GithubPullSnapshot> {
  const pull = await readPull(token, publication.number, signal);
  if (pull.number !== publication.number || !exactPullUrl(pull.html_url, pull.number)) {
    throw new WorkError("ownership_unverified", "GitHub returned a pull request outside the configured repository binding.");
  }
  if (!(["open", "closed"] as string[]).includes(pull.state)) {
    throw new WorkError("provider_unavailable", "GitHub returned an unsupported pull request state.");
  }
  if (pull.draft === undefined || pull.merged === undefined || pull.changed_files === undefined || pull.mergeable === undefined || pull.mergeable_state === undefined) {
    throw new WorkError("provider_unavailable", "GitHub returned an incomplete pull request snapshot.");
  }

  const targetHeadSha = pull.state === "open" ? await readBranch(token, pull.base.ref, signal) : pull.base.sha;
  const [checkRunsRaw, statusesRaw] = await Promise.all([
    githubRequest(token, `commits/${pull.head.sha}/check-runs?per_page=100&filter=latest`, signal),
    githubRequest(token, `commits/${pull.head.sha}/status?per_page=100`, signal),
  ]);
  const checkRuns = providerParse(checkRunsResponseSchema, checkRunsRaw.data, "check-run response");
  const statuses = providerParse(statusResponseSchema, statusesRaw.data, "commit status response");
  const checks = summarizeGithubChecks(checkRuns, statuses);
  const lifecycle = lifecycleFor(pull);
  const checkedAt = new Date().toISOString();
  return validatedSnapshot({
    number: pull.number,
    url: pull.html_url,
    state: pull.state as "open" | "closed",
    lifecycle,
    draft: pull.draft === true,
    merged: pull.merged === true,
    headSha: pull.head.sha,
    baseSha: pull.base.sha,
    targetHeadSha,
    targetBranch: pull.base.ref,
    mergeable: pull.mergeable ?? null,
    ...(pull.mergeable_state ? { mergeableState: pull.mergeable_state } : {}),
    ...(pull.merge_commit_sha ? { mergeCommitSha: pull.merge_commit_sha } : {}),
    ...(pull.changed_files !== undefined ? { changedFiles: pull.changed_files } : {}),
    checkedAt,
    checks,
    blockers: checks.blockers,
  });
}

function identityBlockers(snapshot: GithubPullSnapshot, publication: PullPublicationBinding, requireCurrentTarget: boolean) {
  const blockers: string[] = [];
  if (snapshot.number !== publication.number || !exactPullUrl(snapshot.url, publication.number)) blockers.push("GitHub PR identity does not match the recorded publication.");
  if (snapshot.headSha !== publication.headSha) blockers.push("The PR head changed since the recorded review; request a fresh review.");
  if (snapshot.targetBranch !== publication.targetBranch) blockers.push("The PR target branch changed since publication.");
  if (snapshot.baseSha !== publication.targetHeadSha) blockers.push("The PR base commit changed since publication.");
  if (requireCurrentTarget && snapshot.targetHeadSha !== publication.targetHeadSha) blockers.push("The target branch advanced since publication; refresh the owner branch before merging.");
  return blockers;
}

function decisionWithEvidence(decision: MergeDecision, snapshot: GithubPullSnapshot, blockers: string[] = []): MergeDecision {
  return {
    ...decision,
    checkedHeadSha: snapshot.headSha,
    checkedAt: snapshot.checkedAt,
    ...(blockers.length ? { blockers: unique(blockers) } : {}),
  };
}

function manual(snapshot: GithubPullSnapshot, reason: string, blockers: string[] = []): MergeInspection {
  return {
    snapshot,
    decision: decisionWithEvidence({ status: "manual", reason }, snapshot, [...blockers, reason]),
  };
}

export async function inspectMergeCandidate(
  token: string,
  publication: PullPublicationBinding,
  review?: MergeReview,
  reviewerSessionId?: string,
  signal?: AbortSignal,
): Promise<MergeInspection> {
  const snapshot = await readGithubPullSnapshot(token, publication, signal);
  if (snapshot.lifecycle === "merged") {
    if (snapshot.headSha === publication.headSha && snapshot.targetBranch === publication.targetBranch && snapshot.number === publication.number && exactPullUrl(snapshot.url, publication.number)) {
      return { snapshot, decision: decisionWithEvidence({ status: "merged", reason: `GitHub confirms PR #${publication.number} merged the recorded candidate.`, ...(snapshot.mergeCommitSha ? { commitSha: snapshot.mergeCommitSha } : {}) }, snapshot) };
    }
    return manual(snapshot, `PR #${publication.number} is merged, but GitHub reports a different candidate head.`);
  }
  if (snapshot.lifecycle === "closed") return manual(snapshot, `PR #${publication.number} is closed on GitHub; no merge action is available.`);
  if (snapshot.lifecycle === "draft") return manual(snapshot, `PR #${publication.number} is still Draft; mark it ready for review before merging.`, [`PR #${publication.number} is still Draft; mark it ready for review before merging.`]);

  const binding = identityBlockers(snapshot, publication, true);
  if (binding.length) return manual(snapshot, binding[0] || "The recorded PR binding is no longer current.", binding);
  if (!review || !reviewerSessionId) return manual(snapshot, "Independent review evidence is not recorded for this exact candidate.");

  const files = await readPullFiles(token, publication.number, signal);
  if (snapshot.changedFiles !== undefined && files.length !== snapshot.changedFiles) return manual(snapshot, "Changed-file inventory is incomplete.");
  const policyDecision = mergeEligibility({
    files: files as MergeFile[],
    review,
    headSha: publication.headSha,
    baseSha: publication.targetHeadSha,
    targetBranch: publication.targetBranch,
    workerSessionId: publication.ownerSessionId || "",
    reviewerSessionId,
  });
  if (policyDecision) return manual(snapshot, policyDecision.reason);
  if (snapshot.checks.status === "failed") return manual(snapshot, snapshot.checks.blockers[0] || "GitHub checks did not pass.", snapshot.checks.blockers);
  if (snapshot.checks.status === "pending") return {
    snapshot,
    decision: decisionWithEvidence({ status: "waiting", reason: snapshot.checks.blockers[0] || "Waiting for all required GitHub checks to pass." }, snapshot, snapshot.checks.blockers),
  };
  if (snapshot.mergeable === null) return {
    snapshot,
    decision: decisionWithEvidence({ status: "waiting", reason: "GitHub is calculating mergeability." }, snapshot, ["GitHub is calculating mergeability."]),
  };
  if (snapshot.mergeable === false || snapshot.mergeableState !== "clean") {
    const reason = snapshot.mergeable === false
      ? "GitHub reports merge conflicts for the candidate."
      : `GitHub reports mergeability state ${snapshot.mergeableState || "unknown"}; refresh before merging.`;
    return manual(snapshot, reason, [reason]);
  }
  return {
    snapshot,
    decision: decisionWithEvidence({ status: "eligible", reason: `PR #${publication.number} is merge eligible at the exact reviewed head.` }, snapshot),
  };
}

export async function markPullRequestReady(token: string, publication: PullPublicationBinding, signal?: AbortSignal): Promise<GithubPullSnapshot> {
  const current = await readGithubPullSnapshot(token, publication, signal);
  if (current.lifecycle === "merged" && current.headSha === publication.headSha && current.targetBranch === publication.targetBranch) return current;
  if (current.lifecycle === "ready") {
    const blockers = identityBlockers(current, publication, true);
    if (blockers.length) throw new WorkError("stale_head", blockers[0] || "The recorded PR binding is no longer current.");
    return current;
  }
  if (current.lifecycle === "closed") throw new WorkError("target_closed", `PR #${publication.number} is closed on GitHub.`);
  const blockers = identityBlockers(current, publication, true);
  if (blockers.length) throw new WorkError("stale_head", blockers[0] || "The recorded PR binding is no longer current.");

  await githubRequest(token, `pulls/${publication.number}`, signal, { draft: false }, "PATCH");
  const confirmed = await readGithubPullSnapshot(token, publication, signal);
  if ((confirmed.lifecycle === "ready" || confirmed.lifecycle === "merged") && confirmed.headSha === publication.headSha && confirmed.targetBranch === publication.targetBranch) return confirmed;
  throw new WorkError("ready_unconfirmed", `GitHub did not confirm that PR #${publication.number} is ready for review.`);
}

export function snapshotIsMergedCandidate(snapshot: GithubPullSnapshot, publication: PullPublicationBinding) {
  return snapshot.lifecycle === "merged"
    && snapshot.number === publication.number
    && exactPullUrl(snapshot.url, publication.number)
    && snapshot.headSha === publication.headSha
    && snapshot.targetBranch === publication.targetBranch;
}
