export type DemoComment = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  demoOnly?: boolean;
};

export type IssueCommentsResponse = {
  comments: DemoComment[];
  demoOnly?: boolean;
};

export type IssueCommentsResult = {
  comments: DemoComment[];
  demoOnly: boolean;
};

/**
 * Demo-only per-issue comment read through GET /api/issues/:key/comments.
 *
 * The caller supplies a JSON fetcher (Nuxt `$fetch` in the dialog, a stub in
 * tests) so the dialog renders this server read. Rejections propagate so the
 * dialog can keep the selected key and report the error without claiming
 * success.
 */
export async function fetchIssueComments(
  key: string,
  fetchJson: (url: string) => Promise<IssueCommentsResponse>,
): Promise<IssueCommentsResult> {
  const data = await fetchJson(`/api/issues/${key}/comments`);
  return { comments: data.comments, demoOnly: data.demoOnly === true };
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
      error:
        error instanceof Error
          ? error.message
          : "Demo-only comment save failed. Your draft is kept for retry.",
    };
  }
}
