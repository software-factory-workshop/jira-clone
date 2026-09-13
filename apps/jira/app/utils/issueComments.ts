import {
  restCommentsUrl,
  restCommentToDemoComment,
  restCommentWriteUrl,
  type RestCommentShape,
} from "./restIssues.ts";

/** Prefer the server-provided demo message (Nuxt FetchError `data.message`) over the generic transport message. */
function serverMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "data" in error) {
    const message = (error as { data?: { message?: unknown } }).data?.message;
    if (typeof message === "string" && message.trim() !== "") {
      return message;
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export type DemoComment = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  demoOnly?: boolean;
};

export type IssueCommentsResponse = {
  comments?: (DemoComment | RestCommentShape)[];
  startAt?: number;
  maxResults?: number;
  total?: number;
  demoOnly?: boolean;
};

export type IssueCommentsResult = {
  comments: DemoComment[];
  demoOnly: boolean;
};

/**
 * Demo-only per-issue comment read through the canonical Jira-shaped route
 * GET /api/rest/api/3/issue/:key/comment. Accepts both the comment-list
 * envelope (`{ comments: [{ body, author: { displayName }, created }] }`)
 * and already-mapped demo comments, so the dialog renders this canonical
 * server read.
 *
 * The caller supplies a JSON fetcher (Nuxt `$fetch` in the dialog, a stub in
 * tests). Rejections propagate so the dialog can keep the selected key and
 * report the error without claiming success.
 */
export async function fetchIssueComments(
  key: string,
  fetchJson: (url: string) => Promise<IssueCommentsResponse>,
): Promise<IssueCommentsResult> {
  const data = await fetchJson(restCommentsUrl(key));
  const raw = data?.comments ?? [];
  const comments: DemoComment[] = raw.map((comment) =>
    "createdAt" in comment && typeof comment.createdAt === "string"
      ? (comment as DemoComment)
      : restCommentToDemoComment(comment as RestCommentShape),
  );
  return { comments, demoOnly: data?.demoOnly === true };
}

export type CommentSubmitResult =
  | {
      ok: true;
      comments: DemoComment[];
      draft: "";
      error: null;
      comment: DemoComment;
    }
  | { ok: false; comments: DemoComment[]; draft: string; error: string };

/**
 * Demo-only comment submit with draft retention.
 *
 * Blank drafts are rejected before any save. On save failure the original
 * comment list is returned unchanged and the draft is kept for retry, so the
 * UI never appends a comment that was not saved. On success the saved
 * comment is appended and the draft is cleared.
 */
/**
 * Subset of the canonical REST write envelope the server returns from
 * POST /api/rest/api/3/issue/:key/comment. The comment bean keeps the
 * Jira-shaped `{ body, author: { displayName }, created, demoOnly }`
 * mapping; `actor`/`identitySource` are attached by the route and left
 * unread by the dialog mapper.
 */
export type RestCommentWriteResponse = {
  comment?: RestCommentShape;
  demoOnly?: boolean;
};

/**
 * Canonical Jira-shaped write request for POST
 * /api/rest/api/3/issue/:key/comment. `fail` is honoured only by the
 * deterministic demo failure path (a literal `true`); the dialog never
 * sets it.
 */
export type RestCommentWriteRequest = {
  body: string;
  fail?: boolean;
};

/**
 * One coherent demo-only comment write through the canonical REST route
 * POST /api/rest/api/3/issue/:key/comment, mapped back to the existing
 * `DemoComment` display shape.
 *
 * The caller supplies a JSON write fetcher (Nuxt `$fetch` in the dialog, a
 * stub in tests) with the demo account headers already applied, so the UI
 * sends the already-reviewed canonical write instead of the legacy
 * `POST /api/issues/:key/comments` route. The legacy route stays untouched
 * server-side. Rejections propagate so the composer can keep the draft and
 * report the error without claiming success. Missing `comment` beans are
 * rejected before any list refresh so failure never renders as success.
 */
export async function postIssueComment(
  key: string,
  body: string,
  writeJson: (
    url: string,
    request: RestCommentWriteRequest,
  ) => Promise<RestCommentWriteResponse>,
): Promise<DemoComment> {
  const data = await writeJson(restCommentWriteUrl(key), { body });
  const bean = data?.comment;
  if (!bean || typeof bean !== "object") {
    throw new Error(
      "Demo-only comment write returned no comment. Your draft is kept for retry.",
    );
  }
  return restCommentToDemoComment(bean);
}

/**
 * Per-issue composer draft retention over web storage, keyed by issue key
 * so one issue's draft never leaks into another. Drafts survive dialog
 * close/reopen and full reload within the tab; callers label the restored
 * text as locally kept in the demo UI. Storage access is guarded so the
 * composer still works (in memory) when storage is unavailable.
 */
const COMMENT_DRAFT_STORAGE_PREFIX = "adeo-demo-comment-draft:";

export function commentDraftStorageKey(key: string): string {
  return `${COMMENT_DRAFT_STORAGE_PREFIX}${key}`;
}

export type DraftStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function resolveDraftStore(store?: DraftStore | null): DraftStore | null {
  if (store) return store;
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    return null;
  }
  return null;
}

/** Read the locally kept draft for one issue key, or "" when none is stored. */
export function readCommentDraft(
  key: string,
  store?: DraftStore | null,
): string {
  const resolved = resolveDraftStore(store);
  if (!resolved) return "";
  try {
    return resolved.getItem(commentDraftStorageKey(key)) ?? "";
  } catch {
    return "";
  }
}

/**
 * Persist or clear the locally kept draft for one issue key. Blank drafts
 * remove the stored entry so storage never accumulates empty drafts.
 * Storage failures are swallowed: the in-memory composer state stays the
 * authority and the draft is never reported as lost.
 */
export function writeCommentDraft(
  key: string,
  draft: string,
  store?: DraftStore | null,
): void {
  const resolved = resolveDraftStore(store);
  if (!resolved) return;
  try {
    if (draft.trim() === "") {
      resolved.removeItem(commentDraftStorageKey(key));
    } else {
      resolved.setItem(commentDraftStorageKey(key), draft);
    }
  } catch {
    // Demo-only draft cache; failures keep the in-memory draft.
  }
}

/** Clear the locally kept draft after a successful canonical save. */
export function clearCommentDraft(
  key: string,
  store?: DraftStore | null,
): void {
  const resolved = resolveDraftStore(store);
  if (!resolved) return;
  try {
    resolved.removeItem(commentDraftStorageKey(key));
  } catch {
    // Demo-only draft cache; failures keep the in-memory draft.
  }
}

export async function submitIssueComment(
  comments: DemoComment[],
  draft: string,
  save: (body: string) => Promise<DemoComment>,
): Promise<CommentSubmitResult> {
  if (draft.trim() === "") {
    return {
      ok: false,
      comments,
      draft,
      error: "A nonblank demo comment is required.",
    };
  }
  try {
    const comment = await save(draft.trim());
    return {
      ok: true,
      comments: [...comments, comment],
      draft: "",
      error: null,
      comment,
    };
  } catch (error) {
    return {
      ok: false,
      comments,
      draft,
      error: serverMessage(
        error,
        "Demo-only comment save failed. Your draft is kept for retry.",
      ),
    };
  }
}
