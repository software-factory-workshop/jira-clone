<script setup lang="ts">
import { deliveryFlow } from "../utils/observability-flow";
import { describeDeliveryPhase, formatDeliveryUpdatedAt } from "../utils/delivery-summary";
import { MIN_WORK_REQUEST_LENGTH } from "../utils/work-station";
import { copyText, shortIdentifier } from "../utils/technical-details";
import { formatModelUsage } from "../utils/model-usage.ts";
import type { VisualReviewBinding, VisualReviewPacket } from "../../runtime/lib/visual-review";

interface Delivery {
  id: string;
  version: number;
  phase: string;
  cycle: number;
  updatedAt?: string;
  sessionId?: string;
  childSessionId?: string;
  reviewerSessionId?: string;
  failure?: { kind: string; retryable: boolean };
  failedPhase?: string;
  publication?: { number: number; url: string; targetBranch?: string; headSha?: string; targetHeadSha?: string };
  review?: { verdict: string; summary: string; baseSha?: string; headSha?: string; targetBranch?: string; visualReview?: VisualReviewPacket };
  mergeDecision?: { status: string; reason: string };
  error?: string;
  request?: { title?: string; brief?: string };
  history: Array<{ phase: string; at?: string; sessionId?: string; headSha?: string }>;
  usage?: { model?: string; inputTokens?: number; outputTokens?: number; usd?: number; factorySha?: string };
}
interface ReconciliationResult { eligible: boolean; reason: string; commitSha?: string }

const props = withDefaults(defineProps<{
  title?: string;
  brief?: string;
  mode?: "compose" | "run";
}>(), {
  title: "",
  brief: "",
  mode: "compose",
});
const emit = defineEmits<{ started: [value: Delivery] }>();

const route = useRoute();
const router = useRouter();
const run = ref<Delivery>();
const error = ref("");
const working = ref(false);
const stopping = ref(false);
const revision = ref("");
const reconciliation = ref<ReconciliationResult>();
const reconciling = ref(false);
const copiedEvidence = ref<string>();
let copyTimer: ReturnType<typeof setTimeout> | undefined;
let operationId: string | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
const stopped = new Set(["human_review", "ready", "blocked", "needs_revision", "cancelled", "merged"]);
const reconcilable = new Set(["human_review", "ready", "blocked"]);
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
const usageLabel = computed(() => formatModelUsage(run.value?.usage));
const briefLength = computed(() => props.brief.trim().length);
const briefReady = computed(() => briefLength.value >= MIN_WORK_REQUEST_LENGTH);
const canCompose = computed(() => props.mode === "compose");
const visualReviewBinding = computed<VisualReviewBinding | undefined>(() => {
  const delivery = run.value;
  const review = delivery?.review;
  const baseSha = review?.baseSha || delivery?.publication?.targetHeadSha;
  const headSha = review?.headSha || delivery?.publication?.headSha;
  const targetBranch = review?.targetBranch || delivery?.publication?.targetBranch;
  return baseSha && headSha && targetBranch ? { baseSha, headSha, targetBranch } : undefined;
});

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
  if (!canCompose.value || working.value) return;
  working.value = true;
  error.value = "";
  operationId ??= crypto.randomUUID();
  try {
    run.value = await $fetch<Delivery>("/factory/delivery", { method: "POST", body: { operationId, title: props.title, brief: props.brief }, retry: 0 });
    emit("started", run.value);
    await router.replace({ path: "/work/run", query: { delivery: run.value.id } });
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

async function reconcile() {
  if (!run.value?.publication || reconciling.value) return;
  reconciling.value = true;
  try {
    reconciliation.value = await $fetch<ReconciliationResult>(`/factory/delivery/${encodeURIComponent(run.value.id)}/reconcile`, { retry: 0 });
    error.value = "";
  } catch {
    error.value = "Could not verify GitHub merge evidence. No delivery state was changed.";
  } finally {
    reconciling.value = false;
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
  if (!run.value || working.value || stopping.value) return;
  if (!window.confirm("Stop this delivery? The workflow will be cancelled.")) return;
  stopping.value = true;
  clearTimeout(timer);
  try {
    run.value = await $fetch<Delivery>(`/factory/delivery/${encodeURIComponent(run.value.id)}/cancel`, { method: "POST", retry: 0 });
  } catch {
    error.value = "Cancellation is unconfirmed. Reconnect to check the same run.";
  } finally {
    stopping.value = false;
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
function copyLabel(value: string) {
  return copiedEvidence.value === value ? "Copied" : "Copy";
}
async function copyEvidence(value: string) {
  try {
    if (!await copyText(value)) throw new Error("Clipboard unavailable");
    copiedEvidence.value = value;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copiedEvidence.value = undefined; }, 1800);
  } catch {
    error.value = "Could not copy that value. Expand the technical evidence to select it.";
  }
}

watch(() => route.query.delivery, async (id) => {
  clearTimeout(timer);
  if (typeof id !== "string") return;
  reconciliation.value = undefined;
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
  clearTimeout(copyTimer);
});
</script>

<template>
  <section class="panel delivery-panel">
    <div class="panel-heading delivery-heading">
      <div>
        <p class="delivery-eyebrow"><UIcon name="i-lucide-workflow" aria-hidden="true" /> Durable workflow</p>
        <h2>Build and review loop</h2>
      </div>
      <div class="delivery-heading-badges">
        <UBadge :color="phaseInfo.color" variant="soft">{{ phaseInfo.label }}</UBadge>
        <UBadge v-if="run?.phase === 'blocked' && run.failure" :color="run.failure.retryable ? 'warning' : 'neutral'" variant="soft">
          {{ run.failure.kind }} · {{ run.failure.retryable ? 'retryable' : 'not retryable' }}
        </UBadge>
      </div>
    </div>
    <p class="delivery-path-label">Durable execution</p>
    <p class="delivery-intro">The worker creates a PR, an independent agent reviews it, and findings return to the branch owner. Choose this path when you want the handoffs and revision loop to remain visible while the workflow continues after you leave the page.</p>
    <div v-if="run?.request?.brief" class="delivery-brief">
      <p class="delivery-brief-label">Agent brief</p>
      <p class="delivery-brief-text">{{ run.request.brief }}</p>
    </div>

    <ClientOnly>
      <CockpitFlow
        id="delivery-observability"
        title="Delivery workflow"
        :description="run ? 'Live phase and handoff state from the durable delivery snapshot.' : mode === 'compose' ? 'A preview of the handoffs that will be observed once you start a delivery.' : 'Select a delivery from Recent work to follow its live handoffs.'"
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
    <p v-if="run" class="delivery-id">Delivery <code>{{ shortIdentifier(run.id) }}</code> · cycle {{ run.cycle }}<template v-if="run.publication?.targetBranch"> · target {{ shortIdentifier(run.publication.targetBranch, 24) }}</template></p>
    <p v-if="run && usageLabel" class="delivery-usage">Model usage · {{ usageLabel }}</p>
    <details v-if="run" class="technical-evidence"><summary>Technical evidence</summary><dl><div><dt>Delivery ID</dt><dd><code>{{ run.id }}</code><UButton size="xs" variant="ghost" @click="copyEvidence(run.id)">{{ copyLabel(run.id) }}</UButton></dd></div><div v-if="run.publication?.targetBranch"><dt>Target branch</dt><dd><code>{{ run.publication.targetBranch }}</code><UButton size="xs" variant="ghost" @click="copyEvidence(run.publication.targetBranch)">{{ copyLabel(run.publication.targetBranch) }}</UButton></dd></div><div><dt>Cycle</dt><dd>{{ run.cycle }}</dd></div></dl></details>
    <p v-if="run?.mergeDecision" class="delivery-note">{{ run.mergeDecision.reason }}</p>
    <p v-if="run?.error" class="delivery-error" role="alert">{{ run.error }}</p>
    <p v-if="run?.review" class="delivery-note">{{ run.review.summary }}</p>
    <VisualReviewPanel v-if="run?.review" :packet="run.review.visualReview" :binding="visualReviewBinding" />

    <div class="delivery-actions">
      <UButton v-if="mode === 'compose' && !run" :disabled="!title.trim() || !briefReady || working || stopping" :loading="working" icon="i-lucide-play" @click="start">Start durable delivery</UButton>
      <UButton v-if="run?.publication" :to="run.publication.url" target="_blank" rel="noopener noreferrer" variant="outline" icon="i-lucide-git-pull-request">Open PR #{{ run.publication.number }}</UButton>
      <UButton v-if="run?.publication && reconcilable.has(run.phase)" variant="outline" :loading="reconciling" :disabled="working || reconciling" icon="i-lucide-shield-check" @click="reconcile">Check manual merge</UButton>
      <UButton v-if="run && (run.phase === 'blocked' || (run.phase === 'human_review' && !run.publication))" variant="outline" :disabled="working" icon="i-lucide-rotate-ccw" @click="resume">Resume observation</UButton>
      <UButton v-else-if="run" variant="outline" :loading="working" icon="i-lucide-refresh-cw" @click="refresh">Refresh status</UButton>
      <UButton v-if="run && !stopped.has(run.phase)" variant="ghost" color="neutral" :loading="stopping" :disabled="working || stopping" @click="cancel">Stop delivery</UButton>
    </div>
    <UAlert v-if="reconciliation" :color="reconciliation.eligible ? 'success' : 'warning'" variant="soft" title="Manual merge evidence" :description="reconciliation.reason" />
    <p v-if="mode === 'compose'" class="delivery-requirement" :class="{ ready: briefReady }" role="status">A durable delivery needs at least {{ MIN_WORK_REQUEST_LENGTH }} characters in the brief ({{ briefLength }}/{{ MIN_WORK_REQUEST_LENGTH }}).</p>
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
.delivery-heading-badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.delivery-heading h2 { margin: 0; font-size: 22px; font-weight: 600; text-wrap: balance; }
.delivery-eyebrow { display: flex; align-items: center; gap: 7px; margin: 0 0 7px; color: var(--ui-primary); font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
.delivery-intro { max-width: 850px; margin: 0; color: var(--ui-text-muted); line-height: 1.65; }
.delivery-brief { margin-top: 18px; padding: 14px 16px; border-left: 3px solid var(--ui-primary); background: #f5fbfb; }
.delivery-brief-label { margin: 0 0 5px; color: var(--ui-primary); font-size: 10px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; }
.delivery-brief-text { margin: 0; color: var(--ui-text); line-height: 1.6; white-space: pre-wrap; }
.delivery-path-label { margin: 18px 0 6px; color: var(--ui-primary); font-size: 10px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; }
.delivery-requirement { margin: 10px 0 0; color: #a33d37; font-size: 12px; }
.delivery-requirement.ready { color: #28765b; }
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
.delivery-usage { margin: 8px 0 0; color: var(--ui-text-muted); font-size: 12px; }
.delivery-id { color: var(--ui-text-muted); overflow-wrap: anywhere; }
.technical-evidence { margin: 16px 0 0; padding: 12px 14px; border: 1px solid var(--ui-border); border-radius: 6px; background: var(--ui-bg-muted); font-size: 12px; }
.technical-evidence summary { cursor: pointer; font-weight: 600; }
.technical-evidence dl { display: grid; gap: 9px; margin: 12px 0 0; }
.technical-evidence dl div { display: grid; grid-template-columns: 110px minmax(0, 1fr); align-items: center; gap: 10px; }
.technical-evidence dt { color: var(--ui-text-muted); }
.technical-evidence dd { display: flex; min-width: 0; align-items: center; gap: 8px; margin: 0; overflow-wrap: anywhere; }
.technical-evidence code { overflow-wrap: anywhere; }
.delivery-note { color: #53666e; }
.delivery-error { color: #a33d37; }
.delivery-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
.revision-request { display: grid; gap: 12px; max-width: 700px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--ui-border); }
@media (max-width: 700px) {
  .delivery-live { align-items: flex-start; flex-wrap: wrap; }
  .delivery-updated { width: 100%; margin-left: 20px; }
}
</style>
