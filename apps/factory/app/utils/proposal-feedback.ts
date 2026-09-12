import { z } from "zod";

export const proposalFeedbackStorageKey = "adeo-factory-proposal-feedback-v1";

export const feedbackVerdictSchema = z.enum(["useful", "not-useful"]);
export type FeedbackVerdict = z.infer<typeof feedbackVerdictSchema>;

export const proposalFeedbackSchema = z.object({
  verdict: feedbackVerdictSchema,
  reason: z.string().max(500),
  updatedAt: z.string(),
});
export type ProposalFeedback = z.infer<typeof proposalFeedbackSchema>;

const feedbackMapSchema = z.record(z.string(), proposalFeedbackSchema);
export type ProposalFeedbackMap = z.infer<typeof feedbackMapSchema>;

export interface FeedbackStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// Feedback is keyed only by the host-assigned proposal ID. Legacy findings
// without one return no key so they can never share or overwrite feedback.
export function feedbackKeyFor(proposalId: string | undefined): string | undefined {
  const id = proposalId?.trim();
  return id ? id : undefined;
}

export function readFeedbackMap(raw: unknown): { entries: ProposalFeedbackMap; malformed: boolean } {
  if (raw === null || raw === undefined || raw === "") return { entries: {}, malformed: false };
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { entries: {}, malformed: true };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { entries: {}, malformed: true };
  }
  const entries: ProposalFeedbackMap = {};
  let malformed = false;
  for (const [key, value] of Object.entries(parsed)) {
    const checked = proposalFeedbackSchema.safeParse(value);
    if (checked.success) entries[key] = checked.data;
    else malformed = true;
  }
  return { entries, malformed };
}

export function loadFeedback(
  storage: Pick<FeedbackStorage, "getItem">,
  key: string = proposalFeedbackStorageKey,
): { entries: ProposalFeedbackMap; malformed: boolean; unavailable: boolean } {
  try {
    return { ...readFeedbackMap(storage.getItem(key)), unavailable: false };
  } catch {
    return { entries: {}, malformed: false, unavailable: true };
  }
}

export function storeFeedback(
  storage: FeedbackStorage,
  entries: ProposalFeedbackMap,
  key: string = proposalFeedbackStorageKey,
): { unavailable: boolean } {
  try {
    storage.setItem(key, JSON.stringify(entries));
    return { unavailable: false };
  } catch {
    return { unavailable: true };
  }
}

export function setFeedbackEntry(
  entries: ProposalFeedbackMap,
  id: string,
  feedback: { verdict: FeedbackVerdict; reason: string },
): ProposalFeedbackMap {
  return {
    ...entries,
    [id]: {
      verdict: feedback.verdict,
      reason: feedback.reason.trim().slice(0, 500),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function clearFeedbackEntry(entries: ProposalFeedbackMap, id: string): ProposalFeedbackMap {
  const next = { ...entries };
  delete next[id];
  return next;
}

export const feedbackChangedEvent = "adeo-proposal-feedback-changed";
