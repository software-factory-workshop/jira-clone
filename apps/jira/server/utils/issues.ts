/**
 * Demo-only issue store for the Jira teaching board.
 *
 * Persistence boundary: in-memory server overrides on top of the labelled
 * synthetic fixtures from `@jira-clone/context`. Moves survive page reload
 * against the same running server but reset on redeploy or cold start.
 * No Jira transition enforcement is claimed: any move among the observed
 * statuses is allowed.
 */
import { demoIssues } from "@jira-clone/context";

export const OBSERVED_STATUSES = [
  "To Do",
  "In Progress",
  "In Review",
  "Done",
] as const;

export type ObservedStatus = (typeof OBSERVED_STATUSES)[number];

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

const seeds: DemoIssue[] = demoIssues.map((issue) => ({ ...issue }));

const statusOverrides = new Map<string, ObservedStatus>();

export function getIssues(): DemoIssue[] {
  return seeds.map((issue) => {
    const override = statusOverrides.get(issue.key);
    return override ? { ...issue, status: override } : { ...issue };
  });
}

export type UpdateResult =
  | { ok: true; issue: DemoIssue }
  | { ok: false; error: string; statusCode: number };

export function updateIssueStatus(
  key: string,
  status: unknown,
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
  if (!isObservedStatus(status)) {
    return {
      ok: false,
      error: `Unknown status. Allowed demo statuses: ${OBSERVED_STATUSES.join(", ")}.`,
      statusCode: 400,
    };
  }
  const seed = seeds.find((issue) => issue.key === key);
  if (!seed) {
    return { ok: false, error: `Unknown issue key: ${key}.`, statusCode: 404 };
  }
  statusOverrides.set(key, status);
  return { ok: true, issue: { ...seed, status } };
}

export function resetIssues(): DemoIssue[] {
  statusOverrides.clear();
  return getIssues();
}
