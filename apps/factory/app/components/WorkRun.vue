<script setup lang="ts">
import { useEveAgent, defaultMessageReducer, type EveMessageData } from "eve/vue";
import type { MessageStreamEvent } from "eve/client";
import { dispatchedTask, parseStationToolResult, pendingStationRequests, matchesStationDelivery, latestStationTurn, readStationStream, type StationKind } from "../utils/work-station";
import { authorizationLink } from "../utils/mining-output";
const props = defineProps<{ sessionId: string; station: StationKind; child?: boolean; awaitingDecision?: boolean; execution?: "owner" | "dispatcher"; deliveryId?: string; operationId?: string }>();
const emit = defineEmits<{ settled: [value: boolean]; recorded: [value: boolean] }>();
const { data, events, status, error, resume, respond } = useEveAgent({ initialSession: { sessionId: props.sessionId, streamIndex: 0 }, resume: true });
const actionError = ref("");
const childSettled = ref(false);
const deliveryStarted = ref(false);
const queuedForOwner = computed(() => !!props.deliveryId && !deliveryStarted.value);
const runLink = computed(() => `?${new URLSearchParams({ station: props.station, run: props.sessionId, ...(props.execution ? { execution: props.execution } : {}), ...(props.deliveryId ? { deliveryId: props.deliveryId } : {}), ...(props.operationId ? { operationId: props.operationId } : {}) })}`);
const childRecorded = ref(false);
const cancellationRequested = ref(false);
const discoveredChild = ref<string>();
const discoveryError = ref(false);
let discovery: AbortController | undefined;
const tailData = shallowRef<EveMessageData>();
const tailEvents = shallowRef<MessageStreamEvent[]>([]);
const runEvents = computed(() => tailData.value ? tailEvents.value : events.value);
const answering = ref<string>();
const parts = computed(() => (tailData.value || data.value).messages.flatMap(message => message.parts));
const pendingRequests = computed(() => pendingStationRequests(tailData.value || data.value, !!result.value || childRecorded.value));
const needsDecision = computed(() => !result.value && !childRecorded.value && (!!props.awaitingDecision || pendingRequests.value.length > 0));
const childId = computed(() => {
  if (props.child || props.execution === "owner") return undefined;
  const event = events.value.find(event => event.type === "subagent.called");
  return discoveredChild.value || (event?.type === "subagent.called" ? event.data.childSessionId : undefined);
});
const taskId = computed(() => {
  const part = parts.value.find(part => part.type === "dynamic-tool" && part.toolName === props.station && dispatchedTask(part.output));
  return part?.type === "dynamic-tool" ? dispatchedTask(part.output) : undefined;
});
const awaitingChild = computed(() => !props.child && !!taskId.value && !childId.value && !stopped.value);
async function followChild() {
  if (discovery) return;
  const controller = new AbortController();
  discovery = controller;
  discoveryError.value = false;
  try {
    const reducer = defaultMessageReducer();
    tailData.value = reducer.initial();
    tailEvents.value = [];
    deliveryStarted.value = false;
    // A background task may emit subagent.called after the dispatcher's turn ends.
    // The chat composable stops at that boundary; follow the durable tail directly.
    for await (const event of readStationStream(props.sessionId, controller.signal)) {
      if (props.deliveryId) {
        if (!matchesStationDelivery(event, props.deliveryId, deliveryStarted.value)) continue;
        deliveryStarted.value = true;
      }
      tailEvents.value = [...tailEvents.value, event];
      tailData.value = reducer.reduce(tailData.value, event);
      if (event.type === "subagent.called" && event.data.name === props.station) {
        discoveredChild.value = event.data.childSessionId;
      }
    }
    if (!controller.signal.aborted && !result.value && !stopped.value) discoveryError.value = true;
  } catch { if (!controller.signal.aborted && !result.value && !stopped.value) discoveryError.value = true; }
  finally { controller.abort(); discovery = undefined; }
}
onMounted(() => { void followChild(); });
onBeforeUnmount(() => discovery?.abort());
const result = computed(() => {
  for (const part of [...parts.value].reverse()) {
    if (part.type !== "dynamic-tool" || part.state !== "output-available") continue;
    const parsed = parseStationToolResult(part.toolName, part.output, props.operationId);
    if (parsed && parsed.station === props.station) return parsed;
  }
  return undefined;
});
const turn = computed(() => latestStationTurn(runEvents.value));
const active = computed(() => turn.value === "running" || (!tailData.value && ["submitted", "streaming", "resuming"].includes(status.value)));
const stopped = computed(() => turn.value === "cancelled");
const ended = computed(() => ["completed", "failed"].includes(turn.value));
watch(() => !!result.value, value => emit("recorded", value), { immediate: true });
watch(() => !!result.value || (!needsDecision.value && (stopped.value || (ended.value && !active.value))), value => emit("settled", value), { immediate: true });
const canStop = computed(() => !props.child && !queuedForOwner.value && !result.value && !childRecorded.value && (needsDecision.value || (childId.value ? !childSettled.value : !stopped.value && (!!taskId.value || (active.value && !ended.value)))));
const authorizations = computed(() => parts.value.filter(part => part.type === "authorization" && part.state === "required"));
const step = computed(() => {
  const part = parts.value.filter(part => part.type === "dynamic-tool").at(-1);
  return part?.toolName.replaceAll("_", " ") || "Preparing the station";
});
const summary = computed(() => (tailData.value || data.value).messages.filter(message => message.role === "assistant").flatMap(message => message.parts.flatMap(part => part.type === "text" ? [part.text] : [])).join("\n"));
const label = computed(() => result.value ? result.value.station === "worker" ? props.execution === "owner" ? "PR revised" : "Draft PR created" : result.value.verdict === "approve" ? "Review passed" : result.value.verdict === "changes_requested" ? "Changes requested" : "Review incomplete" : queuedForOwner.value ? "Queued for branch owner" : needsDecision.value ? "Awaiting decision" : stopped.value ? "Stopped" : awaitingChild.value ? "Station dispatched" : authorizations.value.length ? "Connection needed" : active.value ? "Running" : ended.value ? "Incomplete" : "Disconnected");
watch(() => props.awaitingDecision, (waiting, previous) => {
  if (props.child && previous && !waiting && !result.value && !active.value) void reconnect();
});
async function reconnect() { try { actionError.value = ""; if (discoveryError.value || !discovery) await followChild(); else await resume(); } catch { actionError.value = "Could not reconnect. Keep the run link to try again."; } }
async function answer(requestId: string, optionId: string) {
  if (answering.value) return;
  answering.value = requestId;
  try {
    await respond([{ requestId, optionId }]);
  } catch { answering.value = undefined; actionError.value = "Could not submit the decision. Reconnect before trying again."; }
}
watch(pendingRequests, requests => { if (!requests.some(request => request.requestId === answering.value)) answering.value = undefined; });
async function stop() {
  try {
    await $fetch(`/eve/v1/session/${props.sessionId}/cancel`, { method: "POST", body: { tasks: true } });
    cancellationRequested.value = true;
  } catch { actionError.value = "Cancellation could not be confirmed. Reconnect to check the run."; }
}
</script>
<template>
  <div :class="{ 'panel station-run': !child }">
    <template v-if="!childId">
      <div class="run-heading"><h2>{{ station === 'worker' ? 'Worker' : 'PR reviewer' }}</h2><UBadge :color="result && (result.station === 'worker' || result.verdict === 'approve') ? 'success' : 'neutral'" variant="soft">{{ label }}</UBadge></div>
      <p v-if="queuedForOwner" role="status">Waiting for the existing branch owner to begin this revision. Earlier results belong to earlier work.</p>
      <p v-else-if="awaitingChild" role="status">Waiting for the {{ station === 'worker' ? 'worker' : 'reviewer' }} session. The task has been dispatched.</p>
      <p v-else-if="active && !result && !authorizations.length && !needsDecision" role="status">{{ step }}…</p>
      <div v-for="authorization in authorizations" :key="`${authorization.name}-${authorization.stepIndex}`"><p>{{ authorization.description }}</p><p>{{ authorization.authorization?.instructions }}</p><code v-if="authorization.authorization?.userCode">{{ authorization.authorization.userCode }}</code><UButton v-if="authorizationLink(authorization.authorization?.url)" :to="authorizationLink(authorization.authorization?.url)" target="_blank" rel="noopener noreferrer">Connect {{ authorization.displayName }}</UButton></div>
      <template v-if="result">
        <p>{{ result.summary }}</p>
        <template v-if="result.station === 'worker'"><UButton :to="result.publication.url" target="_blank" rel="noopener noreferrer" icon="i-lucide-git-pull-request">Open {{ execution === 'owner' ? 'PR' : 'draft PR' }} #{{ result.publication.number }}</UButton><p class="small muted">Branch {{ result.publication.branch }}<br />Head {{ result.publication.headSha }}<br />Base {{ result.publication.baseSha }}<template v-if="result.publication.targetBranch"><br />PR target {{ result.publication.targetBranch }}<span v-if="result.publication.parentPrNumber"> · parent PR #{{ result.publication.parentPrNumber }}</span></template><template v-if="result.publication.ownerSessionId"><br />Branch owner {{ result.publication.ownerSessionId }}</template></p><p class="small muted">Use the PR reviewer above for an independent review.</p></template>
        <template v-else><p><a :href="result.url" target="_blank" rel="noopener noreferrer">PR #{{ result.prNumber }}</a> · Reviewed head <code>{{ result.headSha }}</code></p><p class="small muted">{{ result.capturedAt }} · This verdict applies to that exact head. No merge was performed.</p><UCard v-for="(finding, index) in result.findings" :key="index" class="review-finding"><UBadge :color="finding.severity === 'blocking' ? 'error' : 'neutral'" variant="soft">{{ finding.severity }}</UBadge><h3>{{ finding.path }}<span v-if="finding.line">:{{ finding.line }}</span></h3><p>{{ finding.message }}</p><p class="small">Evidence: {{ finding.evidence }}</p></UCard><p v-if="!result.findings.length">No findings were recorded.</p><ul v-if="result.limitations.length"><li v-for="item in result.limitations" :key="item">{{ item }}</li></ul></template>
        <details class="checks"><summary>Command evidence · {{ result.commands.length }} checks</summary><details v-for="(command, index) in result.commands" :key="index"><summary><code>{{ command.command }}</code> · exit {{ command.exitCode }}</summary><p v-if="command.truncated" class="small muted">Output is truncated.</p><pre>{{ command.stdout }}</pre><pre v-if="command.stderr">{{ command.stderr }}</pre></details></details>
      </template>
      <p v-else-if="!active && summary" class="summary">{{ summary }}</p>
      <UAlert v-if="!result && !active && ended && !stopped && !awaitingChild && !needsDecision" color="warning" title="No completed result" description="The station ended without a recorded PR or review result. Inspect the run before trying again." />
      <UButton v-if="!result && (error || discoveryError || (!active && !ended && !stopped))" variant="outline" @click="reconnect">Reconnect</UButton>
    </template>
    <fieldset v-for="request in pendingRequests" :key="request.requestId" class="decision"><legend>Awaiting decision</legend><p>{{ request.prompt }}</p><UButton v-for="option in request.options || []" :key="option.id" :color="option.style === 'danger' ? 'error' : 'primary'" :disabled="!!answering" @click="answer(request.requestId, option.id)">{{ option.label }}</UButton><p class="small muted">This decision applies to the existing station run. No option is selected automatically.</p></fieldset>
    <WorkRun v-if="childId" :session-id="childId" :station="station" :awaiting-decision="needsDecision" child @settled="childSettled = $event" @recorded="childRecorded = $event" />
    <div v-if="!child" class="run-actions"><UButton v-if="childId && discoveryError && !childRecorded" variant="outline" @click="reconnect">Reconnect decisions</UButton><UButton v-if="canStop" color="neutral" variant="outline" @click="stop">Stop {{ station === 'worker' ? 'worker' : 'review' }}</UButton><a :href="runLink">Open run {{ sessionId }}</a></div>
    <p v-if="cancellationRequested && canStop" role="status">Cancellation requested. Waiting for the station to stop.</p>
    <UAlert v-if="actionError" color="warning" title="Action not completed" :description="actionError" />
  </div>
</template>
<style scoped>
.station-run { padding:28px; margin-top:24px; overflow-wrap:anywhere; }
.run-heading, .run-actions { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
h2 { font-size:22px; font-weight:600; }
h3 { font-weight:600; margin-top:10px; }
p { line-height:1.65; margin:16px 0; }
a { color:var(--ui-primary); text-decoration:underline; }
.decision { border:1px solid var(--ui-border); padding:18px; margin:20px 0; }
.decision legend { font-weight:600; padding:0 8px; }
.decision button { margin-right:12px; }
.review-finding, .run-actions { margin-top:20px; }
ul { padding-left:22px; list-style:disc; }
.summary, pre { white-space:pre-wrap; }
.checks { margin:24px 0; }
.checks details { margin:16px 0; }
summary { cursor:pointer; }
pre { background:var(--ui-bg-muted); padding:12px; max-height:280px; overflow:auto; }
</style>
