<script setup lang="ts">
import { parsePullRequest, stationLinkSchema, stationSessionSchema, workerRequest, stationLaunchError, type StationKind, type StationLink } from "../utils/work-station";
const props = defineProps<{ title: string; brief: string }>();
const route = useRoute();
const router = useRouter();
const pr = ref("");
const workMode = ref<"create" | "revise" | "contribute">("create");
const parentPr = ref("");
const workModes = [
  { label: "Create work", value: "create" },
  { label: "Revise existing PR · same owner", value: "revise" },
  { label: "Contribute via child PR · new owner", value: "contribute" },
];
const workLabel = computed(() => workMode.value === "revise" ? "Revise existing PR" : workMode.value === "contribute" ? "Build a child PR" : "Build a PR");
const starting = ref<StationKind>();
const error = ref("");
let pendingLaunch: { key: string; operationId: string } | undefined;
const active = ref<StationLink>();
watch(() => route.query, query => { const linked=stationLinkSchema.safeParse(query); if(linked.success)active.value=linked.data; },{immediate:true});
async function start(station: StationKind) {
  if (starting.value) return;
  error.value = "";
  const prNumber = parsePullRequest(pr.value);
  if (station === "reviewer" && !prNumber) { error.value = "Enter a PR number or a jira-clone GitHub pull-request URL."; return; }
  let request;
  try { request = station === "worker" ? workerRequest(workMode.value, props, parentPr.value) : { path: "/factory/stations/reviewer", body: { prNumber } }; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "Check the draft details."; return; }
  starting.value = station;
  try {
    const body = request.body;
    const key = JSON.stringify({ path: request.path, body });
    if (pendingLaunch?.key !== key) pendingLaunch = { key, operationId: crypto.randomUUID() };
    // Keep this identifier after an uncertain response so retry cannot start a duplicate.
    const response = stationSessionSchema.parse(await $fetch(request.path, { method: "POST", body: { ...body, operationId: pendingLaunch.operationId }, retry: 0 }));
    if (request.path === "/factory/stations/revisions" && (response.execution !== "owner" || !response.deliveryId || !response.operationId)) throw new Error("Revision delivery was not identified");
    pendingLaunch = undefined;
    active.value = { station, run: response.sessionId, execution: response.execution, rootAgent:response.rootAgent, deliveryId: response.deliveryId, operationId: station === "worker" ? response.operationId : undefined };
    await router.replace({ query: { ...route.query, ...active.value } });
  } catch (cause) { error.value = stationLaunchError(cause); }
  finally { starting.value = undefined; }
}
</script>

<template>
  <section class="work-stations">
    <div class="station-actions">
      <UCard>
        <template #header><h2>Work from this draft</h2></template>
        <UFormField label="Work action" name="work-mode"><USelect v-model="workMode" :disabled="!!starting" :items="workModes" class="w-full" /></UFormField>
        <UFormField v-if="workMode !== 'create'" :label="workMode === 'revise' ? 'PR to revise' : 'Parent PR to contribute to'" name="parent-pr" class="parent-pr"><UInput v-model="parentPr" class="w-full" placeholder="PR number or jira-clone GitHub PR URL" /></UFormField>
        <p v-if="title.trim()"><strong>{{ title }}</strong></p><p v-else>Select or write a draft above.</p>
        <p v-if="workMode === 'create'" class="muted">A new worker uses this title and brief to create a branch and draft PR.</p>
        <p v-else-if="workMode === 'revise'" class="muted">The existing branch owner resumes with this brief and updates the same PR. If that owner is busy, the revision queues for the same owner. The branch is never reassigned.</p>
        <p v-else class="muted">A new worker creates its own branch and a child PR targeting the parent PR’s branch. The parent owner keeps control of the parent branch.</p>
        <p class="muted">Each action starts an agent run. PRs stay open for manual review and merge.</p>
        <template #footer><UButton icon="i-lucide-git-pull-request" :disabled="!brief.trim() || (workMode !== 'revise' && !title.trim()) || (workMode !== 'create' && !parentPr.trim()) || !!starting" :loading="starting === 'worker'" @click="start('worker')">{{ workLabel }}</UButton></template>
      </UCard>
      <UCard>
        <template #header><h2>Review a PR</h2></template>
        <form @submit.prevent="start('reviewer')"><UFormField label="jira-clone PR number or URL" name="pr"><UInput v-model="pr" class="w-full" placeholder="2 or https://github.com/…/pull/2" /></UFormField><p class="muted">A separate reviewer inspects the exact PR head and records findings. It does not merge.</p><UButton type="submit" icon="i-lucide-scan-search" :disabled="!pr.trim() || !!starting" :loading="starting === 'reviewer'">Review PR</UButton></form>
      </UCard>
    </div>
    <UAlert v-if="error" color="error" variant="soft" title="Station not started" :description="error" />
    <ClientOnly><WorkRun v-if="active" :key="`${active.run}:${active.operationId || ''}`" :session-id="active.run" :station="active.station" :execution="active.execution" :root-agent="active.rootAgent" :delivery-id="active.deliveryId" :operation-id="active.operationId" /></ClientOnly>
  </section>
</template>
<style scoped>
.work-stations { margin:36px 0; }
.station-actions { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; }
.parent-pr { margin-top:16px; }
h2 { font-size:22px; font-weight:600; }
p { margin:12px 0; line-height:1.6; }
@media(max-width:900px) { .station-actions { grid-template-columns:1fr; } }
</style>
