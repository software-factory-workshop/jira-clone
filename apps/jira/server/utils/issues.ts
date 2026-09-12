/**
 * Demo-only issue store for the Jira teaching board.
 *
 * Persistence boundary: in-memory server overrides on top of the labelled
 * synthetic fixtures from `@jira-clone/context`. Status moves, priority
 * edits and issues created via POST /api/issues survive page reload against
 * the same running server but reset on redeploy or cold start. No Jira
 * transition enforcement is claimed: any move among the observed statuses
 * is allowed.
 *
 * Priority is a bounded synthetic allowlist (Highest, High, Medium, Low,
 * Lowest) chosen to cover the fixture values. It teaches the save path; it
 * does not claim Jira parity or durable persistence.
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

export function isPriority(value: unknown): value is DemoPriority {
  return (
    typeof value === "string" &&
    (PRIORITIES as readonly string[]).includes(value)
  );
}

const seeds: DemoIssue[] = demoIssues.map((issue) => ({ ...issue }));

const statusOverrides = new Map<string, ObservedStatus>();
const priorityOverrides = new Map<string, DemoPriority>();

/** Demo-only issues created via POST /api/issues on this running server. */
const createdIssues: DemoIssue[] = [];

export function getIssues(): DemoIssue[] {
  return [
    ...seeds.map((issue) => ({
      ...issue,
      status: statusOverrides.get(issue.key) ?? issue.status,
      priority: priorityOverrides.get(issue.key) ?? issue.priority,
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
    };
  }
  const created = createdIssues.find((issue) => issue.key === key);
  return created ? { ...created } : undefined;
}

export type UpdateResult =
  | { ok: true; issue: DemoIssue }
  | { ok: false; error: string; statusCode: number };

export type IssuePatch = {
  status?: unknown;
  priority?: unknown;
};

/**
 * Demo-only update for status and/or priority on the single in-memory save
 * boundary. Seeded issues are stored as overrides; created demo issues are
 * updated in place on the same boundary. Unknown values are rejected with a
 * client error before any write; the deterministic `fail` path never writes
 * either.
 */
export function updateIssue(
  key: string,
  patch: IssuePatch,
  options?: { fail?: boolean },
): UpdateResult {
  if (options?.fail) {
    return {
      ok: false,
      error:
        "Demo-only save failure (deterministic test path). No changes were saved.",
      statusCode: 500,
    };
  }
  const seed = seeds.find((issue) => issue.key === key);
  const created = seed
    ? undefined
    : createdIssues.find((issue) => issue.key === key);
  if (!seed && !created) {
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
  if (patch.status === undefined && patch.priority === undefined) {
    return {
      ok: false,
      error: "Nothing to save. Provide a demo status and/or priority.",
      statusCode: 400,
    };
  }
  if (seed) {
    if (patch.status !== undefined) {
      statusOverrides.set(key, patch.status);
    }
    if (patch.priority !== undefined) {
      priorityOverrides.set(key, patch.priority);
    }
    return {
      ok: true,
      issue: {
        ...seed,
        status: statusOverrides.get(key) ?? seed.status,
        priority: priorityOverrides.get(key) ?? seed.priority,
      },
    };
  }
  if (!created) {
    return { ok: false, error: `Unknown issue key: ${key}.`, statusCode: 404 };
  }
  if (patch.status !== undefined) {
    created.status = patch.status;
  }
  if (patch.priority !== undefined) {
    created.priority = patch.priority;
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
  const issue: DemoIssue = {
    key: nextIssueKey(),
    title: input.title.trim(),
    type: optionalText(input.type, "Task"),
    status:
      input.status === undefined ? "To Do" : (input.status as ObservedStatus),
    priority:
      input.priority === undefined ? "Medium" : (input.priority as DemoPriority),
    assignee: optionalText(input.assignee, "Unassigned"),
    description:
      typeof input.description === "string" ? input.description : "",
  };
  createdIssues.push(issue);
  return { ok: true, issue: { ...issue } };
}

export function resetIssues(): DemoIssue[] {
  statusOverrides.clear();
  priorityOverrides.clear();
  createdIssues.length = 0;
  return getIssues();
}
