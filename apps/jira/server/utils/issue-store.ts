// DEMO-ONLY persistence boundary.
//
// This store keeps issue edits in module-level in-memory state on the Nitro
// server. It is seeded from the synthetic fixtures in @jira-clone/context
// and resets whenever the server restarts. It is not production
// persistence, has no user permissions, and is not Jira API parity. The
// teaching UI labels this boundary and offers a reset control.

import { demoIssues } from "@jira-clone/context";

export const PRIORITIES = ["Lowest", "Low", "Medium", "High", "Highest"] as const;

export type Priority = (typeof PRIORITIES)[number];

export type TeachingIssue = {
  key: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assignee: string;
  description: string;
};

function seed(): TeachingIssue[] {
  return demoIssues.map((issue) => ({ ...issue }));
}

let issues: TeachingIssue[] = seed();
let failArmed = false;

export function isValidPriority(value: unknown): value is Priority {
  return (
    typeof value === "string" &&
    (PRIORITIES as readonly string[]).includes(value)
  );
}

export function listIssues(): TeachingIssue[] {
  return issues.map((issue) => ({ ...issue }));
}

export function resetIssues(): TeachingIssue[] {
  issues = seed();
  failArmed = false;
  return listIssues();
}

/**
 * Deterministic failure hook for tests and the UI demo toggle.
 * Arms the next save to fail exactly once without storing anything.
 */
export function armSaveFailure(): void {
  failArmed = true;
}

export type SaveResult =
  | { ok: true; issue: TeachingIssue }
  | { ok: false; error: string; status: number };

export function saveIssuePriority(
  key: string,
  priority: string,
  opts?: { failSave?: boolean },
): SaveResult {
  if (opts?.failSave || failArmed) {
    failArmed = false;
    return {
      ok: false,
      error:
        "Demo save failed on purpose: nothing was stored and the draft is kept.",
      status: 500,
    };
  }
  if (!isValidPriority(priority)) {
    return {
      ok: false,
      error: `Unknown priority "${priority}". Use one of: ${PRIORITIES.join(", ")}.`,
      status: 400,
    };
  }
  const issue = issues.find((entry) => entry.key === key);
  if (!issue) {
    return { ok: false, error: `Unknown issue "${key}".`, status: 404 };
  }
  issue.priority = priority;
  return { ok: true, issue: { ...issue } };
}
