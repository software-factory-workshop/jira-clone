<script setup lang="ts">
import { deliveryFlow } from "../utils/observability-flow";
import { describeDeliveryPhase, formatDeliveryUpdatedAt } from "../utils/delivery-summary";

const props = defineProps<{ title: string; brief: string }>();

interface Delivery {
  id: string;
  version: number;
  phase: string;
  cycle: number;
  updatedAt?: string;
  sessionId?: string;
  childSessionId?: string;
  reviewerSessionId?: string;
  failedPhase?: string;
  publication?: { number: number; url: string; targetBranch?: string };
  review?: { verdict: string; summary: string };
  mergeDecision?: { status: string; reason: string };
  error?: string;
  request?: { title?: string };
  history: Array<{ phase: string; at?: string; sessionId?: string; headSha?: string }>;
}

const route = useRoute();
const router = useRouter();
const run = ref<Delivery>();
const error = ref("");
const working = ref(false);
const revision = ref("");
let operationId: string | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
const stopped = new Set(["human_review", "ready", "blocked", "needs_revision", "cancelled", "merged"]);
const cockpit = useCockpit();

const flowModel = computed(() => deliveryFlow({
  phase: run.value?.phase,
  cycle: run.value?.cycle,
  failedPhase: run.value?.failedPhase,
  history: run.value?.history,
  sessionId: run.value?.sessionId,
  childSessionId: run.value?.childSessionId,
  reviewerSessionId: run.value?.reviewerSessionId,
  publication: run.value?.publication,
  review: run.value?.review,
  mergeDecision: run.value?.mergeDecision,
  error: run.value?.error,
}));
const phaseInfo = computed(() => run.value ? describeDeliveryPhase(run.value.phase) : { label: "Workflow blueprint", color: "neutral" as const });
const phaseDetail = computed(() => run.value?.error || run.value?.mergeDecision?.reason || run.value?.review?.summary || "The durable workflow is observing the next station.");
const updatedLabel = computed(() => formatDeliveryUpdatedAt(run.value?.updatedAt));

async function remember(value: Delivery) {
  try {
    const row = cockpit.items.value.runs.find((item) => item.id === value.id);
    await cockpit.save("runs", value.id, { label: props.title || "Delivery loop", station: "loop" }, row?.version ?? 0);
  } catch {
    // Keep the authoritative delivery link even if its history index is unavailable.
  }
}

function schedule() {
  if (!disposed && run.value && !stopped.has(run.value.phase)) timer = setTimeout(() => void refresh(), 3000);
}

async function start() {
  if (working.value) return;
  working.value = true;
  error.value = "";
  operationId ??= crypto.randomUUID();
  try {
    run.value = await $fetch<Delivery>("/factory/delivery", { method: "POST", body: { operationId, title: props.title, brief: props.brief }, retry: 0 });
    await router.replace({ query: { ...route.query, delivery: run.value.id } });
    await remember(run.value);
    operationId = undefined;
    schedule();
  } catch {
    error.value = "Could not confirm the loop start. Retry uses the same operation ID.";
  } finally {
    working.value = false;
  }
}

async function refresh() {
  if (!run.value || working.value) return;
  working.value = true;
  try {
    run.value = await $fetch<Delivery>(`/factory/delivery/${encodeURIComponent(run.value.id)}`, { retry: 0 });
    error.value = "";
  } catch {
    error.value = "Could not refresh this delivery. Reconnect to the same run.";
  } finally {
    working.value = false;
    schedule();
  }
}

async function resume() {
  if (!run.value || working.value) return;
  working.value = true;
  try {
    run.value = await $fetch<Delivery>(`/factory/delivery/${encodeURIComponent(run.value.id)}/resume`, { method: "POST", body: { operationId: operationId ??= crypto.randomUUID() }, retry: 0 });
    operationId = undefined;
    error.value = "";
    schedule();
  } catch {
    error.value = "Could not resume this delivery. The existing operation is retained.";
  } finally {
    working.value = false;
  }
}

async function cancel() {
  if (!run.value) return;
  if (!window.confirm("Stop this delivery? The workflow will be cancelled.")) return;
  clearTimeout(timer);
  try {
    run.value = await $fetch<Delivery>(`/factory/delivery/${encodeURIComponent(run.value.id)}/cancel`, { method: "POST", retry: 0 });
  } catch {
    error.value = "Cancellation is unconfirmed. Reconnect to check the same run.";
  }
}

async function revise() {
  if (!run.value || working.value) return;
  working.value = true;
  operationId ??= crypto.randomUUID();
  try {
    run.value = await $fetch<Delivery>(`/factory/delivery/${encodeURIComponent(run.value.id)}/revise`, { method: "POST", body: { operationId, brief: revision.value }, retry: 0 });
    operationId = undefined;
    revision.value = "";
    error.value = "";
    schedule();
  } catch {
    error.value = "Could not confirm the revision. Your request is retained.";
  } finally {
    working.value = false;
  }
}

watch(() => route.query.delivery, async (id) => {
  clearTimeout(timer);
  if (typeof id !== "string") return;
  try {
    run.value = await $fetch<Delivery>(`/factory/delivery/${encodeURIComponent(id)}`);
    schedule();
  } catch {
    error.value = "Could not load this delivery. Keep its URL to retry.";
  }
}, { immediate: true });

onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(timer);
});
</script>

<template>
  <section class="panel delivery-panel">
    <div class="panel-heading delivery-heading">
      <div>
        <p class="delivery-eyebrow"><UIcon name="i-lucide-workflow" aria-hidden="true" /> Durable workflow</p>
        <h2>Build and review loop</h2>
      </div>
      <UBadge :color="phaseInfo.color" variant="soft">{{ phaseInfo.label }}</UBadge>
    </div>
    <p class="delivery-intro">The worker creates a PR, an independent agent reviews it, and findings return to the branch owner. This map makes the workflow’s current handoff visible while it continues after you leave the page.</p>

    <ClientOnly>
      <CockpitFlow
        id="delivery-observability"
        title="Delivery workflow"
        :description="run ? 'Live phase and handoff state from the durable delivery snapshot.' : 'A preview of the handoffs that will be observed once you start a delivery.'"
        :nodes="flowModel.nodes"
        :edges="flowModel.edges"
        :height="316"
      />
      <template #fallback><div class="flow-loading" role="status">Loading workflow map…</div></template>
    </ClientOnly>

    <div v-if="run" class="delivery-live" role="status">
      <span class="delivery-live-dot" :class="`phase-${run.phase}`" aria-hidden="true" />
      <div><strong>{{ phaseInfo.label }}</strong><span>{{ phaseDetail }}</span></div>
      <span class="delivery-updated">{{ updatedLabel }}</span>
    </div>
    <p v-if="run" class="delivery-id">Delivery {{ run.id }} · cycle {{ run.cycle }}<template v-if="run.publication?.targetBranch"> · target {{ run.publication.targetBranch }}</template></p>
    <p v-if="run?.mergeDecision" class="delivery-note">{{ run.mergeDecision.reason }}</p>
    <p v-if="run?.error" class="delivery-error" role="alert">{{ run.error }}</p>
    <p v-if="run?.review" class="delivery-note">{{ run.review.summary }}</p>

    <div class="delivery-actions">
      <UButton :disabled="!title.trim() || brief.trim().length < 20 || working" :loading="working && !run" icon="i-lucide-play" @click="start">Start delivery from this draft</UButton>
      <UButton v-if="run?.publication" :to="run.publication.url" target="_blank" rel="noopener noreferrer" variant="outline" icon="i-lucide-git-pull-request">Open PR #{{ run.publication.number }}</UButton>
      <UButton v-if="run && (run.phase === 'blocked' || (run.phase === 'human_review' && !run.publication))" variant="outline" :disabled="working" icon="i-lucide-rotate-ccw" @click="resume">Resume observation</UButton>
      <UButton v-else-if="run" variant="outline" :loading="working" icon="i-lucide-refresh-cw" @click="refresh">Refresh status</UButton>
      <UButton v-if="run && !stopped.has(run.phase)" variant="ghost" color="neutral" @click="cancel">Stop delivery</UButton>
    </div>
    <p v-if="error" class="delivery-error" role="alert">{{ error }}</p>

    <div v-if="run && ['ready', 'human_review', 'blocked', 'needs_revision'].includes(run.phase)" class="revision-request">
      <UFormField label="Request the next revision" name="revision">
        <UTextarea v-model="revision" :rows="3" placeholder="Describe what the branch owner should address…" />
      </UFormField>
      <UButton :disabled="revision.trim().length < 20 || working" :loading="working" icon="i-lucide-message-square-more" @click="revise">Request revision</UButton>
    </div>
  </section>
</template>

<style scoped>
.delivery-panel { padding: 24px; margin-top: 24px; }
.delivery-heading { margin-bottom: 8px; }
.delivery-heading h2 { margin: 0; font-size: 22px; font-weight: 600; text-wrap: balance; }
.delivery-eyebrow { display: flex; align-items: center; gap: 7px; margin: 0 0 7px; color: var(--ui-primary); font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
.delivery-intro { max-width: 850px; margin: 0; color: var(--ui-text-muted); line-height: 1.65; }
.flow-loading { display: grid; min-height: 180px; margin: 24px 0; place-items: center; border: 1px solid var(--ui-border); border-radius: 8px; color: var(--ui-text-muted); font-size: 12px; }
.delivery-live { display: flex; align-items: center; gap: 11px; margin: 20px 0 0; padding: 12px 14px; border: 1px solid #dce9e9; border-radius: 6px; background: #f5fbfb; }
.delivery-live-dot { width: 9px; height: 9px; flex-shrink: 0; border-radius: 50%; background: #a6b5b8; }
.delivery-live-dot.phase-working, .delivery-live-dot.phase-reviewing, .delivery-live-dot.phase-revising, .delivery-live-dot.phase-worker_starting, .delivery-live-dot.phase-review_starting, .delivery-live-dot.phase-revision_starting, .delivery-live-dot.phase-owner_resuming, .delivery-live-dot.phase-merging { background: var(--ui-primary); box-shadow: 0 0 0 4px rgba(0, 127, 140, 0.1); }
.delivery-live-dot.phase-human_review, .delivery-live-dot.phase-needs_revision { background: #bb7410; }
.delivery-live-dot.phase-blocked, .delivery-live-dot.phase-cancelled { background: #bf4c43; }
.delivery-live div { display: grid; gap: 2px; min-width: 0; }
.delivery-live strong { color: #2d545c; font-size: 12px; }
.delivery-live div span { overflow: hidden; color: var(--ui-text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.delivery-updated { margin-left: auto; flex-shrink: 0; color: var(--ui-text-muted); font-size: 11px; }
.delivery-id, .delivery-note, .delivery-error { margin: 14px 0 0; font-size: 12px; line-height: 1.6; }
.delivery-id { color: var(--ui-text-muted); overflow-wrap: anywhere; }
.delivery-note { color: #53666e; }
.delivery-error { color: #a33d37; }
.delivery-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
.revision-request { display: grid; gap: 12px; max-width: 700px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--ui-border); }
@media (max-width: 700px) {
  .delivery-live { align-items: flex-start; flex-wrap: wrap; }
  .delivery-updated { width: 100%; margin-left: 20px; }
}
</style>
