<script setup lang="ts">
import { feedbackVerdictSchema } from "../utils/proposal-feedback";
import { useProposalFeedback } from "../composables/useProposalFeedback";

const props = defineProps<{
  proposalId?: string;
  proposalTitle: string;
}>();

const {
  feedbackId,
  verdict,
  reasonDraft,
  reasonChanged,
  storageProblem,
  saveProblem,
  busy,
  choose,
  saveReason,
  clear,
  refresh,
} = useProposalFeedback(props);

function updateVerdict(value: unknown): void {
  const parsed = feedbackVerdictSchema.safeParse(value);
  if (parsed.success) void choose(parsed.data);
}
</script>

<template>
  <section v-if="feedbackId" class="proposal-feedback" :aria-label="`Usefulness feedback for ${props.proposalTitle}`">
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
      :aria-label="`Mark proposal ${props.proposalTitle} useful or not useful`"
      @update:model-value="updateVerdict"
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
        :aria-label="`Save reason for ${props.proposalTitle}`"
        @click="saveReason"
      >Save reason</UButton>
      <UButton
        v-if="verdict"
        size="xs"
        variant="ghost"
        color="neutral"
        :aria-label="`Clear feedback for ${props.proposalTitle}`"
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
