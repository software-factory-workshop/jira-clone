import { z } from "zod";
import { formatModelUsage } from "./model-usage.ts";

export type DeliveryBadgeColor = "primary" | "info" | "warning" | "success" | "error" | "neutral";

const deliverySnapshotSchema = z.object({
  id: z.string().min(1),
  phase: z.string().min(1),
  updatedAt: z.string().optional(),
  error: z.string().optional(),
  review: z.object({ summary: z.string().optional() }).passthrough().optional(),
  mergeDecision: z.object({ reason: z.string().optional() }).passthrough().optional(),
  questions: z.array(z.object({ question: z.string().min(1), answer: z.string().optional() }).passthrough()).optional(),
  failure: z.object({ kind: z.string().min(1), retryable: z.boolean() }).passthrough().optional(),
  usage: z.object({ inputTokens: z.number().int().positive().optional(), outputTokens: z.number().int().positive().optional(), usd: z.number().finite().positive().optional() }).passthrough().optional(),
  request: z.object({ title: z.string().optional() }).passthrough().optional(),
  publication: z.object({
    number: z.number().int().positive(),
    url: z.string(),
    targetBranch: z.string().optional(),
  }).passthrough().optional(),
  github: z.object({
    number: z.number().int().positive(),
    lifecycle: z.enum(["draft", "ready", "merged", "closed"]),
    checks: z.object({ status: z.enum(["passed", "pending", "failed"]), blockers: z.array(z.string()).optional() }).passthrough().optional(),
    blockers: z.array(z.string()).optional(),
  }).passthrough().optional(),
  history: z.array(z.object({ to: z.string().optional(), phase: z.string().optional() }).passthrough()).optional(),
}).passthrough();
export type DeliverySnapshot = z.infer<typeof deliverySnapshotSchema>;

export interface DeliverySummary {
  id: string;
  title: string;
  phase: string;
  phaseLabel: string;
  phaseColor: DeliveryBadgeColor;
  updatedLabel: string;
  targetBranch?: string;
  prNumber?: number;
  prUrl?: string;
  attentionReason?: string;
  question?: string;
  failureKind?: string;
  failureRetryable?: boolean;
  usageLabel?: string;
}

export interface DeliveryStatusSummary {
  phaseLabel: string;
  phaseColor: DeliveryBadgeColor;
  latestResult: string;
  blocker?: string;
  nextAction: string;
}

const phaseLabels: Record<string, { label: string; color: DeliveryBadgeColor }> = {
  worker_starting: { label: "Worker starting", color: "info" },
  working: { label: "Working", color: "primary" },
  review_starting: { label: "Review starting", color: "info" },
  reviewing: { label: "Reviewing", color: "primary" },
  revision_starting: { label: "Revising", color: "warning" },
  revising: { label: "Revising", color: "warning" },
  awaiting_input: { label: "Waiting for you", color: "warning" },
  owner_resuming: { label: "Resuming", color: "info" },
  merging: { label: "Merging", color: "info" },
  ready: { label: "Ready", color: "success" },
  merged: { label: "Merged", color: "success" },
  human_review: { label: "Needs human review", color: "warning" },
  needs_revision: { label: "Needs revision", color: "warning" },
  blocked: { label: "Blocked", color: "error" },
  cancelled: { label: "Cancelled", color: "neutral" },
};

export const attentionPhases: ReadonlySet<string> = new Set([
  "human_review",
  "awaiting_input",
  "needs_revision",
  "blocked",
  "cancelled",
]);

const maxAttentionReasonLength = 180;
const observationTimeoutHintLength = 1500;

const observationTimeoutHint =
  'The delivery observer timed out before the session stream completed. No partial result was accepted; resume the blocked delivery to restore its phase and re-observe the same session.';

export function deriveAttentionReason(value: {
  error?: string;
  review?: { summary?: string };
  mergeDecision?: { reason?: string };
  github?: { blockers?: string[]; checks?: { blockers?: string[] } };
  question?: string;
}): string | undefined {
  const candidates: Array<{ text: string | undefined; limit: number }> = [
    typeof value.error === "string" && value.error.includes("no partial result accepted")
      ? { text: `${value.error} ${observationTimeoutHint}`, limit: observationTimeoutHintLength }
      : { text: value.error, limit: maxAttentionReasonLength },
    { text: value.review?.summary, limit: maxAttentionReasonLength },
    { text: value.mergeDecision?.reason, limit: maxAttentionReasonLength },
    { text: value.github?.blockers?.[0] || value.github?.checks?.blockers?.[0], limit: maxAttentionReasonLength },
    { text: value.question, limit: maxAttentionReasonLength },
  ];
  for (const candidate of candidates) {
    if (typeof candidate.text !== "string") continue;
    const collapsed = candidate.text.replace(/\s+/g, " ").trim();
    if (!collapsed) continue;
    return collapsed.length > candidate.limit ? `${collapsed.slice(0, candidate.limit - 1).trimEnd()}…` : collapsed;
  }
  return undefined;
}

export function describeDeliveryPhase(phase: string): { label: string; color: DeliveryBadgeColor } {
  return phaseLabels[phase] ?? { label: phase, color: "neutral" };
}

type DeliveryStatusInput = {
  phase: string;
  error?: string;
  failure?: { retryable?: boolean };
  publication?: { number?: number };
  review?: { verdict?: string; summary?: string; limitations?: string[] };
  github?: { number?: number; lifecycle?: string; checks?: { status?: string; blockers?: string[] }; blockers?: string[] };
  mergeDecision?: { status?: string; reason?: string; blockers?: string[] };
  questions?: Array<{ question: string; answer?: string }>;
  history?: Array<{ to?: string; phase?: string }>;
};

function latestOwnerQuestion(value: DeliveryStatusInput): string | undefined {
  return [...(value.questions ?? [])].reverse().find(question => !question.answer)?.question;
}

function latestResultFor(value: DeliveryStatusInput, phaseLabel: string): string {
  if (value.github?.lifecycle === "merged" && value.github.number) return `GitHub confirms PR #${value.github.number} is merged.`;
  if (value.github?.lifecycle === "draft" && value.github.number) return `GitHub PR #${value.github.number} is still Draft.`;
  if (value.review?.summary) {
    const verdict = value.review.verdict ? ` · ${value.review.verdict}` : "";
    return `Independent review${verdict}: ${value.review.summary}`;
  }
  if (value.publication?.number) return `Draft PR #${value.publication.number} is published for review.`;
  if (value.mergeDecision?.status) return `Merge decision: ${value.mergeDecision.status}.`;
  const last = value.history?.at(-1);
  if (last) return `Latest handoff: ${describeDeliveryPhase(last.to || last.phase || value.phase).label}.`;
  return `Delivery is ${phaseLabel.toLowerCase()}.`;
}

function blockerFor(value: DeliveryStatusInput, question?: string): string | undefined {
  if (question) return question;
  if (value.error) return value.error;
  if (value.github?.blockers?.length) return value.github.blockers[0];
  if (value.github?.checks?.blockers?.length) return value.github.checks.blockers[0];
  if (value.mergeDecision?.blockers?.length) return value.mergeDecision.blockers[0];
  if (value.phase === "blocked") return "The delivery is blocked and needs a recovery decision.";
  if (value.phase === "human_review") {
    return value.mergeDecision?.reason || (value.review?.limitations?.length
      ? "The review has limitations, so the host keeps merge gated."
      : "A human decision is required before this delivery can merge.");
  }
  if (value.phase === "needs_revision") return "The current PR needs a response from its existing branch owner.";
  return undefined;
}

function nextActionFor(value: DeliveryStatusInput, question?: string): string {
  if (value.github?.lifecycle === "merged") return "No action needed; GitHub confirms this PR is complete.";
  if (value.github?.lifecycle === "draft") return "Mark the PR ready for review from this delivery.";
  if (value.mergeDecision?.status === "eligible") return "Merge the eligible PR from Cockpit.";
  if (value.github?.checks?.status === "failed") return "Resolve the named GitHub validation blockers, then refresh status.";
  if (value.github?.checks?.status === "pending") return "Wait for GitHub validation to settle, then refresh status.";
  switch (value.phase) {
    case "awaiting_input":
      return question ? "Answer the worker's question to continue." : "Check the worker run for the pending owner question.";
    case "blocked":
      return value.failure?.retryable === false ? "Inspect the saved run and decide how to recover it." : "Retry the blocked phase, then inspect the same run if it remains blocked.";
    case "human_review":
      return value.publication?.number ? "Review the exact PR, then merge it or request a revision." : "Inspect the station run, then resume the owner or start a new attempt.";
    case "needs_revision":
      return "Add guidance below and request the next owner revision.";
    case "ready":
      return "Check the exact PR and complete the host merge decision.";
    case "merged":
      return "No action needed; this delivery is complete.";
    case "cancelled":
      return "Start a new delivery if this work is still needed.";
    case "merging":
      return "Wait for the host merge check to settle.";
    default:
      return "Follow the next worker or reviewer handoff.";
  }
}

export function summarizeDeliveryStatus(value: unknown): DeliveryStatusSummary | undefined {
  const parsed = deliverySnapshotSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const snapshot = parsed.data as DeliveryStatusInput;
  const phase = describeDeliveryPhase(snapshot.phase);
  const question = latestOwnerQuestion(snapshot);
  const blocker = blockerFor(snapshot, question);
  return {
    phaseLabel: phase.label,
    phaseColor: phase.color,
    latestResult: latestResultFor(snapshot, phase.label),
    ...(blocker ? { blocker } : {}),
    nextAction: nextActionFor(snapshot, question),
  };
}

export function formatDeliveryUpdatedAt(value: unknown, now: Date = new Date()): string {
  if (typeof value !== "string" || !value) return "Last update unavailable";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Last update unavailable";
  const diff = now.getTime() - time;
  if (diff < 0) return `Last update ${new Date(value).toLocaleString()}`;
  if (diff < 60_000) return "Updated just now";
  if (diff < 3_600_000) {
    const minutes = Math.max(1, Math.floor(diff / 60_000));
    return `Updated ${minutes} min ago`;
  }
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return `Updated ${hours} hr ago`;
  }
  return `Last update ${new Date(value).toLocaleString()}`;
}

export function summarizeDelivery(value: unknown, fallbackTitle?: string, now: Date = new Date()): DeliverySummary | undefined {
  const parsed = deliverySnapshotSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const snapshot = parsed.data;
  const title = snapshot.request?.title?.trim() || fallbackTitle?.trim() || "Delivery";
  const phase = describeDeliveryPhase(snapshot.phase);
  let prNumber: number | undefined;
  let prUrl: string | undefined;
  if (snapshot.publication && snapshot.publication.url.startsWith("https://")) {
    prNumber = snapshot.publication.number;
    prUrl = snapshot.publication.url;
  }
  const question = [...(snapshot.questions ?? [])].reverse().find(candidate => !candidate.answer)?.question;
  const attentionReason = deriveAttentionReason({ ...snapshot, question });
  return {
    id: snapshot.id,
    title,
    phase: snapshot.phase,
    phaseLabel: phase.label,
    phaseColor: phase.color,
    updatedLabel: formatDeliveryUpdatedAt(snapshot.updatedAt, now),
    targetBranch: snapshot.publication?.targetBranch || undefined,
    prNumber,
    prUrl,
    ...(attentionReason ? { attentionReason } : {}),
    ...(question ? { question } : {}),
    ...(snapshot.failure ? { failureKind: snapshot.failure.kind, failureRetryable: snapshot.failure.retryable } : {}),
    ...(snapshot.usage && formatModelUsage(snapshot.usage) ? { usageLabel: formatModelUsage(snapshot.usage) } : {}),
  };
}

export function isLoopRun(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { value?: unknown };
  if (typeof record.value !== "object" || record.value === null) return false;
  return (record.value as { station?: unknown }).station === "loop";
}
