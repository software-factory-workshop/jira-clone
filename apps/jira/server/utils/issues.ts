/**
 * Demo-only issue store for the Jira teaching board.
 *
 * Persistence boundary: in-memory server overrides on top of the labelled
 * synthetic fixtures from `@jira-clone/context`. Moves and comments survive
 * page reload against the same running server but reset on redeploy or cold
 * start. No Jira transition enforcement is claimed: any move among the
 * observed statuses is allowed. Comments are attributed to a single labelled
 * fixture identity; no real Passport/SAML/directory model is claimed and no
 * Jira API parity is claimed.
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

export type DemoComment = {
  id: string;
  key: string;
  author: string;
  body: string;
  createdAt: string;
};

/** Single labelled fixture identity used for all demo-only comments. */
export const DEMO_COMMENT_AUTHOR = "Demo member";

export const MAX_COMMENT_LENGTH = 2000;

export function isObservedStatus(value: unknown): value is ObservedStatus {
  return (
    typeof value === "string" &&
    (OBSERVED_STATUSES as readonly string[]).includes(value)
  );
}

const seeds: DemoIssue[] = demoIssues.map((issue) => ({ ...issue }));

const statusOverrides = new Map<string, ObservedStatus>();

const commentStore = new Map<string, DemoComment[]>();

function findSeed(key: string): DemoIssue | undefined {
  return seeds.find((issue) => issue.key === key);
}

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
  const seed = findSeed(key);
  if (!seed) {
    return { ok: false, error: `Unknown issue key: ${key}.`, statusCode: 404 };
  }
  statusOverrides.set(key, status);
  return { ok: true, issue: { ...seed, status } };
}

export type ListCommentsResult =
  | { ok: true; comments: DemoComment[] }
  | { ok: false; error: string; statusCode: number };

export type AddCommentResult =
  | { ok: true; comment: DemoComment }
  | { ok: false; error: string; statusCode: number };

export function listComments(key: string): ListCommentsResult {
  if (!findSeed(key)) {
    return { ok: false, error: `Unknown issue key: ${key}.`, statusCode: 404 };
  }
  return {
    ok: true,
    comments: (commentStore.get(key) ?? []).map((comment) => ({ ...comment })),
  };
}

export function addComment(
  key: string,
  body: unknown,
  options?: { fail?: boolean; author?: unknown },
): AddCommentResult {
  if (options?.fail) {
    return {
      ok: false,
      error:
        "Demo-only save failure (deterministic test path). No changes were saved.",
      statusCode: 500,
    };
  }
  if (!findSeed(key)) {
    return { ok: false, error: `Unknown issue key: ${key}.`, statusCode: 404 };
  }
  if (typeof body !== "string" || body.trim().length === 0) {
    return {
      ok: false,
      error: "Comment body must not be empty.",
      statusCode: 400,
    };
  }
  if (body.trim().length > MAX_COMMENT_LENGTH) {
    return {
      ok: false,
      error: `Comment body must be at most ${MAX_COMMENT_LENGTH} characters.`,
      statusCode: 400,
    };
  }
  const author =
    typeof options?.author === "string" && options.author.trim().length > 0
      ? options.author.trim()
      : DEMO_COMMENT_AUTHOR;
  const existing = commentStore.get(key) ?? [];
  const comment: DemoComment = {
    id: `${key}-c${existing.length + 1}`,
    key,
    author,
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };
  commentStore.set(key, [...existing, comment]);
  return { ok: true, comment: { ...comment } };
}

export function resetIssues(): DemoIssue[] {
  statusOverrides.clear();
  commentStore.clear();
  return getIssues();
}
