<script setup lang="ts">
import { attentionPhases, isLoopRun, summarizeDelivery, type DeliverySummary } from "../utils/delivery-summary";
import { cockpitFailureMessage } from "../utils/cockpit-errors";
const cockpit = useCockpit();
const props = withDefaults(defineProps<{ showHeading?: boolean }>(), { showHeading: true });
const error = ref("");
const historyLoading = ref(false);
const historyLoaded = ref(false);
const lastRefreshed = ref<Date>();
const route = useRoute();
const runs = computed(() => cockpit.items.value.runs.filter((r) => r.value.station !== "mining"));
const deliveries = ref<Record<string, { status: "loading" | "ready" | "unavailable"; summary?: DeliverySummary }>>({});
function label(run: (typeof runs.value)[number]) {
  const value = run.value as Record<string, unknown>;
  return typeof value.label === "string" && value.label.trim() ? value.label : "Delivery loop";
}
function deliveryFor(id: string) {
  return deliveries.value[id];
}
function attentionReasonFor(id: string) {
  const summary = deliveryFor(id)?.summary;
  if (!summary || !attentionPhases.has(summary.phase) || !summary.attentionReason) return undefined;
  return summary.attentionReason;
}
async function loadDeliveries() {
  const loops = runs.value.filter((run) => isLoopRun(run));
  await Promise.all(loops.map(async (run) => {
    if (deliveries.value[run.id]?.status === "loading") return;
    deliveries.value[run.id] = { status: "loading", summary: deliveries.value[run.id]?.summary };
    try {
      const saved = await $fetch(`/factory/delivery/${encodeURIComponent(run.id)}`, { retry: 0 });
      const summary = summarizeDelivery(saved, label(run));
      deliveries.value[run.id] = summary ? { status: "ready", summary } : { status: "unavailable", summary: deliveries.value[run.id]?.summary };
    } catch {
      deliveries.value[run.id] = { status: "unavailable", summary: deliveries.value[run.id]?.summary };
    }
  }));
}
async function refresh() {
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
function link(run: (typeof runs.value)[number]) {
  const value = run.value as Record<string, unknown>;
  if (value.station === "loop") return { path: "/work/run", query: { delivery: run.id } };
  return {
    path: "/work/run",
    query: {
      station: String(value.station),
      run: run.id,
      operationId: value.operationId as string | undefined,
      deliveryId: value.deliveryId as string | undefined,
      execution: value.execution as string | undefined,
      rootAgent: value.rootAgent as string | undefined,
    },
  };
}
function isSelected(run: (typeof runs.value)[number]) {
  const value = run.value as Record<string, unknown>;
  return value.station === "loop" ? route.query.delivery === run.id : route.query.run === run.id;
}
let refreshTimer: ReturnType<typeof setInterval> | undefined;
onMounted(async () => {
  await refresh();
  refreshTimer = setInterval(() => void refresh(), 10000);
});
onBeforeUnmount(() => clearInterval(refreshTimer));
</script>
<template>
  <section class="panel" style="padding: 24px; margin-top: 24px">
    <div v-if="props.showHeading" class="panel-heading">
      <h2>Recent work</h2>
      <UButton variant="ghost" :loading="historyLoading" :disabled="historyLoading" @click="refresh">Refresh</UButton>
    </div>
    <p v-if="lastRefreshed" class="small muted" role="status">Updated {{ lastRefreshed.toLocaleTimeString() }} · refreshes automatically</p>
    <UAlert v-if="error" color="warning" variant="soft" title="Work history needs attention" :description="error">
      <template #actions><UButton size="xs" variant="outline" :loading="historyLoading" @click="refresh">Retry</UButton></template>
    </UAlert>
    <p v-if="!historyLoaded && !error" role="status" class="muted">Loading shared work history…</p>
    <p v-if="historyLoaded && !runs.length" class="muted">Accepted worker and review runs appear here.</p>
    <ul class="work-history-list">
      <li v-for="run in runs" :key="run.id">
        <article v-if="(run.value as Record<string, unknown>).station === 'loop'" class="delivery-card" :aria-label="`Delivery: ${label(run)}`">
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
            <p v-if="attentionReasonFor(run.id)" class="muted small">Needs attention: {{ attentionReasonFor(run.id) }}</p>
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
            <NuxtLink :to="link(run)" :class="{ selected: isSelected(run) }" :aria-current="isSelected(run) ? 'page' : undefined">Open delivery</NuxtLink>
          </div>
        </article>
        <NuxtLink v-else :to="link(run)" :class="{ selected: isSelected(run) }" :aria-current="isSelected(run) ? 'page' : undefined">{{ (run.value as Record<string, unknown>).label }} · {{ (run.value as Record<string, unknown>).station }}</NuxtLink>
      </li>
    </ul>
  </section>
</template>
<style scoped>
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
