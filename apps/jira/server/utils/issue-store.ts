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

export type DemoComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export const DEMO_COMMENT_AUTHOR = "Demo member (synthetic)";

function seedComments(): Record<string, DemoComment[]> {
  const at = (day: string) => `${day}T09:00:00.000Z`;
  return {
    "ADEO-1": [
      {
        id: "seed-ADEO-1-1",
        author: DEMO_COMMENT_AUTHOR,
        body: "Synthetic note: this thread shows how a comment looks before the factory grows real collaboration.",
        createdAt: at("2026-09-01"),
      },
    ],
    "ADEO-2": [
      {
        id: "seed-ADEO-2-1",
        author: DEMO_COMMENT_AUTHOR,
        body: "Synthetic note: density looks fine on desktop; check the card title wrap on narrow screens.",
        createdAt: at("2026-09-02"),
      },
      {
        id: "seed-ADEO-2-2",
        author: DEMO_COMMENT_AUTHOR,
        body: "Synthetic note: agreed, keep the key visible next to the summary in the demo.",
        createdAt: at("2026-09-03"),
      },
    ],
    "ADEO-3": [
      {
        id: "seed-ADEO-3-1",
        author: DEMO_COMMENT_AUTHOR,
        body: "Synthetic note: permissions stay out of scope until the teaching slice lands.",
        createdAt: at("2026-09-04"),
      },
    ],
    "ADEO-4": [
      {
        id: "seed-ADEO-4-1",
        author: DEMO_COMMENT_AUTHOR,
        body: "Synthetic note: fixtures and run evidence must stay visibly separate.",
        createdAt: at("2026-09-05"),
      },
    ],
  };
}

let issues: TeachingIssue[] = seed();
let comments: Record<string, DemoComment[]> = seedComments();
let commentSeq = 0;
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
  comments = seedComments();
  commentSeq = 0;
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

export function listComments(key: string): DemoComment[] {
  return (comments[key] ?? []).map((comment) => ({ ...comment }));
}

export type CommentSaveResult =
  | { ok: true; comment: DemoComment }
  | { ok: false; error: string; status: number };

/**
 * Adds a demo comment inside the same in-memory boundary as priority edits.
 * Honors the shared deterministic failure hook so the UI can demo failed
 * saves with the draft retained.
 */
export function addIssueComment(
  key: string,
  body: string,
  opts?: { failSave?: boolean },
): CommentSaveResult {
  if (opts?.failSave || failArmed) {
    failArmed = false;
    return {
      ok: false,
      error:
        "Demo save failed on purpose: nothing was stored and the draft is kept.",
      status: 500,
    };
  }
  const text = body.trim();
  if (!text) {
    return { ok: false, error: "Comment cannot be empty.", status: 400 };
  }
  if (!issues.some((entry) => entry.key === key)) {
    return { ok: false, error: `Unknown issue "${key}".`, status: 404 };
  }
  commentSeq += 1;
  const comment: DemoComment = {
    id: `demo-${key}-${Date.now()}-${commentSeq}`,
    author: DEMO_COMMENT_AUTHOR,
    body: text,
    createdAt: new Date().toISOString(),
  };
  comments[key] = [...(comments[key] ?? []), comment];
  return { ok: true, comment: { ...comment } };
}
