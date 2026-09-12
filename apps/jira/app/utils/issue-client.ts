// Shared client-side helpers for the Jira teaching slice. They keep the
// list filter behaviour testable without mounting the Nuxt app.

export type TeachingIssueView = {
  key: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  description: string;
};

export type SavedIssuePatch = {
  key: string;
  priority: string;
  appliedPriority?: string;
  saveError?: string;
};

export function filterIssues(
  issues: TeachingIssueView[],
  search: string,
  status: string,
  assignee: string,
): TeachingIssueView[] {
  const needle = search.trim().toLowerCase();
  return issues.filter((issue) => {
    const matchesSearch =
      !needle || `${issue.key} ${issue.title}`.toLowerCase().includes(needle);
    const matchesStatus = status === "All statuses" || issue.status === status;
    const matchesAssignee =
      assignee === "All assignees" || issue.assignee === assignee;
    return matchesSearch && matchesStatus && matchesAssignee;
  });
}

/**
 * Applies a saved priority to displayed state. A failed save returns the
 * unchanged list plus the error, so the UI never shows false success and
 * the user's draft stays visible.
 */
export function applySavedIssue(
  issues: TeachingIssueView[],
  saved: SavedIssuePatch,
): { issues: TeachingIssueView[]; error: string | null } {
  if (saved.saveError) {
    return { issues: issues.map((issue) => ({ ...issue })), error: saved.saveError };
  }
  return {
    issues: issues.map((issue) =>
      issue.key === saved.key
        ? { ...issue, priority: saved.appliedPriority ?? saved.priority }
        : { ...issue },
    ),
    error: null,
  };
}
