<script setup lang="ts">
import { useEveAgent } from "eve/vue";
import { authorizationLink, miningProgress, parseMiningOutput } from "../utils/mining-output";
import { renderReport } from "../utils/report";
const props = defineProps<{ sessionId?: string }>();
const emit = defineEmits<{ session: [id: string, label: string]; draft: [value: { title: string; body: string }]; new: [] }>();
const focus = ref("");
const actionError = ref("");
const { data, events, status, error, session, send, cancel, resume, reset, respond } = useEveAgent({
  initialSession: props.sessionId ? { sessionId: props.sessionId, streamIndex: 0 } : undefined,
  resume: !!props.sessionId,
  onSessionChange(value) { if (value) emit("session", value.sessionId, focus.value.trim() || "Find the next useful task"); },
});
const authorizations = computed(() => data.value.messages.flatMap(message => message.parts).filter(part => part.type === "authorization"));
const awaitingAuthorization = computed(() => !cancelled.value && !turnEnded.value && authorizations.value.some(part => part.state === "required"));
const busy = computed(() => status.value === "submitted" || status.value === "streaming");
const cancelled = computed(() => events.value.some(event => event.type === "turn.cancelled"));
const turnEnded = computed(() => events.value.some(event => event.type === "turn.completed" || event.type === "turn.failed" || event.type === "session.failed"));
const toolParts = computed(() => data.value.messages.flatMap(message => message.parts).filter(part => part.type === "dynamic-tool"));
const output = computed(() => {
  const last = toolParts.value.filter(part => part.toolName === "investigate_repository" || part.toolName === "record_findings").at(-1);
  return last ? parseMiningOutput(last.output) : undefined;
});
const progress = computed(() => {
  const last = toolParts.value.at(-1);
  return last ? miningProgress(last.toolName, last.output) : "Starting the Eve session";
});
const incomplete = computed(() => output.value?.phase === "Incomplete" || !!output.value?.error);
const toolError = computed(() => data.value.messages.flatMap(message => message.parts).find(part => part.type === "dynamic-tool" && part.state === "output-error"));
const disconnected = computed(() => !!(session.value || props.sessionId) && !busy.value && status.value !== "resuming" && !cancelled.value && !turnEnded.value && !awaitingAuthorization.value && !output.value?.report && !output.value?.error && !toolError.value);
const reportHtml = computed(() => renderReport(output.value?.report || ""));
const pendingRequests = computed(() => data.value.messages.flatMap(message => message.parts.flatMap(part => part.type === "dynamic-tool" && part.state === "approval-requested" && part.toolMetadata?.eve?.inputRequest ? [part.toolMetadata.eve.inputRequest] : [])));
const summary = computed(() => data.value.messages.filter(message => message.role === "assistant").flatMap(message => message.parts.flatMap(part => part.type === "text" ? [part.text] : [])).join("\n"));
async function start() {
  if (busy.value || status.value === "resuming" || session.value) return;
  actionError.value = "";
  try { await send(focus.value.trim() || "Find the next useful task for our factory."); }
  catch { actionError.value = "Could not start the investigation. Reconnect or start a new one."; }
}
async function stop() { try { await cancel(); } catch { actionError.value = "Cancellation could not be confirmed. Reconnect to check the run."; } }
async function reconnect() { try { await resume(); actionError.value = ""; } catch { actionError.value = "Could not reconnect to this investigation."; } }
async function startNew() {
  try {
    if (session.value || props.sessionId) await reset();
    actionError.value = "";
    emit("new");
  } catch {
    actionError.value = "Could not retire this investigation. Reconnect and try again.";
  }
}
function draft() {
  if (!output.value?.report) return;
  emit("draft", { title: "Review task-mining proposals", body: `${output.value.report}\n\n---\nInvestigation: ${session.value?.sessionId || props.sessionId}\nSource revision: ${output.value.revision}\nCaptured: ${output.value.capturedAt}\n\nInvestigation status: ${output.value.phase}\nThese are proposals for human review, not approved work.` });
}
</script>

<template>
  <div class="panel mining-run">
    <form v-if="!session && !sessionId" @submit.prevent="start">
      <h2>Where should we look?</h2>
      <p class="muted">Leave this open, or give the miner a question to investigate.</p>
      <UFormField label="Focus for this investigation" name="focus"><UTextarea v-model="focus" class="w-full" :rows="4" :maxlength="3000" placeholder="What context is missing before we can safely grow the factory?" :disabled="busy" /></UFormField>
      <div class="mining-actions"><UButton type="submit" icon="i-lucide-search" :loading="busy">Find useful tasks</UButton><span class="small muted">Proposals only · up to three</span></div>
      <p class="small muted">Eve investigates with Muse Spark in a Vercel Sandbox, billed to demo-software-factory. It can inspect source, GitHub and Vercel evidence, and run local checks. It cannot publish changes.</p>
    </form>
    <div v-else>
      <div class="panel-heading"><h2>Investigation</h2><UBadge :color="incomplete ? 'warning' : output?.report ? 'success' : error || toolError ? 'error' : 'primary'" variant="soft">{{ status === 'resuming' ? 'Reconnecting' : awaitingAuthorization ? 'Connection needed' : busy ? 'Running' : incomplete ? 'Incomplete' : output?.report ? 'Ready to review' : cancelled ? 'Stopped' : disconnected ? 'Disconnected' : 'Incomplete' }}</UBadge></div>
      <p v-if="!awaitingAuthorization && (busy || status === 'resuming')" role="status" class="progress"><UIcon name="i-lucide-loader-circle" class="animate-spin" />{{ status === 'resuming' ? 'Restoring the investigation' : progress }}</p>
      <p v-if="busy && !awaitingAuthorization" class="small muted">You can leave this page. Eve continues the investigation and restores its result when you return.</p>
      <section v-for="authorization in authorizations" :key="`${authorization.turnId}-${authorization.stepIndex}-${authorization.name}`" class="connection-request">
        <template v-if="authorization.state === 'required' && awaitingAuthorization">
          <h3>Connect {{ authorization.displayName }}</h3>
          <p>{{ authorization.description }}</p>
          <p v-if="authorization.authorization?.instructions">{{ authorization.authorization.instructions }}</p>
          <p v-if="authorization.authorization?.userCode">Code: <code>{{ authorization.authorization.userCode }}</code></p>
          <UButton v-if="authorizationLink(authorization.authorization?.url)" :to="authorizationLink(authorization.authorization?.url)" target="_blank" rel="noopener noreferrer" icon="i-lucide-external-link">Connect {{ authorization.displayName }}</UButton>
          <p class="small muted">The investigation will continue after you connect. Keep this session open, or return using its link.</p>
        </template>
        <p v-else-if="authorization.state === 'completed'">{{ authorization.displayName }} · {{ authorization.outcome === 'authorized' ? 'Connected' : authorization.outcome }}<span v-if="authorization.reason"> · {{ authorization.reason }}</span></p>
      </section>
      <div v-if="output?.report" class="findings">
        <p class="small muted">Proposals and reflection · {{ output.capturedAt ? new Date(output.capturedAt).toLocaleString() : 'Capture time unavailable' }}</p>
        <UAlert v-if="incomplete" color="warning" variant="soft" title="Context is incomplete" description="Review the evidence gaps before accepting these proposals." />
        <ul v-if="output.contextGaps?.length" class="context-gaps"><li v-for="gap in output.contextGaps" :key="gap">{{ gap }}</li></ul>
        <div class="report rendered-report" v-html="reportHtml" />
        <div class="mining-actions"><UButton icon="i-lucide-file-pen-line" @click="draft">Use findings in a draft</UButton><UButton variant="outline" color="neutral" @click="startNew">New investigation</UButton></div>
        <details class="evidence"><summary>Source evidence · {{ output.files?.length ?? 0 }} files</summary>
          <p v-if="output.revision"><a :href="`https://github.com/software-factory-workshop/jira-clone/tree/${output.revision}`" target="_blank" rel="noopener noreferrer">Revision {{ output.revision?.slice(0, 12) }}</a></p>
          <p v-for="(read, index) in output.githubReads" :key="index">{{ read.resource }}: {{ read.count ?? 'Unknown number of' }} items · {{ read.complete ? 'complete inventory' : 'incomplete' }} · {{ read.capturedAt }}</p>
          <ul v-if="output.revision"><li v-for="file in output.files" :key="file.file"><a :href="`https://github.com/software-factory-workshop/jira-clone/blob/${output.revision}/${file.file}`" target="_blank" rel="noopener noreferrer">{{ file.file }}</a></li></ul>
          <p v-for="(read, index) in output.vercelReads" :key="`vercel-${index}`">Vercel {{ read.resource }} · {{ read.projectId }} · {{ read.complete ? 'available' : 'incomplete' }} · {{ read.capturedAt }}<span v-if="read.summary"> · {{ read.summary }}</span></p>
          <details v-for="(command, index) in output.commands" :key="`command-${index}`" class="command-evidence">
            <summary><code>{{ command.command }}</code> · exit {{ command.exitCode ?? 'unknown' }}</summary>
            <p>{{ command.capturedAt }}<span v-if="command.truncated"> · Output truncated; this is an excerpt.</span></p>
            <pre v-if="command.stdout">{{ command.stdout }}</pre><pre v-if="command.stderr">{{ command.stderr }}</pre>
          </details>
        </details>
      </div>
      <p v-else-if="cancelled" class="report">Investigation stopped before findings were ready.</p>
      <p v-else-if="disconnected" class="report">The live connection ended before a final result arrived. The investigation may still be running. Reconnect to check its state.</p>
      <p v-else-if="!busy && summary" class="report">{{ summary }}</p>
      <div class="mining-actions"><UButton v-if="busy || awaitingAuthorization" variant="outline" color="neutral" @click="stop">Stop investigation</UButton><UButton v-if="error || actionError || disconnected" variant="outline" @click="reconnect">Reconnect</UButton><UButton v-if="!busy && !awaitingAuthorization && !output?.report && status !== 'resuming'" @click="startNew">New investigation</UButton></div>
      <fieldset v-for="request in pendingRequests" :key="request.requestId"><legend>{{ request.prompt }}</legend><UButton v-for="option in request.options || []" :key="option.id" :disabled="status === 'resuming'" @click="respond([{ requestId: request.requestId, optionId: option.id }])">{{ option.label }}</UButton></fieldset>
      <p class="small muted session-id"><a :href="`?investigation=${session?.sessionId || sessionId}`">Open session {{ session?.sessionId || sessionId }}</a></p>
    </div>
    <UAlert v-if="error || actionError || output?.error || (!output?.report && toolError)" color="error" variant="soft" title="Investigation incomplete" :description="actionError || output?.error || 'The run could not complete. Reconnect to check its state, or start a new investigation.'" />
  </div>
</template>

<style scoped>
.mining-run { padding:30px; }
h2 { font-size:22px; font-weight:600; margin-bottom:12px; }
form > p { margin-bottom:22px; }
.mining-actions { display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin:24px 0; }
.progress { display:flex; gap:12px; align-items:center; margin:25px 0 12px; }
.report { white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.75; margin-top:24px; }
.rendered-report { white-space:normal; }
.rendered-report :deep(h2), .rendered-report :deep(h3) { font-weight:650; font-size:21px; margin:32px 0 14px; line-height:1.4; }
.rendered-report :deep(p), .rendered-report :deep(ul), .rendered-report :deep(ol) { margin:14px 0; }
.rendered-report :deep(ul) { list-style:disc; padding-left:24px; }
.rendered-report :deep(ol) { list-style:decimal; padding-left:24px; }
.rendered-report :deep(code) { font-size:0.85em; background:var(--ui-bg-muted); padding:2px 4px; border-radius:3px; }
.rendered-report :deep(a) { color:var(--ui-primary); text-decoration:underline; }
.evidence { border-top:1px solid var(--ui-border); padding-top:22px; margin-top:28px; font-size:14px; }
.evidence summary { cursor:pointer; font-weight:600; }
.evidence p { margin:12px 0; }
.evidence ul { margin-top:18px; max-height:260px; overflow:auto; }
.evidence a { color:var(--ui-primary); text-decoration:underline; }
.connection-request { margin:24px 0; }
.connection-request h3 { font-weight:600; font-size:20px; }
.connection-request p { margin:12px 0; }
.context-gaps { margin:18px 0; padding-left:24px; list-style:disc; }
.command-evidence { margin-top:18px; }
.command-evidence pre { white-space:pre-wrap; overflow-wrap:anywhere; max-height:300px; overflow:auto; background:var(--ui-bg-muted); padding:12px; margin-top:12px; }
.session-id { overflow-wrap:anywhere; margin-top:22px; }
</style>
