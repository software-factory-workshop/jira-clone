/**
 * Pure client-side mapper for the canonical demo-only Jira-shaped REST reads.
 *
 * The board list reads `GET /api/rest/api/3/search` with bounded
 * `startAt`/`maxResults`, single-issue detail reads
 * `GET /api/rest/api/3/issue/:key`, and comments read
 * `GET /api/rest/api/3/issue/:key/comment` with the same bounds. These
 * helpers translate those Jira-shaped envelopes back to the existing
 * `BoardIssue`/`DemoComment` display shapes so filters, priority/status
 * controls and ADEO Nuxt UI behavior are unchanged.
 *
 * Pure; never writes and never claims a result: transport failures
 * propagate to the caller, which reports them honestly without rendering
 * fixtures as REST results.
 */

import type { BoardIssue } from "./boardMove";
import type { DemoComment } from "./issueComments";

/** Board list page: matches the server `REST_MAX_MAX_RESULTS` hard bound. */
export const REST_BOARD_START_AT = 0;
export const REST_BOARD_PAGE_SIZE = 50;

/** Client-side mirror of the server `RestIssue` bean (tolerant of partial shapes). */
export type RestIssueShape = {
  id?: string;
  key: string;
  self?: string;
  fields: {
    summary?: string;
    issuetype?: { name?: string };
    status?: { name?: string };
    priority?: { name?: string };
    assignee?: { displayName?: string };
    description?: string;
    project?: { id?: string; key?: string; name?: string };
  };
  demoOnly?: boolean;
};

/** Client-side mirror of the server `RestSearchResponse` envelope. */
export type RestSearchShape = {
  startAt?: number;
  maxResults?: number;
  total?: number;
  issues?: RestIssueShape[];
  demoOnly?: boolean;
};

/** Client-side mirror of one server `RestComment`. */
export type RestCommentShape = {
  id?: string;
  body?: string;
  author?: { displayName?: string };
  created?: string;
  demoOnly?: boolean;
};

/** Client-side mirror of the server `RestCommentList` envelope. */
export type RestCommentListShape = {
  startAt?: number;
  maxResults?: number;
  total?: number;
  comments?: RestCommentShape[];
  demoOnly?: boolean;
};

/** Canonical single-issue read URL for one demo key. */
export function restIssueUrl(key: string): string {
  return `/api/rest/api/3/issue/${encodeURIComponent(key)}`;
}

/** Canonical board-list read URL with bounded `startAt`/`maxResults`. */
export function boardSearchUrl(
  startAt: number = REST_BOARD_START_AT,
  maxResults: number = REST_BOARD_PAGE_SIZE,
): string {
  return `/api/rest/api/3/search?startAt=${startAt}&maxResults=${maxResults}`;
}

/** Canonical comment-write URL for one demo key. */
export function restCommentWriteUrl(key: string): string {
  return `/api/rest/api/3/issue/${encodeURIComponent(key)}/comment`;
}

/** Canonical comment-list read URL for one demo key with bounded pagination. */
export function restCommentsUrl(
  key: string,
  startAt: number = REST_BOARD_START_AT,
  maxResults: number = REST_BOARD_PAGE_SIZE,
): string {
  return `/api/rest/api/3/issue/${encodeURIComponent(key)}/comment?startAt=${startAt}&maxResults=${maxResults}`;
}

/**
 * Map one Jira-shaped issue bean to the existing board display shape:
 * `summary` -> `title`, plus status/priority/assignee mapping. Missing
 * fields fall back to empty strings so the UI never crashes on a partial
 * envelope; callers still surface transport failures honestly.
 */
export function restIssueToBoardIssue(issue: RestIssueShape): BoardIssue {
  const fields = issue?.fields ?? {};
  return {
    key: issue?.key ?? "",
    title: fields.summary ?? "",
    type: fields.issuetype?.name ?? "",
    status: fields.status?.name ?? "",
    priority: fields.priority?.name ?? "",
    assignee: fields.assignee?.displayName ?? "",
    description: fields.description ?? "",
  };
}

/** Map a search-lite envelope to the board display list, preserving order. */
export function restSearchToBoardIssues(response: RestSearchShape): BoardIssue[] {
  const issues = response?.issues;
  if (!Array.isArray(issues)) return [];
  return issues.map(restIssueToBoardIssue);
}

/** Map one Jira-shaped comment to the existing demo comment display shape. */
export function restCommentToDemoComment(comment: RestCommentShape): DemoComment {
  return {
    id: comment?.id ?? "",
    body: comment?.body ?? "",
    author: comment?.author?.displayName ?? "",
    createdAt: comment?.created ?? "",
    demoOnly: true,
  };
}

/** Map a comment-list envelope to the demo comment display list. */
export function restCommentsToDemoComments(
  response: RestCommentListShape,
): DemoComment[] {
  const comments = response?.comments;
  if (!Array.isArray(comments)) return [];
  return comments.map(restCommentToDemoComment);
}

export type BoardListResult = {
  issues: BoardIssue[];
  total: number;
};

/**
 * Board-list read through the canonical search-lite route with bounded
 * `startAt`/`maxResults`.
 *
 * The caller supplies a JSON fetcher (Nuxt `$fetch` in the app, a stub in
 * tests). Rejections propagate so the UI reports loading/transport
 * failures honestly instead of claiming a REST result.
 */
export async function fetchBoardIssues(
  fetchJson: (url: string) => Promise<RestSearchShape>,
  startAt: number = REST_BOARD_START_AT,
  maxResults: number = REST_BOARD_PAGE_SIZE,
): Promise<BoardListResult> {
  const data = await fetchJson(boardSearchUrl(startAt, maxResults));
  return {
    issues: restSearchToBoardIssues(data),
    total: typeof data?.total === "number" ? data.total : 0,
  };
}
