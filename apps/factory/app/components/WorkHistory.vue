<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { CockpitRecord } from "../../shared/cockpit";
import { attentionPhases, summarizeDelivery, type DeliverySummary } from "../utils/delivery-summary";
import { cockpitFailureMessage } from "../utils/cockpit-errors";

type HistoryStation = "worker" | "reviewer" | "loop";
type HistoryExecution = "owner" | "dispatcher" | "direct";
type HistoryRootAgent = "task-miner" | "worker" | "reviewer";

type HistoryRun = {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  value: {
    label: string;
    station: HistoryStation;
    operationId?: string;
    execution?: HistoryExecution;
    rootAgent?: HistoryRootAgent;
    deliveryId?: string;
  };
};

type DeliveryState = {
  status: "loading" | "ready" | "unavailable";
  summary?: DeliverySummary;
};

function parseHistoryRun(record: CockpitRecord): HistoryRun | undefined {
  const value = record.value;
  if (value.station === "mining") return undefined;
  if (value.station !== "worker" && value.station !== "reviewer" && value.station !== "loop") {
    return undefined;
  }

  const label = typeof value.label === "string" && value.label.trim()
    ? value.label
    : value.station === "loop" ? "Delivery loop" : "Station run";
  const execution = value.execution === "owner" || value.execution === "dispatcher" || value.execution === "direct"
    ? value.execution
    : undefined;
  const rootAgent = value.rootAgent === "task-miner" || value.rootAgent === "worker" || value.rootAgent === "reviewer"
    ? value.rootAgent
    : undefined;

  return {
    id: record.id,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    value: {
      label,
      station: value.station,
      ...(typeof value.operationId === "string" ? { operationId: value.operationId } : {}),
      ...(execution ? { execution } : {}),
      ...(rootAgent ? { rootAgent } : {}),
      ...(typeof value.deliveryId === "string" ? { deliveryId: value.deliveryId } : {}),
    },
  };
}

const cockpit = useCockpit();
const props = withDefaults(defineProps<{ showHeading?: boolean }>(), { showHeading: true });
const error = ref("");
const historyLoading = ref(false);
const historyLoaded = ref(false);
const lastRefreshed = ref<Date>();
const route = useRoute();
const runs = computed<HistoryRun[]>(() =>
  cockpit.items.value.runs.flatMap((record) => {
    const parsed = parseHistoryRun(record);
    return parsed ? [parsed] : [];
  }),
);
const deliveries = ref<Record<string, DeliveryState>>({});
const actionLoading = ref<string>();

function label(run: HistoryRun): string {
  return run.value.label;
}

function deliveryFor(id: string): DeliveryState | undefined {
  return deliveries.value[id];
}

function summaryFor(id: string): DeliverySummary | undefined {
  return deliveryFor(id)?.summary;
}

function isAttentionRun(run: HistoryRun): boolean {
  const summary = summaryFor(run.id);
  return !!summary && attentionPhases.has(summary.phase);
}

const orderedRuns = computed(() =>
  [...runs.value].sort(
    (left, right) => Number(isAttentionRun(right)) - Number(isAttentionRun(left)),
  ),
);
const attentionCount = computed(() => orderedRuns.value.filter(isAttentionRun).length);

function canResume(run: HistoryRun): boolean {
  const summary = summaryFor(run.id);
  return !!summary && (summary.phase === "blocked" || (summary.phase === "human_review" && !summary.prUrl));
}

function canRevise(run: HistoryRun): boolean {
  const summary = summaryFor(run.id);
  return !!summary?.prUrl && ["human_review", "needs_revision", "blocked"].includes(summary.phase);
}

function attentionReasonFor(id: string): string | undefined {
  const summary = deliveryFor(id)?.summary;
  if (!summary || !attentionPhases.has(summary.phase) || !summary.attentionReason) return undefined;
  return summary.attentionReason;
}

function setDelivery(id: string, state: DeliveryState): void {
  deliveries.value = { ...deliveries.value, [id]: state };
}

async function loadDeliveries(): Promise<void> {
  const loops = runs.value.filter((run) => run.value.station === "loop");
  await Promise.all(loops.map(async (run) => {
    const previous = deliveryFor(run.id);
    if (previous?.status === "loading") return;
    setDelivery(run.id, { status: "loading", summary: previous?.summary });
    try {
      const saved = await $fetch<unknown>(`/factory/delivery/${encodeURIComponent(run.id)}`, { retry: 0 });
      let current = saved;
      try {
        current = await $fetch(`/factory/delivery/${encodeURIComponent(run.id)}/reconcile`, { retry: 0 });
      } catch {
        // Keep the saved delivery summary visible when GitHub is temporarily unavailable.
      }
      const summary = summarizeDelivery(current, label(run));
      setDelivery(run.id, summary ? { status: "ready", summary } : { status: "unavailable", summary: deliveryFor(run.id)?.summary });
    } catch {
      setDelivery(run.id, { status: "unavailable", summary: deliveryFor(run.id)?.summary });
    }
  }));
}

async function refresh(): Promise<void> {
  if (historyLoading.value) return;
  historyLoading.value = true;
  try {
    await cockpit.refresh("runs");
    historyLoaded.value = true;
    error.value = "";
    await loadDeliveries();
    lastRefreshed.value = new Date();
  } catch (cause) {
    error.value = cockpitFailureMessage(cause, "Shared work history");
  } finally {
    historyLoading.value = false;
  }
}

async function resumeDelivery(run: HistoryRun): Promise<void> {
  if (actionLoading.value || !canResume(run)) return;
  actionLoading.value = run.id;
  error.value = "";
  try {
    await $fetch(`/factory/delivery/${encodeURIComponent(run.id)}/resume`, { method: "POST", body: { operationId: crypto.randomUUID() }, retry: 0 });
    await refresh();
  } catch (cause) {
    error.value = cockpitFailureMessage(cause, "This delivery");
  } finally {
    actionLoading.value = undefined;
  }
}
function link(run: HistoryRun) {
  if (run.value.station === "loop") return { path: "/work/run", query: { delivery: run.id } };
  return {
    path: "/work/run",
    query: {
      station: run.value.station,
      run: run.id,
      operationId: run.value.operationId,
      deliveryId: run.value.deliveryId,
      execution: run.value.execution,
      rootAgent: run.value.rootAgent,
    },
  };
}

function isSelected(run: HistoryRun): boolean {
  return run.value.station === "loop" ? route.query.delivery === run.id : route.query.run === run.id;
}
cockpit.watchCollection("runs", {
  intervalMs: 10_000,
  onRefresh() {
    historyLoaded.value = true;
    error.value = "";
    void loadDeliveries().then(() => { lastRefreshed.value = new Date(); });
  },
  onError(cause) {
    error.value = cockpitFailureMessage(cause, "Shared work history");
  },
});
onMounted(() => void refresh());
</script>
<template>
  <section class="panel history-panel">
    <div v-if="props.showHeading" class="panel-heading">
      <div class="history-heading"><h2>Recent work</h2><UBadge :color="attentionCount ? 'warning' : 'neutral'" variant="soft">{{ attentionCount }} need attention</UBadge></div>
      <UButton variant="ghost" :loading="historyLoading" :disabled="historyLoading" @click="refresh">Refresh</UButton>
    </div>
    <p v-if="lastRefreshed" class="small muted" role="status">Updated {{ lastRefreshed.toLocaleTimeString() }} · refreshes automatically</p>
    <UAlert v-if="error" color="warning" variant="soft" title="Work history needs attention" :description="error">
      <template #actions><UButton size="xs" variant="outline" :loading="historyLoading" @click="refresh">Retry</UButton></template>
    </UAlert>
    <p v-if="!historyLoaded && !error" role="status" class="muted">Loading shared work history…</p>
    <p v-if="historyLoaded && !runs.length" class="muted">Accepted worker and review runs appear here.</p>
    <ul class="work-history-list">
      <li v-for="run in orderedRuns" :key="run.id">
        <article v-if="run.value.station === 'loop'" class="delivery-card" :aria-label="`Delivery: ${label(run)}`">
          <div class="delivery-heading">
            <h3>{{ deliveryFor(run.id)?.summary?.title ?? label(run) }}</h3>
            <UBadge v-if="deliveryFor(run.id)?.status === 'ready'" :color="deliveryFor(run.id)?.summary?.phaseColor" variant="soft">{{ deliveryFor(run.id)?.summary?.phaseLabel }}</UBadge>
            <UBadge v-else color="neutral" variant="soft">{{ deliveryFor(run.id)?.status === "loading" ? "Checking…" : "Delivery" }}</UBadge>
            <UBadge v-if="deliveryFor(run.id)?.status === 'ready' && deliveryFor(run.id)?.summary?.phase === 'blocked' && deliveryFor(run.id)?.summary?.failureKind" :color="deliveryFor(run.id)?.summary?.failureRetryable ? 'warning' : 'neutral'" variant="soft">
              {{ deliveryFor(run.id)?.summary?.failureKind }} · {{ deliveryFor(run.id)?.summary?.failureRetryable ? 'retryable' : 'not retryable' }}
            </UBadge>
          </div>
          <p v-if="deliveryFor(run.id)?.status === 'loading'" role="status" class="muted small">Checking delivery status…</p>
          <template v-else-if="deliveryFor(run.id)?.status === 'ready' && deliveryFor(run.id)?.summary">
            <p class="muted small">{{ deliveryFor(run.id)?.summary?.updatedLabel }}<template v-if="deliveryFor(run.id)?.summary?.targetBranch"> · Target {{ deliveryFor(run.id)?.summary?.targetBranch }}</template></p>
            <p v-if="deliveryFor(run.id)?.summary?.usageLabel" class="muted small">Model usage · {{ deliveryFor(run.id)?.summary?.usageLabel }}</p>
            <p v-if="deliveryFor(run.id)?.summary?.phase === 'awaiting_input' && deliveryFor(run.id)?.summary?.question" class="muted small">Waiting for you: {{ deliveryFor(run.id)?.summary?.question }}</p>
            <p v-else-if="attentionReasonFor(run.id)" class="muted small">Needs attention: {{ attentionReasonFor(run.id) }}</p>
          </template>
          <p v-else class="muted small">Delivery details are unavailable. The saved run link still works.</p>
          <div class="delivery-actions">
            <UButton
              v-if="deliveryFor(run.id)?.summary?.prUrl"
              :to="deliveryFor(run.id)?.summary?.prUrl"
              target="_blank"
              rel="noopener noreferrer"
              size="xs"
              variant="outline"
              icon="i-lucide-git-pull-request"
              >Open PR #{{ deliveryFor(run.id)?.summary?.prNumber }}</UButton>
            <UButton v-if="canResume(run)" size="xs" color="warning" variant="outline" :loading="actionLoading === run.id" :disabled="!!actionLoading" icon="i-lucide-rotate-ccw" @click="resumeDelivery(run)">Resume</UButton>
            <UButton v-if="canRevise(run)" size="xs" color="neutral" variant="outline" :to="link(run)" icon="i-lucide-message-square-more">Revise</UButton>
            <UButton size="xs" variant="outline" :to="link(run)" :class="{ selected: isSelected(run) }" :aria-current="isSelected(run) ? 'page' : undefined" icon="i-lucide-arrow-right">Open</UButton>
          </div>
        </article>
        <NuxtLink v-else :to="link(run)" :class="{ selected: isSelected(run) }" :aria-current="isSelected(run) ? 'page' : undefined">{{ run.value.label }} · {{ run.value.station }}</NuxtLink>
      </li>
    </ul>
  </section>
</template>
<style scoped>
.history-panel {
  padding: 24px;
  margin-top: 24px;
}

.work-history-list {
  display: grid;
  gap: 12px;
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
}
.delivery-card {
  border: 1px solid var(--ui-border);
  border-radius: 4px;
  padding: 16px;
  display: grid;
  gap: 8px;
}
.delivery-card h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}
.history-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.history-heading h2 {
  margin: 0;
}
.delivery-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.delivery-card p {
  margin: 0;
}
.delivery-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.delivery-actions a:not(.u-button) {
  color: var(--ui-primary);
  text-decoration: underline;
  font-size: 12px;
}
.work-history-list > li > a.selected,
.delivery-actions a.selected {
  font-weight: 650;
  text-decoration-thickness: 2px;
}
</style>
