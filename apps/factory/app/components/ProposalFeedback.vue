<script setup lang="ts">
import { feedbackKeyFor,loadFeedback,type FeedbackVerdict } from "../utils/proposal-feedback";
const props=defineProps<{proposalId?:string;proposalTitle:string}>();
const cockpit=useCockpit();const reasonDraft=ref("");const storageProblem=ref("");const saveProblem=ref(false);const busy=ref(false);
const feedbackId=computed(()=>feedbackKeyFor(props.proposalId));
const saved=computed(()=>cockpit.items.value.feedback.find(r=>r.id===feedbackId.value));
const verdict=computed(()=>saved.value?.value.verdict as FeedbackVerdict|undefined);
const reasonChanged=computed(()=>reasonDraft.value.trim()!==(saved.value?.value.reason??""));
async function refresh(){try{await cockpit.refresh("feedback");storageProblem.value="";}catch{storageProblem.value="unavailable";}}
async function choose(value:FeedbackVerdict){if(!feedbackId.value||busy.value)return;busy.value=true;try{await cockpit.save("feedback",feedbackId.value,{verdict:value,reason:reasonDraft.value.trim()},saved.value?.version??0);saveProblem.value=false;storageProblem.value="";}catch{saveProblem.value=true;}finally{busy.value=false;}}
async function saveReason(){if(verdict.value)await choose(verdict.value);}
async function clear(){if(!saved.value||busy.value)return;busy.value=true;try{await cockpit.remove("feedback",saved.value);reasonDraft.value="";saveProblem.value=false;}catch{saveProblem.value=true;}finally{busy.value=false;}}
onMounted(async()=>{const initialId=feedbackId.value;try{let legacy={};try{legacy=loadFeedback(localStorage).entries;}catch{}await cockpit.migrate("feedback",Object.entries(legacy).map(([id,value])=>({id,value:value as Record<string,unknown>})).map(r=>({id:r.id,value:{verdict:r.value.verdict,reason:r.value.reason}})));if(feedbackId.value===initialId&&!reasonDraft.value)reasonDraft.value=String(saved.value?.value.reason??"");storageProblem.value="";}catch{storageProblem.value="unavailable";}});
watch(feedbackId,()=>{reasonDraft.value=String(saved.value?.value.reason??"");saveProblem.value=false;});
</script>

<template>
  <section v-if="feedbackId" class="proposal-feedback" :aria-label="`Usefulness feedback for ${proposalTitle}`">
    <h4 class="feedback-title">Is this proposal useful?</h4>
    <p class="small muted">Saved in the shared cockpit. It does not start work or change factory policy.</p>
    <URadioGroup
      :model-value="verdict"
      :disabled="busy"
      :items="[
        { value: 'useful', label: 'Useful' },
        { value: 'not-useful', label: 'Not useful' },
      ]"
      orientation="horizontal"
      :name="`proposal-feedback-${feedbackId}`"
      :aria-label="`Mark proposal ${proposalTitle} useful or not useful`"
      @update:model-value="choose($event as FeedbackVerdict)"
    />
    <p v-if="verdict" class="small feedback-saved" role="status">
      Marked {{ verdict === "useful" ? "useful" : "not useful" }} in the shared cockpit.
    </p>
    <UFormField label="Why? (optional)" :name="`proposal-feedback-reason-${feedbackId}`">
      <UTextarea
        v-model="reasonDraft"
        :rows="2"
        :maxlength="500"
        class="w-full"
        :placeholder="`What makes this ${verdict === 'not-useful' ? 'not ' : ''}useful?`"
      />
    </UFormField>
    <div class="feedback-actions">
      <UButton
        size="xs"
        variant="outline"
        color="neutral"
        :disabled="!verdict || !reasonChanged"
        :aria-label="`Save reason for ${proposalTitle}`"
        @click="saveReason"
      >Save reason</UButton>
      <UButton
        v-if="verdict"
        size="xs"
        variant="ghost"
        color="neutral"
        :aria-label="`Clear feedback for ${proposalTitle}`"
        @click="clear"
      >Clear</UButton>
    </div>
    <p v-if="storageProblem" role="status" class="small muted">Shared feedback is unavailable. Your typed reason is retained.</p>
    <p v-if="saveProblem" role="alert" class="small muted">Could not save; another user may have changed this feedback. Your reason is retained.</p>
    <UButton v-if="storageProblem || saveProblem" variant="ghost" @click="refresh">Reload saved feedback</UButton>
  </section>
  <p v-else class="small muted">Feedback is unavailable for findings without a recorded proposal ID.</p>
</template>

<style scoped>
.proposal-feedback { border-top: 1px solid var(--ui-border); margin-top: 20px; padding-top: 16px; display: grid; gap: 10px; }
.feedback-title { font-weight: 600; margin: 0; }
.feedback-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.feedback-saved { margin: 0; }
</style>
