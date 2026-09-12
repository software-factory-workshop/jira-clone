/**
 * Demo-only issue store for the Jira teaching board.
 *
 * Persistence boundary: in-memory server overrides on top of the labelled
 * synthetic fixtures from `@jira-clone/context`. Status moves and priority
 * edits survive page reload against the same running server but reset on
 * redeploy or cold start. No Jira transition enforcement is claimed: any
 * move among the observed statuses is allowed.
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

export function getIssues(): DemoIssue[] {
  return seeds.map((issue) => ({
    ...issue,
    status: statusOverrides.get(issue.key) ?? issue.status,
    priority: priorityOverrides.get(issue.key) ?? issue.priority,
  }));
}

/**
 * Demo-only single-issue read. Returns the same synthetic issue shape as
 * `getIssues` with current in-memory overrides applied, or `undefined` for
 * an unknown key without writing.
 */
export function getIssue(key: string): DemoIssue | undefined {
  const seed = seeds.find((issue) => issue.key === key);
  if (!seed) {
    return undefined;
  }
  return {
    ...seed,
    status: statusOverrides.get(key) ?? seed.status,
    priority: priorityOverrides.get(key) ?? seed.priority,
  };
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
 * boundary. Unknown values are rejected with a client error before any
 * write; the deterministic `fail` path never writes either.
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
  if (!seed) {
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

export function updateIssueStatus(
  key: string,
  status: unknown,
  options?: { fail?: boolean },
): UpdateResult {
  return updateIssue(key, { status }, options);
}

export function resetIssues(): DemoIssue[] {
  statusOverrides.clear();
  priorityOverrides.clear();
  return getIssues();
}
