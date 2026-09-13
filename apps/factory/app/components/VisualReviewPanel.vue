<script setup lang="ts">
import { visualReviewStatusFor, type VisualReviewArtifact, type VisualReviewBinding, type VisualReviewFrame, type VisualReviewPacket, type VisualReviewStatus } from "../../runtime/lib/visual-review";

const props = defineProps<{
  packet?: VisualReviewPacket;
  binding?: VisualReviewBinding;
}>();

const status = computed(() => visualReviewStatusFor(props.packet, props.binding));

const statusLabels: Record<VisualReviewStatus, string> = {
  complete: "Complete",
  partial: "Partial",
  missing: "Missing",
  not_required: "Not required",
  stale: "Stale",
};

const statusColors: Record<VisualReviewStatus, "success" | "warning" | "neutral"> = {
  complete: "success",
  partial: "warning",
  missing: "warning",
  not_required: "neutral",
  stale: "warning",
};

const statusDescription: Record<VisualReviewStatus, string> = {
  complete: "Every changed browser surface has a same-route before and after frame.",
  partial: "Some changed browser surfaces have evidence, but the packet is not complete.",
  missing: "No visual packet is available for this review. Check the PR and review limitations below.",
  not_required: "No changed browser surface required visual evidence for this candidate.",
  stale: "The packet belongs to a different base, head, or target branch. Do not use it to review the current candidate.",
};

const artifacts = computed(() => props.packet?.artifacts || []);

function frameFor(artifact: VisualReviewArtifact, phase: VisualReviewFrame["phase"]) {
  return artifact[phase];
}

function safeFrameUrl(frame: VisualReviewFrame | undefined) {
  return safeHttpUrl(frame?.url);
}

function safeHttpUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function frameLabel(artifact: VisualReviewArtifact, phase: VisualReviewFrame["phase"]) {
  return `${artifact.app} ${phase} state for ${artifact.route}`;
}
</script>

<template>
  <UCard class="visual-review-panel">
    <div class="visual-review-heading">
      <div>
        <p class="visual-review-eyebrow"><UIcon name="i-lucide-images" aria-hidden="true" /> Review evidence</p>
        <h3>Visual review packet</h3>
      </div>
      <UBadge :color="statusColors[status]" variant="soft">{{ statusLabels[status] }}</UBadge>
    </div>

    <p class="visual-review-intro">Before and after frames make the design change easier to inspect. This is supplementary evidence only; it does not replace semantic, keyboard, correctness, or deployment checks.</p>
    <UAlert
      :color="statusColors[status]"
      :icon="status === 'complete' ? 'i-lucide-check-circle-2' : status === 'stale' ? 'i-lucide-alert-triangle' : 'i-lucide-info'"
      :title="statusLabels[status]"
      :description="statusDescription[status]"
    />

    <template v-if="packet">
      <div class="visual-review-binding" aria-label="Visual review source binding">
        <span>Candidate <code>{{ packet.headSha }}</code></span>
        <span>Target <code>{{ packet.targetBranch }} @ {{ packet.baseSha }}</code></span>
        <span>Captured {{ packet.capturedAt }}</span>
      </div>
      <p v-if="packet.requiredApps.length" class="visual-review-required">Required surfaces: {{ packet.requiredApps.join(", ") }}</p>
      <p v-if="status === 'stale' && binding" class="visual-review-current-binding">Current cockpit candidate <code>{{ binding.headSha }}</code> · target <code>{{ binding.targetBranch }} @ {{ binding.baseSha }}</code></p>

      <div v-if="artifacts.length" class="visual-review-artifacts">
        <UCard v-for="artifact in artifacts" :key="artifact.id" class="visual-review-artifact" variant="subtle">
          <div class="visual-review-artifact-heading">
            <div>
              <strong>{{ artifact.app }}</strong>
              <code>{{ artifact.route }}</code>
            </div>
            <a v-if="safeHttpUrl(artifact.origin)" :href="safeHttpUrl(artifact.origin)" target="_blank" rel="noopener noreferrer" :aria-label="`Open ${artifact.app} preview origin`"><UIcon name="i-lucide-external-link" aria-hidden="true" /></a>
          </div>
          <div class="visual-review-frames">
            <figure v-for="phase in ['before', 'after'] as const" :key="phase">
              <figcaption>{{ phase === 'before' ? 'Before' : 'After' }}</figcaption>
              <a v-if="safeFrameUrl(frameFor(artifact, phase))" :href="safeFrameUrl(frameFor(artifact, phase))" target="_blank" rel="noopener noreferrer">
                <img :src="safeFrameUrl(frameFor(artifact, phase))" :alt="frameLabel(artifact, phase)" loading="lazy" />
              </a>
              <span v-else class="visual-review-missing-frame">Not captured</span>
            </figure>
          </div>
          <p class="visual-review-capture">Frame source is bound to <code>{{ artifact.headSha }}</code> · captured {{ artifact.capturedAt }}</p>
        </UCard>
      </div>

      <UAlert v-if="packet.limitations.length" class="visual-review-limitations" color="warning" icon="i-lucide-notebook-pen" title="Packet limitations">
        <ul>
          <li v-for="limitation in packet.limitations" :key="limitation">{{ limitation }}</li>
        </ul>
      </UAlert>
      <details class="visual-review-technical">
        <summary>Technical evidence</summary>
        <dl>
          <div><dt>Reviewer session</dt><dd><code>{{ packet.reviewerSessionId }}</code></dd></div>
          <div><dt>Candidate head</dt><dd><code>{{ packet.headSha }}</code></dd></div>
          <div><dt>Base</dt><dd><code>{{ packet.baseSha }}</code></dd></div>
          <div><dt>Target branch</dt><dd><code>{{ packet.targetBranch }}</code></dd></div>
        </dl>
      </details>
    </template>
  </UCard>
</template>

<style scoped>
.visual-review-panel { margin: 24px 0; overflow-wrap: anywhere; }
.visual-review-heading, .visual-review-artifact-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.visual-review-eyebrow { display: flex; align-items: center; gap: 7px; margin: 0 0 7px; color: var(--ui-primary); font-size: 10px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; }
.visual-review-heading h3 { margin: 0; font-size: 18px; font-weight: 600; }
.visual-review-intro { color: var(--ui-text-muted); line-height: 1.6; }
.visual-review-binding { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; color: var(--ui-text-muted); font-size: 11px; }
.visual-review-binding span { padding: 6px 8px; border: 1px solid var(--ui-border); border-radius: 5px; background: var(--ui-bg-muted); }
.visual-review-required, .visual-review-current-binding { margin: 12px 0 0; color: var(--ui-text-muted); font-size: 11px; }
.visual-review-artifacts { display: grid; gap: 16px; margin-top: 18px; }
.visual-review-artifact { min-width: 0; }
.visual-review-artifact-heading strong, .visual-review-artifact-heading code { display: block; }
.visual-review-artifact-heading strong { margin-bottom: 4px; font-size: 14px; text-transform: capitalize; }
.visual-review-artifact-heading code { color: var(--ui-text-muted); font-size: 12px; }
.visual-review-artifact-heading a { color: var(--ui-primary); }
.visual-review-frames { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
.visual-review-frames figure { min-width: 0; margin: 0; }
.visual-review-frames figcaption { margin-bottom: 6px; color: var(--ui-text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; }
.visual-review-frames a, .visual-review-missing-frame { display: block; min-height: 120px; border: 1px solid var(--ui-border); border-radius: 5px; background: var(--ui-bg-muted); }
.visual-review-frames a { overflow: hidden; }
.visual-review-frames img { display: block; width: 100%; height: 180px; object-fit: contain; background: var(--ui-bg-muted); }
.visual-review-missing-frame { display: grid; place-items: center; color: var(--ui-text-muted); font-size: 12px; }
.visual-review-capture { margin: 12px 0 0; color: var(--ui-text-muted); font-size: 11px; }
.visual-review-limitations { margin-top: 16px; }
.visual-review-limitations ul { margin: 0; padding-left: 18px; list-style: disc; }
.visual-review-technical { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--ui-border); font-size: 12px; }
.visual-review-technical summary { cursor: pointer; font-weight: 600; }
.visual-review-technical dl { display: grid; gap: 8px; margin: 12px 0 0; }
.visual-review-technical dl div { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px; }
.visual-review-technical dt { color: var(--ui-text-muted); }
.visual-review-technical dd { margin: 0; }
@media (max-width: 560px) {
  .visual-review-frames { grid-template-columns: 1fr; }
  .visual-review-frames img { height: 220px; }
}
</style>
