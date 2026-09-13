/**
 * Demo-only issue store for the Jira teaching board.
 *
 * This module is the deterministic in-memory fallback for the shared issue
 * persistence boundary. The app selects it explicitly for tests/workshops or
 * when Neon is not configured. Status moves, priority edits, issues created
 * via POST /api/issues and per-issue demo-only comments survive page reload
 * against the same running server but reset on redeploy, cold start or POST
 * /api/issues/reset. A small, explicit, demo-only transition matrix
 * (`DEMO_TRANSITIONS`) guards status moves on the PATCH save path: any other
 * move is rejected with a 409 and writes nothing. This is a teaching guard
 * only; it does not claim verified Jira workflow parity or production
 * authorization.
 *
 * Priority is a bounded synthetic allowlist (Highest, High, Medium, Low,
 * Lowest) chosen to cover the fixture values. It teaches the save path; it
 * does not claim Jira parity. Title, assignee and description edits share the
 * same single in-memory save boundary (used by the Jira-shaped REST update
 * route and the native PATCH detail save); the native PATCH route sends
 * status, priority, title, assignee and/or description. It does not claim
 * durable persistence or verified Jira workflow parity. Comments are flat,
 * demo-only annotations without threading, edit/delete, permissions or
 * accounts.
 */
import { demoIssues } from "@jira-clone/context";

export const OBSERVED_STATUSES = [
  "To Do",
  "In Progress",
  "In Review",
  "Done",
] as const;

export type ObservedStatus = (typeof OBSERVED_STATUSES)[number];

export const PRIORITIES = [
  "Highest",
  "High",
  "Medium",
  "Low",
  "Lowest",
] as const;

export type DemoPriority = (typeof PRIORITIES)[number];

export type DemoIssue = {
  key: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  description: string;
};

export function isObservedStatus(value: unknown): value is ObservedStatus {
  return (
    typeof value === "string" &&
    (OBSERVED_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Demo-only status transition matrix for the Jira teaching board.
 *
 * Fixed best-effort default for this slice: To Do -> In Progress,
 * In Progress -> In Review, In Review -> Done, Done -> To Do (reopen).
 * Any other status move is rejected on the PATCH save path with a
 * structured demoOnly 409 that names the allowed target(s); nothing is
 * written. Same-status saves are no-ops and priority-only saves bypass
 * this rule. Status labels match the existing fixture labels exactly.
 *
 * This is a small explicit teaching guard. It is not verified Jira
 * workflow parity and not production authorization: the demo actor check
 * in the API routes still runs first, so viewer writes stay 403.
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

export function isPriority(value: unknown): value is DemoPriority {
  return (
    typeof value === "string" &&
    (PRIORITIES as readonly string[]).includes(value)
  );
}

const seeds: DemoIssue[] = demoIssues.map((issue) => ({ ...issue }));

const statusOverrides = new Map<string, ObservedStatus>();
const priorityOverrides = new Map<string, DemoPriority>();
const titleOverrides = new Map<string, string>();
const assigneeOverrides = new Map<string, string>();
const descriptionOverrides = new Map<string, string>();

/** Demo-only issues created via POST /api/issues on this running server. */
const createdIssues: DemoIssue[] = [];

export function getIssues(): DemoIssue[] {
  return [
    ...seeds.map((issue) => ({
      ...issue,
      status: statusOverrides.get(issue.key) ?? issue.status,
      priority: priorityOverrides.get(issue.key) ?? issue.priority,
      title: titleOverrides.get(issue.key) ?? issue.title,
      assignee: assigneeOverrides.get(issue.key) ?? issue.assignee,
      description: descriptionOverrides.get(issue.key) ?? issue.description,
    })),
    ...createdIssues.map((issue) => ({ ...issue })),
  ];
}

/**
 * Demo-only single-issue read. Returns the same synthetic issue shape as
 * `getIssues` with current in-memory overrides applied, or `undefined` for
 * an unknown key without writing.
 */
export function getIssue(key: string): DemoIssue | undefined {
  const seed = seeds.find((issue) => issue.key === key);
  if (seed) {
    return {
      ...seed,
      status: statusOverrides.get(key) ?? seed.status,
      priority: priorityOverrides.get(key) ?? seed.priority,
      title: titleOverrides.get(key) ?? seed.title,
      assignee: assigneeOverrides.get(key) ?? seed.assignee,
      description: descriptionOverrides.get(key) ?? seed.description,
    };
  }
  const created = createdIssues.find((issue) => issue.key === key);
  return created ? { ...created } : undefined;
}

export type UpdateResult =
  | { ok: true; issue: DemoIssue }
  | {
      ok: false;
      error: string;
      statusCode: number;
      /** Present only on demo-only transition rejections (409). */
      allowedFrom?: readonly ObservedStatus[];
    };

export type IssuePatch = {
  status?: unknown;
  priority?: unknown;
  /** Demo title edit (Jira `fields.summary`). Nonblank string when present. */
  title?: unknown;
  /** Demo assignee edit. Nonblank string when present; send "Unassigned" to clear. */
  assignee?: unknown;
  /** Demo description edit. String when present; empty string clears it. */
  description?: unknown;
};

/**
 * Validate a patch without changing the in-memory fallback. The Neon-backed
 * persistence adapter reuses this exact contract before issuing its SQL
 * update, so the two persistence modes reject the same input and transition
 * matrix violations.
 */
export function validateIssuePatch(
  key: string,
  current: DemoIssue | undefined,
  patch: IssuePatch,
  options?: { fail?: boolean },
): Extract<UpdateResult, { ok: false }> | undefined {
  if (options?.fail) {
    return {
      ok: false,
      error:
        "Demo-only save failure (deterministic test path). No changes were saved.",
      statusCode: 500,
    };
  }
  if (!current) {
    return { ok: false, error: `Unknown issue key: ${key}.`, statusCode: 404 };
  }
  if (patch.status !== undefined && !isObservedStatus(patch.status)) {
    return {
      ok: false,
      error: `Unknown status. Allowed demo statuses: ${OBSERVED_STATUSES.join(", ")}.`,
      statusCode: 400,
    };
  }
  if (patch.priority !== undefined && !isPriority(patch.priority)) {
    return {
      ok: false,
      error: `Unknown priority. Allowed demo priorities: ${PRIORITIES.join(", ")}.`,
      statusCode: 400,
    };
  }
  if (patch.title !== undefined) {
    if (typeof patch.title !== "string" || patch.title.trim() === "") {
      return {
        ok: false,
        error: "A nonblank demo title is required.",
        statusCode: 400,
      };
    }
  }
  if (patch.assignee !== undefined) {
    if (typeof patch.assignee !== "string" || patch.assignee.trim() === "") {
      return {
        ok: false,
        error: "A nonblank demo assignee is required (send \"Unassigned\" to clear).",
        statusCode: 400,
      };
    }
  }
  if (patch.description !== undefined && typeof patch.description !== "string") {
    return {
      ok: false,
      error: "Demo description must be a string (empty string clears it).",
      statusCode: 400,
    };
  }
  if (
    patch.status === undefined &&
    patch.priority === undefined &&
    patch.title === undefined &&
    patch.assignee === undefined &&
    patch.description === undefined
  ) {
    return {
      ok: false,
      error: "Nothing to save. Provide a demo status, priority, title, assignee and/or description.",
      statusCode: 400,
    };
  }
  if (patch.status !== undefined) {
    const currentStatus = current.status;
    if (
      isObservedStatus(currentStatus) &&
      patch.status !== currentStatus &&
      !isDemoTransition(currentStatus, patch.status)
    ) {
      const allowed = allowedTransitions(currentStatus);
      return {
        ok: false,
        error:
          `Demo-only transition rejected: "${currentStatus}" -> "${patch.status}" is not in the demo matrix. ` +
          `Allowed demo target(s) from "${currentStatus}": ${allowed.join(", ")}. ` +
          `Nothing was saved. This is a teaching guard, not verified Jira workflow parity.`,
        statusCode: 409,
        allowedFrom: allowed,
      };
    }
  }
  return undefined;
}

/**
 * Demo-only update for status, priority, title, assignee and/or description
 * on the single in-memory save boundary. Seeded issues are stored as
 * overrides; created demo issues are updated in place on the same boundary.
 * Unknown values are rejected with a client error before any write; the
 * deterministic `fail` path never writes either. Status moves are further
 * guarded by the demo-only `DEMO_TRANSITIONS` matrix: a move to any other
 * observed status is rejected with a 409 carrying `allowedFrom`, and
 * nothing is written. Same-status saves are no-ops and non-status saves
 * bypass the matrix. This guard is not verified Jira workflow parity or
 * production authorization; actor checks still run first in the API routes.
 */
export function updateIssue(
  key: string,
  patch: IssuePatch,
  options?: { fail?: boolean },
): UpdateResult {
  const current = options?.fail ? undefined : getIssue(key);
  const validation = validateIssuePatch(key, current, patch, options);
  if (validation) return validation;
  const seed = seeds.find((issue) => issue.key === key);
  const created = seed
    ? undefined
    : createdIssues.find((issue) => issue.key === key);
  if (seed) {
    if (patch.status !== undefined) {
      statusOverrides.set(key, patch.status as ObservedStatus);
    }
    if (patch.priority !== undefined) {
      priorityOverrides.set(key, patch.priority as DemoPriority);
    }
    if (patch.title !== undefined) {
      titleOverrides.set(key, (patch.title as string).trim());
    }
    if (patch.assignee !== undefined) {
      assigneeOverrides.set(key, (patch.assignee as string).trim());
    }
    if (patch.description !== undefined) {
      descriptionOverrides.set(key, patch.description as string);
    }
    return {
      ok: true,
      issue: {
        ...seed,
        status: statusOverrides.get(key) ?? seed.status,
        priority: priorityOverrides.get(key) ?? seed.priority,
        title: titleOverrides.get(key) ?? seed.title,
        assignee: assigneeOverrides.get(key) ?? seed.assignee,
        description: descriptionOverrides.get(key) ?? seed.description,
      },
    };
  }
  if (!created) {
    return { ok: false, error: `Unknown issue key: ${key}.`, statusCode: 404 };
  }
  if (patch.status !== undefined) {
    created.status = patch.status as ObservedStatus;
  }
  if (patch.priority !== undefined) {
    created.priority = patch.priority as DemoPriority;
  }
  if (patch.title !== undefined) {
    created.title = (patch.title as string).trim();
  }
  if (patch.assignee !== undefined) {
    created.assignee = (patch.assignee as string).trim();
  }
  if (patch.description !== undefined) {
    created.description = patch.description as string;
  }
  return { ok: true, issue: { ...created } };
}

export function updateIssueStatus(
  key: string,
  status: unknown,
  options?: { fail?: boolean },
): UpdateResult {
  return updateIssue(key, { status }, options);
}

export type IssueCreateInput = {
  title?: unknown;
  type?: unknown;
  status?: unknown;
  priority?: unknown;
  assignee?: unknown;
  description?: unknown;
};

function optionalText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : fallback;
}

export type NormalizedIssueCreateInput = {
  title: string;
  type: string;
  status: ObservedStatus;
  priority: DemoPriority;
  assignee: string;
  description: string;
};

/** Validate and normalize issue creation without writing to any store. */
export function normalizeIssueCreateInput(
  input: IssueCreateInput,
  options?: { fail?: boolean },
):
  | { ok: true; value: NormalizedIssueCreateInput }
  | Extract<UpdateResult, { ok: false }> {
  if (options?.fail) {
    return {
      ok: false,
      error:
        "Demo-only save failure (deterministic test path). No changes were saved.",
      statusCode: 500,
    };
  }
  if (typeof input.title !== "string" || input.title.trim() === "") {
    return {
      ok: false,
      error: "A nonblank demo title is required.",
      statusCode: 400,
    };
  }
  if (input.status !== undefined && !isObservedStatus(input.status)) {
    return {
      ok: false,
      error: `Unknown status. Allowed demo statuses: ${OBSERVED_STATUSES.join(", ")}.`,
      statusCode: 400,
    };
  }
  if (input.priority !== undefined && !isPriority(input.priority)) {
    return {
      ok: false,
      error: `Unknown priority. Allowed demo priorities: ${PRIORITIES.join(", ")}.`,
      statusCode: 400,
    };
  }
  return {
    ok: true,
    value: {
      title: input.title.trim(),
      type: optionalText(input.type, "Task"),
      status:
        input.status === undefined ? "To Do" : (input.status as ObservedStatus),
      priority:
        input.priority === undefined ? "Medium" : (input.priority as DemoPriority),
      assignee: optionalText(input.assignee, "Unassigned"),
      description:
        typeof input.description === "string" ? input.description : "",
    },
  };
}

/** Next deterministic demo key: one past the highest ADEO-n in use. */
function nextIssueKey(): string {
  let max = 0;
  for (const issue of [...seeds, ...createdIssues]) {
    const match = /^ADEO-(\d+)$/.exec(issue.key);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `ADEO-${max + 1}`;
}

/**
 * Demo-only creation on the single in-memory save boundary. The title is
 * required and must be nonblank; status and priority fall back to fixture
 * defaults ("To Do", "Medium") and are rejected with a client error when
 * unknown. Blank titles, unknown values and the deterministic `fail` path
 * never write.
 */
export function createIssue(
  input: IssueCreateInput,
  options?: { fail?: boolean },
): UpdateResult {
  const normalized = normalizeIssueCreateInput(input, options);
  if (!normalized.ok) return normalized;
  const issue: DemoIssue = {
    key: nextIssueKey(),
    ...normalized.value,
  };
  createdIssues.push(issue);
  return { ok: true, issue: { ...issue } };
}

export const DEMO_COMMENT_AUTHOR = "Demo member (demo-only fixture)";

export type DemoComment = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  demoOnly: true;
};

export type CommentCreateInput = {
  body?: unknown;
};

/** Validate and normalize comment creation without writing to any store. */
export function normalizeCommentBody(
  input: CommentCreateInput,
  options?: { fail?: boolean },
):
  | { ok: true; body: string }
  | Extract<CommentResult, { ok: false }> {
  if (options?.fail) {
    return {
      ok: false,
      error:
        "Demo-only comment save failure (deterministic test path). No comment was saved.",
      statusCode: 500,
    };
  }
  if (typeof input.body !== "string" || input.body.trim() === "") {
    return {
      ok: false,
      error: "A nonblank demo comment is required.",
      statusCode: 400,
    };
  }
  return { ok: true, body: input.body.trim() };
}

export type CommentResult =
  | { ok: true; comment: DemoComment }
  | { ok: false; error: string; statusCode: number };

/** Demo-only per-issue comment store. Empty per key; isolated by issue key. */
const commentStore = new Map<string, DemoComment[]>();
let commentSeq = 0;

function isKnownIssueKey(key: string): boolean {
  return getIssue(key) !== undefined;
}

/**
 * Demo-only comment list for one issue. Returns a copy of that issue's
 * comments, or `undefined` for an unknown key without writing.
 */
export function listComments(key: string): DemoComment[] | undefined {
  if (!isKnownIssueKey(key)) {
    return undefined;
  }
  return (commentStore.get(key) ?? []).map((comment) => ({ ...comment }));
}

/**
 * Demo-only comment creation on the single in-memory save boundary.
 * Unknown keys return 404 before writing; blank bodies are rejected with a
 * client error; the deterministic `fail` path returns a 500 and writes
 * nothing.
 */
export function addComment(
  key: string,
  input: CommentCreateInput,
  options?: { fail?: boolean },
): CommentResult {
  const normalized = normalizeCommentBody(input, options);
  if (!normalized.ok) return normalized;
  if (!isKnownIssueKey(key)) {
    return { ok: false, error: `Unknown issue key: ${key}.`, statusCode: 404 };
  }
  commentSeq += 1;
  const comment: DemoComment = {
    id: `${key}-comment-${commentSeq}`,
    body: normalized.body,
    author: DEMO_COMMENT_AUTHOR,
    createdAt: new Date().toISOString(),
    demoOnly: true,
  };
  const existing = commentStore.get(key) ?? [];
  existing.push(comment);
  commentStore.set(key, existing);
  return { ok: true, comment: { ...comment } };
}

export function resetIssues(): DemoIssue[] {
  statusOverrides.clear();
  priorityOverrides.clear();
  titleOverrides.clear();
  assigneeOverrides.clear();
  descriptionOverrides.clear();
  createdIssues.length = 0;
  commentStore.clear();
  commentSeq = 0;
  return getIssues();
}
