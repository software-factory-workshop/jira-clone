<script setup lang="ts">
import { useEveAgent } from "eve/vue";
import { parseStationResult, type StationKind } from "../utils/work-station";
import { authorizationLink } from "../utils/mining-output";
const props = defineProps<{ sessionId: string; station: StationKind; child?: boolean }>();
const emit = defineEmits<{ settled: [value: boolean] }>();
const { data, events, status, error, resume } = useEveAgent({ initialSession: { sessionId: props.sessionId, streamIndex: 0 }, resume: true });
const actionError = ref("");
const childSettled = ref(false);
const cancellationRequested = ref(false);
const parts = computed(() => data.value.messages.flatMap(message => message.parts));
const childId = computed(() => {
  if (props.child) return undefined;
  const event = events.value.find(event => event.type === "subagent.called");
  return event?.type === "subagent.called" ? event.data.childSessionId : undefined;
});
const result = computed(() => {
  for (const part of [...parts.value].reverse()) {
    if (part.type !== "dynamic-tool" || !["publish_work", "record_review"].includes(part.toolName)) continue;
    const parsed = parseStationResult(part.output);
    if (parsed && parsed.station === props.station) return parsed;
  }
  return undefined;
});
const active = computed(() => ["submitted", "streaming", "resuming"].includes(status.value));
const stopped = computed(() => events.value.some(event => event.type === "turn.cancelled"));
const ended = computed(() => events.value.some(event => ["turn.completed", "turn.failed", "session.failed"].includes(event.type)));
watch(() => !!result.value || stopped.value || ended.value, value => emit("settled", value), { immediate: true });
const canStop = computed(() => !props.child && (childId.value ? !childSettled.value : active.value && !ended.value));
const authorizations = computed(() => parts.value.filter(part => part.type === "authorization" && part.state === "required"));
const step = computed(() => {
  const part = parts.value.filter(part => part.type === "dynamic-tool").at(-1);
  return part?.toolName.replaceAll("_", " ") || "Preparing the station";
});
const summary = computed(() => data.value.messages.filter(message => message.role === "assistant").flatMap(message => message.parts.flatMap(part => part.type === "text" ? [part.text] : [])).join("\n"));
const label = computed(() => result.value ? result.value.station === "worker" ? "Draft PR created" : result.value.verdict === "approve" ? "Review passed" : result.value.verdict === "changes_requested" ? "Changes requested" : "Review incomplete" : stopped.value ? "Stopped" : authorizations.value.length ? "Connection needed" : active.value ? "Running" : ended.value ? "Incomplete" : "Disconnected");
async function reconnect() { try { actionError.value = ""; await resume(); } catch { actionError.value = "Could not reconnect. Keep the run link to try again."; } }
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
      <p v-if="active && !result && !authorizations.length" role="status">{{ step }}…</p>
      <div v-for="authorization in authorizations" :key="`${authorization.name}-${authorization.stepIndex}`"><p>{{ authorization.description }}</p><p>{{ authorization.authorization?.instructions }}</p><code v-if="authorization.authorization?.userCode">{{ authorization.authorization.userCode }}</code><UButton v-if="authorizationLink(authorization.authorization?.url)" :to="authorizationLink(authorization.authorization?.url)" target="_blank" rel="noopener noreferrer">Connect {{ authorization.displayName }}</UButton></div>
      <template v-if="result">
        <p>{{ result.summary }}</p>
        <template v-if="result.station === 'worker'"><UButton :to="result.publication.url" target="_blank" rel="noopener noreferrer" icon="i-lucide-git-pull-request">Open draft PR #{{ result.publication.number }}</UButton><p class="small muted">Branch {{ result.publication.branch }}<br />Head {{ result.publication.headSha }}<br />Base {{ result.publication.baseSha }}</p><p class="small muted">Use the PR reviewer above for an independent review.</p></template>
        <template v-else><p><a :href="result.url" target="_blank" rel="noopener noreferrer">PR #{{ result.prNumber }}</a> · Reviewed head <code>{{ result.headSha }}</code></p><p class="small muted">{{ result.capturedAt }} · This verdict applies to that exact head. No merge was performed.</p><UCard v-for="(finding, index) in result.findings" :key="index" class="review-finding"><UBadge :color="finding.severity === 'blocking' ? 'error' : 'neutral'" variant="soft">{{ finding.severity }}</UBadge><h3>{{ finding.path }}<span v-if="finding.line">:{{ finding.line }}</span></h3><p>{{ finding.message }}</p><p class="small">Evidence: {{ finding.evidence }}</p></UCard><p v-if="!result.findings.length">No findings were recorded.</p><ul v-if="result.limitations.length"><li v-for="item in result.limitations" :key="item">{{ item }}</li></ul></template>
        <details class="checks"><summary>Command evidence · {{ result.commands.length }} checks</summary><details v-for="(command, index) in result.commands" :key="index"><summary><code>{{ command.command }}</code> · exit {{ command.exitCode }}</summary><p v-if="command.truncated" class="small muted">Output is truncated.</p><pre>{{ command.stdout }}</pre><pre v-if="command.stderr">{{ command.stderr }}</pre></details></details>
      </template>
      <p v-else-if="!active && summary" class="summary">{{ summary }}</p>
      <UAlert v-if="!result && !active && ended && !stopped" color="warning" title="No completed result" description="The station ended without a recorded PR or review result. Inspect the run before trying again." />
      <UButton v-if="error || (!active && !ended && !stopped)" variant="outline" @click="reconnect">Reconnect</UButton>
    </template>
    <WorkRun v-if="childId" :session-id="childId" :station="station" child @settled="childSettled = $event" />
    <div v-if="!child" class="run-actions"><UButton v-if="canStop" color="neutral" variant="outline" @click="stop">Stop {{ station === 'worker' ? 'worker' : 'review' }}</UButton><a :href="`?station=${station}&run=${sessionId}`">Open run {{ sessionId }}</a></div>
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
.review-finding, .run-actions { margin-top:20px; }
ul { padding-left:22px; list-style:disc; }
.summary, pre { white-space:pre-wrap; }
.checks { margin:24px 0; }
.checks details { margin:16px 0; }
summary { cursor:pointer; }
pre { background:var(--ui-bg-muted); padding:12px; max-height:280px; overflow:auto; }
</style>
