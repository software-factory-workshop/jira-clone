import type { BoardIssue } from "./boardMove";
import {
  restIssueToBoardIssue,
  restIssueUrl,
  type RestIssueShape,
} from "./restIssues.ts";
import { serverMessage } from "./errorMessage.ts";

export type IssueDetailResponse = RestIssueShape;

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
 * Single-issue detail read through the canonical Jira-shaped route
 * GET /api/rest/api/3/issue/:key.
 *
 * The caller supplies a JSON fetcher (Nuxt `$fetch` in the dialog, a stub in
 * tests) so list cards stay on the search-lite read while the detail dialog
 * renders this canonical server read. The Jira-shaped bean is mapped back to
 * the existing `BoardIssue` display shape. Rejections propagate so the
 * dialog can keep the selected key, clear stale detail and report the error
 * without claiming success.
 */
export async function fetchIssueDetail(
  key: string,
  fetchJson: (url: string) => Promise<IssueDetailResponse>,
): Promise<IssueDetailResult> {
  const data = await fetchJson(restIssueUrl(key));
  return {
    issue: restIssueToBoardIssue(data),
    demoOnly: data?.demoOnly === true,
  };
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
    error: serverMessage(error, "Could not load issue detail."),
  };
}
