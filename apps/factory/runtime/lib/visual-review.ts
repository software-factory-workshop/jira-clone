import { z } from "zod";

const sha = z.string().regex(/^[a-f0-9]{40}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const visualReviewAppSchema = z.enum(["jira", "factory"]);
export type VisualReviewApp = z.infer<typeof visualReviewAppSchema>;

export const visualReviewFrameSchema = z.object({
  phase: z.enum(["before", "after"]),
  source: z.enum(["base", "head"]).optional(),
  sourceSha: sha.optional(),
  url: z.string().url(),
  sha256: digest,
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]),
}).strict();

export type VisualReviewFrame = z.infer<typeof visualReviewFrameSchema>;

export const visualReviewArtifactSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{16,80}$/),
  app: visualReviewAppSchema,
  origin: z.string().url(),
  route: z.string().min(1).max(2000),
  baseSha: sha,
  headSha: sha,
  targetBranch: z.string().min(1).max(200),
  capturedAt: z.string().min(1).max(100),
  before: visualReviewFrameSchema.optional(),
  after: visualReviewFrameSchema.optional(),
}).strict();

export type VisualReviewArtifact = z.infer<typeof visualReviewArtifactSchema>;

export const visualReviewPacketSchema = z.object({
  version: z.literal(1),
  status: z.enum(["not_required", "missing", "partial", "complete"]),
  requiredApps: z.array(visualReviewAppSchema).max(2),
  baseSha: sha,
  headSha: sha,
  targetBranch: z.string().min(1).max(200),
  reviewerSessionId: z.string().min(1).max(200),
  capturedAt: z.string().min(1).max(100),
  artifacts: z.array(visualReviewArtifactSchema).max(2),
  limitations: z.array(z.string().min(1).max(500)).max(10),
}).strict();

export type VisualReviewPacket = z.infer<typeof visualReviewPacketSchema>;
export type VisualReviewStatus = VisualReviewPacket["status"] | "stale";

export interface VisualReviewBinding {
  baseSha: string;
  headSha: string;
  targetBranch: string;
}

export function visualReviewStatusFor(packet: VisualReviewPacket | undefined, binding?: VisualReviewBinding): VisualReviewStatus {
  if (!packet) return "missing";
  if (binding && (packet.baseSha !== binding.baseSha || packet.headSha !== binding.headSha || packet.targetBranch !== binding.targetBranch)) return "stale";
  return packet.status;
}

export function buildVisualReviewPacket(input: Omit<VisualReviewPacket, "status">): VisualReviewPacket {
  const packet = { ...input, status: "missing" as const };
  if (!input.requiredApps.length) return { ...packet, status: "not_required" };
  const completeApps = new Set(input.artifacts.filter(artifact => artifact.before && artifact.after).map(artifact => artifact.app));
  if (input.requiredApps.every(app => completeApps.has(app))) return { ...packet, status: "complete" };
  if (input.artifacts.length || input.limitations.length) return { ...packet, status: "partial" };
  return packet;
}

export const VISUAL_REVIEW_START = "<!-- factory:visual-review:start -->";
export const VISUAL_REVIEW_END = "<!-- factory:visual-review:end -->";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function frameMarkup(frame: VisualReviewFrame | undefined, label: string) {
  if (!frame) return "<span>Not captured</span>";
  const url = escapeHtml(frame.url);
  return `<a href="${url}"><img src="${url}" alt="${escapeHtml(label)}" width="480" /></a>`;
}

function frameLabel(frame: VisualReviewFrame | undefined, fallback: string) {
  return frame?.source === "base" ? "Base design" : frame?.source === "head" ? "Candidate design" : fallback;
}

function statusLabel(status: VisualReviewStatus) {
  return status === "not_required" ? "Not required" : status[0]!.toUpperCase() + status.slice(1);
}

export function visualReviewMarkdown(packet: VisualReviewPacket, binding?: VisualReviewBinding) {
  const status = visualReviewStatusFor(packet, binding);
  const rows = packet.artifacts.map(artifact => `<tr><th scope="row"><code>${escapeHtml(artifact.app)}</code><br /><code>${escapeHtml(artifact.route)}</code></th><td><strong>${escapeHtml(frameLabel(artifact.before, `${artifact.app} before`))}</strong><br />${frameMarkup(artifact.before, `${artifact.app} ${frameLabel(artifact.before, "before").toLowerCase()}`)}<br /><small>captured ${escapeHtml(artifact.capturedAt)}</small></td><td><strong>${escapeHtml(frameLabel(artifact.after, `${artifact.app} after`))}</strong><br />${frameMarkup(artifact.after, `${artifact.app} ${frameLabel(artifact.after, "after").toLowerCase()}`)}</td><td><code>${escapeHtml(artifact.headSha)}</code><br /><code>${escapeHtml(artifact.targetBranch)} @ ${escapeHtml(artifact.baseSha)}</code></td></tr>`).join("\n");
  const limitations = packet.limitations.length ? `<p><strong>Packet limitations:</strong> ${packet.limitations.map(escapeHtml).join(" ")}</p>` : "";
  const empty = packet.requiredApps.length && !packet.artifacts.length ? "<p>No visual frames were captured for the changed browser surfaces.</p>" : "";
  return `## Visual review

<p><strong>Status:</strong> ${statusLabel(status)} · exact candidate <code>${escapeHtml(packet.headSha)}</code> · target <code>${escapeHtml(packet.targetBranch)} @ ${escapeHtml(packet.baseSha)}</code></p>
${empty}${limitations}
${rows ? `<table><thead><tr><th scope="col">Surface / route</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Source binding</th></tr></thead><tbody>${rows}</tbody></table>` : ""}

<p><small>These frames are visual review evidence only. They do not establish semantic HTML, keyboard accessibility, correctness, or hosted deployment behavior.</small></p>`;
}

export function withVisualReviewSection(body: string, packet: VisualReviewPacket, binding?: VisualReviewBinding) {
  const section = `${VISUAL_REVIEW_START}\n${visualReviewMarkdown(packet, binding)}\n${VISUAL_REVIEW_END}`;
  const escapedStart = VISUAL_REVIEW_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = VISUAL_REVIEW_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const marker = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`);
  return marker.test(body) ? body.replace(marker, section) : `${body.trim()}\n\n${section}`.trim();
}
