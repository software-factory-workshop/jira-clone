import type { BoardIssue } from "./boardMove";

export type IssueDetailResponse = {
  issue: BoardIssue;
  demoOnly?: boolean;
};

export type IssueDetailResult = {
  issue: BoardIssue;
  demoOnly: boolean;
};

export type IssueDetailState = {
  issue: BoardIssue | null;
  demoOnly: boolean;
  error: string | null;
};

/**
 * Single-issue detail read through GET /api/issues/:key.
 *
 * The caller supplies a JSON fetcher (Nuxt `$fetch` in the dialog, a stub in
 * tests) so list cards stay on the list endpoint while the detail dialog
 * renders this server read. Rejections propagate so the dialog can keep the
 * selected key, clear stale detail and report the error without claiming
 * success.
 */
export async function fetchIssueDetail(
  key: string,
  fetchJson: (url: string) => Promise<IssueDetailResponse>,
): Promise<IssueDetailResult> {
  const data = await fetchJson(`/api/issues/${key}`);
  return { issue: data.issue, demoOnly: data.demoOnly === true };
}

/** Detail state for a successful single-issue read. */
export function loadedDetail(result: IssueDetailResult): IssueDetailState {
  return { issue: result.issue, demoOnly: result.demoOnly, error: null };
}

/**
 * Detail state for a failed single-issue read. Stale detail is cleared so an
 * unknown key never renders list data as detail; callers keep the selected
 * key and never claim success.
 */
export function failedDetail(error: unknown): IssueDetailState {
  return {
    issue: null,
    demoOnly: false,
    error:
      error instanceof Error ? error.message : "Could not load issue detail.",
  };
}
