/** Shared board-move helpers used by the Kanban UI and focused tests. */
import { serverMessage } from "./errorMessage.ts";

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

/**
 * Demo-only status transition matrix for the Jira teaching board.
 *
 * Fixed best-effort default for this slice, mirroring the server guard:
 * To Do -> In Progress, In Progress -> In Review, In Review -> Done,
 * Done -> To Do (reopen). Any other move is rejected by the PATCH save
 * path with a structured demoOnly 409 and writes nothing. Status labels
 * match the existing fixture labels exactly. This is a teaching guard,
 * not verified Jira workflow parity or production authorization.
 */
export const DEMO_TRANSITIONS = {
  "To Do": ["In Progress"],
  "In Progress": ["In Review"],
  "In Review": ["Done"],
  "Done": ["To Do"],
} as const satisfies Record<ObservedStatus, readonly ObservedStatus[]>;

/** Allowed demo-only targets from one observed status. Pure; never writes. */
export function allowedTransitions(from: ObservedStatus): readonly ObservedStatus[] {
  return DEMO_TRANSITIONS[from] ?? [];
}

/** Pure demo-only transition check. Same-status moves are handled by the caller as no-ops. */
export function isDemoTransition(from: ObservedStatus, to: ObservedStatus): boolean {
  return allowedTransitions(from).includes(to);
}

/**
 * Human-readable allowed-target guidance for the board and detail move
 * controls, e.g. `Allowed demo move: In Progress`. Kept in the shared
 * helper so server rejections and UI guidance agree.
 */
export function allowedMoveHint(currentStatus: string): string {
  if (!isObservedStatus(currentStatus)) {
    return "Demo-only moves follow a fixed matrix; unknown demo statuses cannot move.";
  }
  const allowed = allowedTransitions(currentStatus);
  return `Demo-only moves: from ${currentStatus} you may move to ${allowed.join(", ")}. Other moves are rejected and save nothing.`;
}

export function columnIssues(
  issues: readonly BoardIssue[],
  status: string,
): BoardIssue[] {
  return issues.filter((issue) => issue.status === status);
}

export const ALL_ASSIGNEES = "All assignees";
export const ALL_STATUSES = "All statuses";
export const UNASSIGNED = "Unassigned";

export type IssueFilters = {
  search: string;
  status: string;
  assignee: string;
};

/**
 * Fixture assignee options for the demo-only client-side filter.
 * "All assignees" and "Unassigned" come first, followed by each distinct
 * named fixture identity in alphabetical order.
 */
export function assigneeOptions(issues: BoardIssue[]): string[] {
  const names = [
    ...new Set(
      issues
        .map((issue) => issue.assignee)
        .filter((assignee) => assignee && assignee !== UNASSIGNED),
    ),
  ].sort();
  return [ALL_ASSIGNEES, UNASSIGNED, ...names];
}

/** Client-side match for one issue against search x status x assignee. */
export function matchesFilters(issue: BoardIssue, filters: IssueFilters): boolean {
  const query = filters.search.toLowerCase();
  const matchesSearch = `${issue.key} ${issue.title}`
    .toLowerCase()
    .includes(query);
  const matchesStatus =
    filters.status === ALL_STATUSES || issue.status === filters.status;
  const matchesAssignee =
    filters.assignee === ALL_ASSIGNEES ||
    issue.assignee === filters.assignee;
  return matchesSearch && matchesStatus && matchesAssignee;
}

/**
 * Shared list/board filter: fixture assignee combined with the existing
 * search and status filters. Pure and client-side; the demo-only fixture
 * boundary is unchanged.
 */
export function filterIssues(
  issues: BoardIssue[],
  filters: IssueFilters,
): BoardIssue[] {
  return issues.filter((issue) => matchesFilters(issue, filters));
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
      error: serverMessage(
        error,
        "Demo-only save failed. The card stays in its original column.",
      ),
      issues: previous,
    };
  }
}

/**
 * Keyboard move targets for one issue: the allowed demo-only target(s)
 * from its current column. Unknown statuses fall back to excluding only
 * the current column so keyboard operation never strands an issue.
 */
export function moveTargets(
  statuses: readonly string[],
  currentStatus: string,
): string[] {
  if (isObservedStatus(currentStatus)) {
    const allowed = new Set<string>(allowedTransitions(currentStatus));
    return statuses.filter((status) => allowed.has(status));
  }
  return statuses.filter((status) => status !== currentStatus);
}

/**
 * Drag-and-drop targets for the Kanban board: every observed column stays
 * droppable so an illegal drop travels the same demo-only PATCH save path
 * and surfaces the structured demoOnly 409 teaching error instead of being
 * hidden. Contrast with `moveTargets`, which narrows keyboard/select
 * controls to the legal next step(s). Pure; never writes.
 */
export function dragDropTargets(statuses: readonly string[]): string[] {
  return statuses.filter((status) => isObservedStatus(status));
}

/**
 * Bounded synthetic priority allowlist for the demo-only save path.
 * Covers the fixture values (High, Medium) and teaches the save path; it does
 * not claim Jira parity or a production Jira data model.
 */
export const PRIORITIES = [
  "Highest",
  "High",
  "Medium",
  "Low",
  "Lowest",
] as const;

export type DemoPriority = (typeof PRIORITIES)[number];

export function isPriority(value: unknown): value is DemoPriority {
  return (
    typeof value === "string" &&
    (PRIORITIES as readonly string[]).includes(value)
  );
}

export type PriorityResult =
  | { ok: true; issues: BoardIssue[] }
  | { ok: false; error: string; issues: BoardIssue[] };

/**
 * Optimistic priority edit with deterministic failure recovery.
 *
 * Mirrors `moveIssue`: unknown values are rejected before any save, and on
 * save failure the original list is returned unchanged so the UI never
 * shows false success. Callers keep the attempted draft so a retry is
 * possible.
 */
export async function changePriority(
  issues: BoardIssue[],
  key: string,
  priority: string,
  save: (key: string, priority: string) => Promise<BoardIssue>,
): Promise<PriorityResult> {
  if (!isPriority(priority)) {
    return {
      ok: false,
      error: `Unknown priority. Allowed demo priorities: ${PRIORITIES.join(", ")}.`,
      issues,
    };
  }
  const current = issues.find((issue) => issue.key === key);
  if (!current) {
    return { ok: false, error: `Unknown issue key: ${key}.`, issues };
  }
  if (current.priority === priority) {
    return { ok: true, issues };
  }
  const previous = issues;
  const optimistic = issues.map((issue) =>
    issue.key === key ? { ...issue, priority } : issue,
  );
  try {
    const saved = await save(key, priority);
    return {
      ok: true,
      issues: optimistic.map((issue) =>
        issue.key === key ? { ...saved } : issue,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      error: serverMessage(
        error,
        "Demo-only save failed. The priority stays unchanged.",
      ),
      issues: previous,
    };
  }
}
