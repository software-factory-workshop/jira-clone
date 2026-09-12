import { z } from "zod";

export type DeliveryBadgeColor = "primary" | "info" | "warning" | "success" | "error" | "neutral";

const deliverySnapshotSchema = z.object({
  id: z.string().min(1),
  phase: z.string().min(1),
  updatedAt: z.string().optional(),
  error: z.string().optional(),
  review: z.object({ summary: z.string().optional() }).passthrough().optional(),
  mergeDecision: z.object({ reason: z.string().optional() }).passthrough().optional(),
  request: z.object({ title: z.string().optional() }).passthrough().optional(),
  publication: z.object({
    number: z.number().int().positive(),
    url: z.string(),
    targetBranch: z.string().optional(),
  }).passthrough().optional(),
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
}

const phaseLabels: Record<string, { label: string; color: DeliveryBadgeColor }> = {
  worker_starting: { label: "Worker starting", color: "info" },
  working: { label: "Working", color: "primary" },
  review_starting: { label: "Review starting", color: "info" },
  reviewing: { label: "Reviewing", color: "primary" },
  revision_starting: { label: "Revising", color: "warning" },
  revising: { label: "Revising", color: "warning" },
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
  "needs_revision",
  "blocked",
  "cancelled",
]);

const maxAttentionReasonLength = 180;

export function deriveAttentionReason(value: {
  error?: string;
  review?: { summary?: string };
  mergeDecision?: { reason?: string };
}): string | undefined {
  const candidates = [value.error, value.review?.summary, value.mergeDecision?.reason];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const collapsed = candidate.replace(/\s+/g, " ").trim();
    if (!collapsed) continue;
    return collapsed.length > maxAttentionReasonLength
      ? `${collapsed.slice(0, maxAttentionReasonLength - 1).trimEnd()}…`
      : collapsed;
  }
  return undefined;
}

export function describeDeliveryPhase(phase: string): { label: string; color: DeliveryBadgeColor } {
  return phaseLabels[phase] ?? { label: phase, color: "neutral" };
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
  const attentionReason = deriveAttentionReason(snapshot);
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
  };
}

export function isLoopRun(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { value?: unknown };
  if (typeof record.value !== "object" || record.value === null) return false;
  return (record.value as { station?: unknown }).station === "loop";
}
