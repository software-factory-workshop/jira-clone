import { computed, onMounted, readonly, ref, watch } from "vue";
import type { CockpitRecord } from "../../shared/cockpit";
import {
  feedbackKeyFor,
  feedbackVerdictSchema,
  loadFeedback,
  storageProblemFor,
  type FeedbackStorageProblem,
  type FeedbackVerdict,
} from "../utils/proposal-feedback";

type FeedbackProps = Readonly<{ proposalId?: string }>;

export function useProposalFeedback(props: FeedbackProps) {
  const cockpit = useCockpit();
  const reasonDraft = ref("");
  const storageProblem = ref<FeedbackStorageProblem>("");
  const saveProblem = ref(false);
  const busy = ref(false);

  const feedbackId = computed(() => feedbackKeyFor(props.proposalId));
  const saved = computed<CockpitRecord | undefined>(() => {
    return cockpit.items.value.feedback.find(
      (item) => item.id === feedbackId.value,
    );
  });
  const verdict = computed<FeedbackVerdict | undefined>(() => {
    const parsed = feedbackVerdictSchema.safeParse(saved.value?.value.verdict);
    return parsed.success ? parsed.data : undefined;
  });
  const savedReason = computed(() => {
    const reason = saved.value?.value.reason;
    return typeof reason === "string" ? reason : "";
  });
  const reasonChanged = computed(
    () => reasonDraft.value.trim() !== savedReason.value,
  );

  async function refresh(): Promise<void> {
    try {
      await cockpit.refresh("feedback");
      storageProblem.value = "";
      saveProblem.value = false;
    } catch {
      storageProblem.value = "unavailable";
    }
  }

  async function choose(value: FeedbackVerdict): Promise<void> {
    const id = feedbackId.value;
    if (!id || busy.value) return;
    busy.value = true;
    try {
      await cockpit.save(
        "feedback",
        id,
        { verdict: value, reason: reasonDraft.value.trim() },
        saved.value?.version ?? 0,
      );
      saveProblem.value = false;
      storageProblem.value = "";
    } catch {
      saveProblem.value = true;
    } finally {
      busy.value = false;
    }
  }

  async function saveReason(): Promise<void> {
    if (verdict.value) await choose(verdict.value);
  }

  async function clear(): Promise<void> {
    const item = saved.value;
    if (!item || busy.value) return;
    busy.value = true;
    try {
      await cockpit.remove("feedback", item);
      reasonDraft.value = "";
      saveProblem.value = false;
      storageProblem.value = "";
    } catch {
      saveProblem.value = true;
    } finally {
      busy.value = false;
    }
  }

  onMounted(async () => {
    const initialId = feedbackId.value;
    let legacy: ReturnType<typeof loadFeedback> = {
      entries: {},
      malformed: false,
      unavailable: false,
    };

    try {
      if (typeof localStorage === "undefined") {
        legacy.unavailable = true;
      } else {
        legacy = loadFeedback(localStorage);
      }

      await cockpit.migrate(
        "feedback",
        Object.entries(legacy.entries).map(([id, value]) => ({
          id,
          value: { verdict: value.verdict, reason: value.reason },
        })),
      );

      if (feedbackId.value === initialId && !reasonDraft.value) {
        reasonDraft.value = savedReason.value;
      }
      storageProblem.value = storageProblemFor(legacy);
    } catch {
      storageProblem.value = "unavailable";
    }
  });

  watch(feedbackId, () => {
    reasonDraft.value = savedReason.value;
    saveProblem.value = false;
  });

  return {
    feedbackId,
    verdict,
    reasonDraft,
    reasonChanged,
    storageProblem: readonly(storageProblem),
    saveProblem: readonly(saveProblem),
    busy: readonly(busy),
    choose,
    saveReason,
    clear,
    refresh,
  };
}
