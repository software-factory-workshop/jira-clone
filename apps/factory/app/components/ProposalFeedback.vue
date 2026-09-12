<script setup lang="ts">
import {
  clearFeedbackEntry,
  feedbackChangedEvent,
  feedbackKeyFor,
  loadFeedback,
  setFeedbackEntry,
  storeFeedback,
  storageProblemFor,
  type FeedbackStorageProblem,
  type FeedbackVerdict,
  type ProposalFeedbackMap,
} from "../utils/proposal-feedback";

const props = defineProps<{ proposalId?: string; proposalTitle: string }>();

const entries = ref<ProposalFeedbackMap>({});
const reasonDraft = ref("");
const storageProblem = ref<FeedbackStorageProblem>("");
const saveProblem = ref(false);

const feedbackId = computed(() => feedbackKeyFor(props.proposalId));
const saved = computed(() => (feedbackId.value ? entries.value[feedbackId.value] : undefined));
const verdict = computed<FeedbackVerdict | undefined>(() => saved.value?.verdict);
const reasonChanged = computed(() => reasonDraft.value.trim().slice(0, 500) !== (saved.value?.reason ?? ""));

function refresh() {
  try {
    const loaded = loadFeedback(localStorage);
    entries.value = loaded.entries;
    // A clean load proves storage recovered, so a previous warning clears
    // instead of lingering after the failure is gone.
    storageProblem.value = storageProblemFor(loaded);
  } catch {
    storageProblem.value = "unavailable";
  }
}

function persist(next: ProposalFeedbackMap) {
  try {
    const result = storeFeedback(localStorage, next);
    saveProblem.value = result.unavailable;
    if (!result.unavailable) {
      entries.value = next;
      // A successful save proves storage works, so it also clears a stale
      // malformed/unavailable warning (the save overwrote the bad entry).
      storageProblem.value = "";
      window.dispatchEvent(new CustomEvent(feedbackChangedEvent));
    }
  } catch {
    saveProblem.value = true;
  }
}

// Re-read before every write so two proposal cards on the same report never
// overwrite each other's feedback from a stale in-memory copy.
function update(transform: (fresh: ProposalFeedbackMap) => ProposalFeedbackMap) {
  if (!feedbackId.value) return;
  try {
    const loaded = loadFeedback(localStorage);
    storageProblem.value = storageProblemFor(loaded);
    persist(transform(loaded.entries));
  } catch {
    saveProblem.value = true;
  }
}

function choose(value: FeedbackVerdict) {
  update(fresh => setFeedbackEntry(fresh, feedbackId.value!, { verdict: value, reason: reasonDraft.value }));
}

function saveReason() {
  const current = saved.value;
  if (!current) return;
  update(fresh => setFeedbackEntry(fresh, feedbackId.value!, { verdict: current.verdict, reason: reasonDraft.value }));
}

function clear() {
  reasonDraft.value = "";
  update(fresh => clearFeedbackEntry(fresh, feedbackId.value!));
}

function onExternalChange() {
  const before = saved.value?.reason ?? "";
  refresh();
  // Keep an unsaved typed reason; adopt the stored one only when untouched.
  if (!reasonChanged.value) reasonDraft.value = saved.value?.reason ?? before;
}

watch(feedbackId, () => {
  reasonDraft.value = saved.value?.reason ?? "";
  saveProblem.value = false;
});

onMounted(() => {
  refresh();
  reasonDraft.value = saved.value?.reason ?? "";
  window.addEventListener(feedbackChangedEvent, onExternalChange);
});

onUnmounted(() => {
  window.removeEventListener(feedbackChangedEvent, onExternalChange);
});
</script>

<template>
  <section v-if="feedbackId" class="proposal-feedback" :aria-label="`Usefulness feedback for ${proposalTitle}`">
    <h4 class="feedback-title">Is this proposal useful?</h4>
    <p class="small muted">Saved in this browser only. It does not start work or change factory policy.</p>
    <URadioGroup
      :model-value="verdict"
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
      Marked {{ verdict === "useful" ? "useful" : "not useful" }} in this browser.
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
    <p v-if="storageProblem === 'malformed'" role="status" class="small muted">Saved feedback in this browser could not be read, so earlier marks are not shown. New marks overwrite the unreadable entry.</p>
    <p v-else-if="storageProblem === 'unavailable'" role="status" class="small muted">Browser storage is unavailable, so feedback cannot be kept after reload.</p>
    <p v-if="saveProblem" role="alert" class="small muted">Could not save feedback in this browser. Your selection above is not kept.</p>
  </section>
  <p v-else class="small muted">Feedback is unavailable for findings without a recorded proposal ID.</p>
</template>

<style scoped>
.proposal-feedback { border-top: 1px solid var(--ui-border); margin-top: 20px; padding-top: 16px; display: grid; gap: 10px; }
.feedback-title { font-weight: 600; margin: 0; }
.feedback-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.feedback-saved { margin: 0; }
</style>
