import type { BoardIssue } from "./boardMove";
import { serverMessage } from "./errorMessage.ts";

/**
 * Demo-only issue field edit (summary/assignee/description) for the detail
 * dialog, saved through the native PATCH `/api/issues/:key` save path.
 *
 * The dialog keeps an explicit draft per open issue: the draft initializes
 * from the loaded server detail, an explicit save writes it, and a failed
 * save keeps the draft for retry while the rendered list stays on the last
 * saved values. The API remains the permission authority; this module only
 * validates the existing store contract early (nonblank summary, nonblank
 * assignee with `Unassigned` clearing, string description with empty
 * clearing) so blank drafts never attempt a save. Pure except for the
 * caller's save callback; never writes itself.
 */

/** Dialog draft for one issue: summary maps to the store `title`. */
export type DetailFieldDraft = {
  summary: string;
  assignee: string;
  description: string;
};

/** Store patch sent to the native PATCH save path. */
export type DetailFieldPatch = {
  title: string;
  assignee: string;
  description: string;
};

/** Draft initialized from the loaded server detail. Pure; never writes. */
export function detailDraftFromIssue(issue: BoardIssue): DetailFieldDraft {
  return {
    summary: issue.title,
    assignee: issue.assignee,
    description: issue.description,
  };
}

/**
 * Whether the draft differs from the loaded server detail. Summary and
 * assignee compare trimmed because the store trims them; description
 * compares exactly because empty clears it. Pure; never writes.
 */
export function isDetailDraftDirty(
  draft: DetailFieldDraft,
  issue: BoardIssue,
): boolean {
  return (
    draft.summary.trim() !== issue.title ||
    draft.assignee.trim() !== issue.assignee ||
    draft.description !== issue.description
  );
}

/**
 * Early client validation mirroring the store contract: a nonblank summary
 * is required, a blank/null assignee is rejected (send `Unassigned` to
 * clear), and a non-string description is rejected (empty clears it).
 * Returns the honest error or null when the draft may be saved. Pure;
 * never writes.
 */
export function validateDetailDraft(draft: {
  summary?: unknown;
  assignee?: unknown;
  description?: unknown;
}): string | null {
  if (typeof draft.summary !== "string" || draft.summary.trim() === "") {
    return "A nonblank demo summary is required.";
  }
  if (typeof draft.assignee !== "string" || draft.assignee.trim() === "") {
    return 'A nonblank demo assignee is required (send "Unassigned" to clear).';
  }
  if (typeof draft.description !== "string") {
    return "Demo description must be a string (empty string clears it).";
  }
  return null;
}

/** Map a validated draft onto the native PATCH body. Pure; never writes. */
export function toDetailPatch(draft: DetailFieldDraft): DetailFieldPatch {
  return {
    title: draft.summary.trim(),
    assignee: draft.assignee.trim(),
    description: draft.description,
  };
}

export type DetailFieldsResult =
  | { ok: true; issues: BoardIssue[] }
  | { ok: false; error: string; issues: BoardIssue[]; draft: DetailFieldDraft };

/**
 * Explicit detail field save with draft retention.
 *
 * Blank drafts are rejected before any save. On save failure the original
 * list is returned unchanged and the submitted draft is returned for retry,
 * so the UI never shows false success and never loses the typed text. On
 * success the saved issue replaces the row. Mirrors `changePriority`.
 */
export async function saveDetailFields(
  issues: BoardIssue[],
  key: string,
  draft: DetailFieldDraft,
  save: (key: string, patch: DetailFieldPatch) => Promise<BoardIssue>,
): Promise<DetailFieldsResult> {
  const invalid = validateDetailDraft(draft);
  if (invalid) {
    return { ok: false, error: invalid, issues, draft };
  }
  const current = issues.find((issue) => issue.key === key);
  if (!current) {
    return { ok: false, error: `Unknown issue key: ${key}.`, issues, draft };
  }
  const previous = issues;
  try {
    const saved = await save(key, toDetailPatch(draft));
    return {
      ok: true,
      issues: previous.map((issue) =>
        issue.key === key ? { ...saved } : issue,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      error: serverMessage(
        error,
        "Demo-only save failed. Your draft is kept for retry.",
      ),
      issues: previous,
      draft,
    };
  }
}
