<script setup lang="ts">
import { stationLinkSchema } from "../../utils/work-station";

const route = useRoute();
const router = useRouter();

function hasValue(value: unknown) {
  return Array.isArray(value)
    ? value.some(item => typeof item === "string" && item.length > 0)
    : typeof value === "string" && value.length > 0;
}

const hasDelivery = computed(() => hasValue(route.query.delivery));
const hasStation = computed(() => stationLinkSchema.safeParse(route.query).success);
const hasSelectedRun = computed(() => hasDelivery.value || hasStation.value);

onMounted(() => {
  const query = { ...route.query };
  let changed = false;
  for (const key of ["section", "investigation"] as const) {
    if (query[key] !== undefined) {
      delete query[key];
      changed = true;
    }
  }
  if (changed) void router.replace({ path: "/work/run", query });
});
</script>

<template>
  <AdeoPageHeader
    eyebrow="WORKSPACE · CURRENT RUN"
    title="Follow the current run"
    :description="hasSelectedRun ? 'This page is reserved for the selected delivery or station run. Its composer lives on New draft.' : 'Select a run from Recent work to follow its live handoffs and decisions.'"
  >
    <template #actions>
      <UButton to="/work/new" icon="i-lucide-file-pen-line">New draft</UButton>
      <UButton to="/work/recent" color="neutral" variant="outline" icon="i-lucide-history">Recent work</UButton>
    </template>
  </AdeoPageHeader>

  <section v-if="!hasSelectedRun" class="empty-run panel">
    <UIcon name="i-lucide-workflow" aria-hidden="true" />
    <div>
      <h2>No run selected</h2>
      <p class="muted">Open a delivery or station run from Recent work. Start a new one from New draft.</p>
      <div class="empty-run-actions">
        <UButton to="/work/recent" icon="i-lucide-history">Open recent work</UButton>
        <UButton to="/work/new" color="neutral" variant="outline">Create a draft</UButton>
      </div>
    </div>
  </section>

  <template v-else>
    <WorkActions v-if="hasStation" />
    <DeliveryLoop v-if="hasDelivery" mode="run" />
  </template>
</template>

<style scoped>
.empty-run {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-top: 30px;
  padding: 24px;
}
.empty-run > svg {
  flex: 0 0 auto;
  color: var(--ui-primary);
  font-size: 22px;
}
.empty-run h2 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
}
.empty-run p {
  margin: 0;
}
.empty-run-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}
</style>
