<script setup lang="ts">
import { parsePullRequest, stationLinkSchema, stationSessionSchema, type StationKind } from "../utils/work-station";
const props = defineProps<{ title: string; brief: string }>();
const route = useRoute();
const router = useRouter();
const pr = ref("");
const starting = ref<StationKind>();
const error = ref("");
let pendingLaunch: { key: string; operationId: string } | undefined;
const active = ref<{ station: StationKind; run: string }>();
onMounted(() => {
  const linked = stationLinkSchema.safeParse(route.query);
  if (linked.success) active.value = linked.data;
});
async function start(station: StationKind) {
  if (starting.value) return;
  error.value = "";
  const prNumber = parsePullRequest(pr.value);
  if (station === "reviewer" && !prNumber) { error.value = "Enter a PR number or a jira-clone GitHub pull-request URL."; return; }
  if (station === "worker" && (!props.title.trim() || !props.brief.trim())) return;
  starting.value = station;
  try {
    const body = station === "worker" ? { title: props.title.trim(), brief: props.brief.trim() } : { prNumber };
    const key = JSON.stringify({ station, body });
    if (pendingLaunch?.key !== key) pendingLaunch = { key, operationId: crypto.randomUUID() };
    // Keep this identifier after an uncertain response so retry cannot start a duplicate.
    const response = stationSessionSchema.parse(await $fetch(`/factory/stations/${station}`, { method: "POST", body: { ...body, operationId: pendingLaunch.operationId }, retry: 0 }));
    pendingLaunch = undefined;
    active.value = { station, run: response.sessionId };
    await router.replace({ query: { ...route.query, station, run: response.sessionId } });
  } catch { error.value = "The station could not start. Your draft is unchanged; check access and try again."; }
  finally { starting.value = undefined; }
}
</script>

<template>
  <section class="work-stations">
    <div class="station-actions">
      <UCard>
        <template #header><h2>Build from this draft</h2></template>
        <p v-if="title.trim()"><strong>{{ title }}</strong></p><p v-else>Select or write a draft above.</p>
        <p class="muted">The worker uses the current title and brief, implements a bounded change and opens a draft PR. This starts an agent run.</p>
        <template #footer><UButton icon="i-lucide-git-pull-request" :disabled="!title.trim() || !brief.trim() || !!starting" :loading="starting === 'worker'" @click="start('worker')">Build a PR</UButton></template>
      </UCard>
      <UCard>
        <template #header><h2>Review a PR</h2></template>
        <form @submit.prevent="start('reviewer')"><UFormField label="jira-clone PR number or URL" name="pr"><UInput v-model="pr" class="w-full" placeholder="2 or https://github.com/…/pull/2" /></UFormField><p class="muted">A separate reviewer inspects the exact PR head and records findings. It does not merge.</p><UButton type="submit" icon="i-lucide-scan-search" :disabled="!pr.trim() || !!starting" :loading="starting === 'reviewer'">Review PR</UButton></form>
      </UCard>
    </div>
    <UAlert v-if="error" color="error" variant="soft" title="Station not started" :description="error" />
    <ClientOnly><WorkRun v-if="active" :key="active.run" :session-id="active.run" :station="active.station" /></ClientOnly>
  </section>
</template>
<style scoped>
.work-stations { margin:36px 0; }
.station-actions { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; }
h2 { font-size:22px; font-weight:600; }
p { margin:12px 0; line-height:1.6; }
@media(max-width:900px) { .station-actions { grid-template-columns:1fr; } }
</style>
