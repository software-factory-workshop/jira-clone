/** Shared board-move helpers used by the Kanban UI and focused tests. */

export const OBSERVED_STATUSES = [
  "To Do",
  "In Progress",
  "In Review",
  "Done",
] as const;

export type ObservedStatus = (typeof OBSERVED_STATUSES)[number];

export type BoardIssue = {
  key: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  description: string;
};

export type MoveResult =
  | { ok: true; issues: BoardIssue[] }
  | { ok: false; error: string; issues: BoardIssue[] };

export function isObservedStatus(value: unknown): value is ObservedStatus {
  return (
    typeof value === "string" &&
    (OBSERVED_STATUSES as readonly string[]).includes(value)
  );
}

export function columnIssues(
  issues: BoardIssue[],
  status: string,
): BoardIssue[] {
  return issues.filter((issue) => issue.status === status);
}

/**
 * Optimistic status move with deterministic failure recovery.
 *
 * On save failure the original column list is returned unchanged so the UI
 * never shows false success, and callers keep selection/draft state intact.
 */
export async function moveIssue(
  issues: BoardIssue[],
  key: string,
  toStatus: string,
  save: (key: string, status: string) => Promise<BoardIssue>,
): Promise<MoveResult> {
  if (!isObservedStatus(toStatus)) {
    return {
      ok: false,
      error: `Unknown status. Allowed demo statuses: ${OBSERVED_STATUSES.join(", ")}.`,
      issues,
    };
  }
  const current = issues.find((issue) => issue.key === key);
  if (!current) {
    return { ok: false, error: `Unknown issue key: ${key}.`, issues };
  }
  if (current.status === toStatus) {
    return { ok: true, issues };
  }
  const previous = issues;
  const optimistic = issues.map((issue) =>
    issue.key === key ? { ...issue, status: toStatus } : issue,
  );
  try {
    const saved = await save(key, toStatus);
    return {
      ok: true,
      issues: optimistic.map((issue) =>
        issue.key === key ? { ...saved } : issue,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Demo-only save failed. The card stays in its original column.",
      issues: previous,
    };
  }
}

/** Keyboard targets exclude the issue's current column. */
export function moveTargets(
  statuses: readonly string[],
  currentStatus: string,
): string[] {
  return statuses.filter((status) => status !== currentStatus);
}
