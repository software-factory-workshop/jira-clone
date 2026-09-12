<script setup lang="ts">
import { useEveAgent } from "eve/vue";
import { z } from "zod";
import { renderReport } from "../utils/report";
const props = defineProps<{ sessionId?: string }>();
const emit = defineEmits<{ session: [id: string, label: string]; draft: [value: { title: string; body: string }]; new: [] }>();
const focus = ref("");
const actionError = ref("");
const outputSchema = z.object({ phase: z.string(), error: z.string().optional(), report: z.string().optional(), revision: z.string().optional(), capturedAt: z.string().optional(), elapsedMs: z.number().optional(), files: z.array(z.object({ file: z.string(), bytes: z.number(), sha256: z.string() })).optional(), githubReads: z.array(z.object({ resource: z.string(), complete: z.boolean(), capturedAt: z.string(), items: z.array(z.unknown()) })).optional() });
const { data, events, status, error, session, send, cancel, resume, respond } = useEveAgent({
  initialSession: props.sessionId ? { sessionId: props.sessionId, streamIndex: 0 } : undefined,
  resume: !!props.sessionId,
  onSessionChange(value) { if (value) emit("session", value.sessionId, focus.value.trim() || "Find the next useful task"); },
});
const busy = computed(() => status.value === "submitted" || status.value === "streaming");
const cancelled = computed(() => events.value.some(event => event.type === "turn.cancelled"));
const output = computed(() => {
  const parts = data.value.messages.flatMap(message => message.parts).filter(part => part.type === "dynamic-tool" && part.toolName === "investigate_repository");
  const last = parts.at(-1);
  if (!last || last.type !== "dynamic-tool") return undefined;
  const parsed = outputSchema.safeParse(last.output);
  return parsed.success ? parsed.data : undefined;
});
const toolError = computed(() => data.value.messages.flatMap(message => message.parts).find(part => part.type === "dynamic-tool" && part.state === "output-error"));
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
function draft() {
  if (!output.value?.report) return;
  emit("draft", { title: "Review task-mining proposals", body: `${output.value.report}\n\n---\nInvestigation: ${session.value?.sessionId}\nSource revision: ${output.value.revision}\nCaptured: ${output.value.capturedAt}\n\nThese are proposals for human review, not approved work.` });
}
</script>

<template>
  <div class="panel mining-run">
    <form v-if="!session && !sessionId" @submit.prevent="start">
      <h2>Where should we look?</h2>
      <p class="muted">Leave this open, or give the miner a question to investigate.</p>
      <UFormField label="Focus for this investigation" name="focus"><UTextarea v-model="focus" class="w-full" :rows="4" :maxlength="3000" placeholder="What context is missing before we can safely grow the factory?" :disabled="busy" /></UFormField>
      <div class="mining-actions"><UButton type="submit" icon="i-lucide-search" :loading="busy">Find useful tasks</UButton><span class="small muted">Read-only · up to three proposals</span></div>
      <p class="small muted">Runs with Muse Spark in a Vercel Sandbox, billed to demo-software-factory. It can inspect source and GitHub work; it cannot change the repository.</p>
    </form>
    <div v-else>
      <div class="panel-heading"><h2>Investigation</h2><UBadge :color="output?.report ? 'success' : output?.error || error || toolError ? 'error' : 'primary'" variant="soft">{{ status === 'resuming' ? 'Reconnecting' : busy ? 'Running' : output?.report ? 'Ready to review' : output?.error || error || toolError ? 'Incomplete' : 'Stopped' }}</UBadge></div>
      <p v-if="busy || status === 'resuming'" role="status" class="progress"><UIcon name="i-lucide-loader-circle" class="animate-spin" />{{ output?.phase || (status === 'resuming' ? 'Restoring the investigation' : 'Starting the Eve session') }}</p>
      <p v-if="busy" class="small muted">You can leave this page. Eve continues the investigation and restores its result when you return.</p>
      <div v-if="output?.report" class="findings">
        <p class="small muted">Proposals and reflection · {{ new Date(output.capturedAt!).toLocaleString() }}</p>
        <div class="report rendered-report" v-html="reportHtml" />
        <div class="mining-actions"><UButton icon="i-lucide-file-pen-line" @click="draft">Use findings in a draft</UButton><UButton variant="outline" color="neutral" @click="emit('new')">New investigation</UButton></div>
        <details class="evidence"><summary>Source evidence · {{ output.files?.length }} files</summary>
          <p><a :href="`https://github.com/software-factory-workshop/jira-clone/tree/${output.revision}`" target="_blank" rel="noopener noreferrer">Revision {{ output.revision?.slice(0, 12) }}</a></p>
          <p v-for="(read, index) in output.githubReads" :key="index">{{ read.resource }}: {{ read.items.length }} items · {{ read.complete ? 'complete inventory' : 'incomplete' }} · {{ read.capturedAt }}</p>
          <ul><li v-for="file in output.files" :key="file.file"><a :href="`https://github.com/software-factory-workshop/jira-clone/blob/${output.revision}/${file.file}`" target="_blank" rel="noopener noreferrer">{{ file.file }}</a></li></ul>
        </details>
      </div>
      <p v-else-if="cancelled" class="report">Investigation stopped before findings were ready.</p>
      <p v-else-if="!busy && summary" class="report">{{ summary }}</p>
      <div class="mining-actions"><UButton v-if="busy" variant="outline" color="neutral" @click="stop">Stop investigation</UButton><UButton v-if="error || actionError" variant="outline" @click="reconnect">Reconnect</UButton><UButton v-if="!busy && !output?.report && status !== 'resuming'" @click="emit('new')">New investigation</UButton></div>
      <fieldset v-for="request in pendingRequests" :key="request.requestId"><legend>{{ request.prompt }}</legend><UButton v-for="option in request.options || []" :key="option.id" :disabled="status === 'resuming'" @click="respond([{ requestId: request.requestId, optionId: option.id }])">{{ option.label }}</UButton></fieldset>
      <p class="small muted session-id"><a :href="`?investigation=${session?.sessionId || sessionId}`">Open session {{ session?.sessionId || sessionId }}</a></p>
    </div>
    <UAlert v-if="error || actionError || output?.error || toolError" color="error" variant="soft" title="Investigation incomplete" :description="actionError || output?.error || 'The run could not complete. Reconnect to check its state, or start a new investigation.'" />
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
.session-id { overflow-wrap:anywhere; margin-top:22px; }
</style>
