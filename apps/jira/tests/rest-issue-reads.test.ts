import test from "node:test";
import assert from "node:assert/strict";
import {
  addComment,
  createIssue,
  getIssue,
  getIssues,
  resetIssues,
  updateIssue,
} from "../server/utils/issues.ts";
import {
  restComments,
  restIssue,
  restSearch,
  toRestIssue,
  type RestComment,
  type RestIssue,
  type RestSearchResponse,
} from "../server/utils/jiraRest.ts";
import {
  boardFilteredLabel,
  boardFilteredSummary,
  boardSearchUrl,
  boardPageForStartAt,
  boardStartAtForPage,
  boardTotalPages,
  boardVisibleRange,
  clampBoardStartAt,
  fetchBoardIssues,
  hasNextBoardPage,
  hasPrevBoardPage,
  restCommentToDemoComment,
  restCommentsToDemoComments,
  restCommentsUrl,
  restIssueToBoardIssue,
  restIssueUrl,
  restSearchToBoardIssues,
  REST_BOARD_PAGE_SIZE,
  REST_BOARD_START_AT,
  type RestIssueShape,
  type RestSearchShape,
} from "../app/utils/restIssues.ts";
import {
  failedDetail,
  fetchIssueDetail,
  loadedDetail,
  type IssueDetailResponse,
} from "../app/utils/issueDetail.ts";
import {
  fetchIssueComments,
  type IssueCommentsResponse,
} from "../app/utils/issueComments.ts";

/** Real REST search shape straight off the canonical server adapter. */
function liveSearchFetch(calls: string[]) {
  return async (url: string): Promise<RestSearchShape> => {
    calls.push(url);
    const parsed = new URL(url, "http://demo.test");
    const result = await restSearch(
      Object.fromEntries(parsed.searchParams.entries()),
    );
    assert.equal(result.ok, true);
    return result.ok ? (result.data as RestSearchResponse) : { issues: [] };
  };
}

/** Real single-issue shape straight off the canonical server adapter. */
function liveIssueFetch(calls: string[]) {
  return async (url: string): Promise<IssueDetailResponse> => {
    calls.push(url);
    const key = decodeURIComponent(url.split("/").pop() ?? "");
    const result = await restIssue(key);
    if (!result.ok) {
      const error = new Error(result.error) as Error & {
        data: { message: string };
      };
      error.data = { message: result.error };
      throw error;
    }
    return result.data as RestIssue;
  };
}

/** Real comment-list shape straight off the canonical server adapter. */
function liveCommentsFetch(calls: string[]) {
  return async (url: string): Promise<IssueCommentsResponse> => {
    calls.push(url);
    const match = /\/issue\/([^/]+)\/comment/.exec(url);
    const key = decodeURIComponent(match?.[1] ?? "");
    const result = await restComments(key, {});
    if (!result.ok) {
      throw new Error(result.error);
    }
    return {
      comments: result.data.comments,
      startAt: result.data.startAt,
      maxResults: result.data.maxResults,
      total: result.data.total,
      demoOnly: true,
    };
  };
}

test("board-search URL is bounded and maps the canonical search envelope", async () => {
  assert.equal(
    boardSearchUrl(),
    `/api/rest/api/3/search?startAt=${REST_BOARD_START_AT}&maxResults=${REST_BOARD_PAGE_SIZE}`,
  );
  const bean = toRestIssue(getIssues()[0]!);
  const mapped = restIssueToBoardIssue(bean as RestIssueShape);
  assert.deepEqual(mapped, {
    key: bean.key,
    title: bean.fields.summary,
    type: bean.fields.issuetype.name,
    status: bean.fields.status.name,
    priority: bean.fields.priority.name,
    assignee: bean.fields.assignee.displayName,
    description: bean.fields.description,
  });
  assert.deepEqual(restSearchToBoardIssues({}), []);
  const adapted = await restSearch({});
  assert.equal(adapted.ok, true);
  if (adapted.ok) {
    assert.deepEqual(
      restSearchToBoardIssues(adapted.data).map((issue) => issue.key),
      getIssues().map((issue) => issue.key),
    );
  }
});

test("board list reads the canonical search route and stays honest on failure", async () => {
  resetIssues();
  const calls: string[] = [];
  const result = await fetchBoardIssues(liveSearchFetch(calls));
  assert.deepEqual(calls, [boardSearchUrl()]);
  assert.equal(result.total, getIssues().length);
  assert.deepEqual(
    result.issues.map((issue) => issue.key),
    getIssues().map((issue) => issue.key),
  );
  assert.deepEqual(result.issues[0], {
    ...getIssue(result.issues[0]!.key)!,
  });
  await assert.rejects(
    fetchBoardIssues(async () => {
      throw new Error("REST search transport failure.");
    }),
    /REST search transport failure\./,
  );
  resetIssues();
});

test("detail reads the canonical issue route and maps summary to title", async () => {
  resetIssues();
  const calls: string[] = [];
  assert.equal(restIssueUrl("ADEO-1"), "/api/rest/api/3/issue/ADEO-1");
  const result = await fetchIssueDetail("ADEO-1", liveIssueFetch(calls));
  assert.deepEqual(calls, ["/api/rest/api/3/issue/ADEO-1"]);
  assert.deepEqual(result.issue, { ...getIssue("ADEO-1")! });
  assert.equal(result.demoOnly, true);
  const loaded = loadedDetail(result);
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.issue, { ...getIssue("ADEO-1")! });
  resetIssues();
});

test("detail clears stale data and reports the canonical unknown-key error", async () => {
  resetIssues();
  const calls: string[] = [];
  await assert.rejects(
    fetchIssueDetail("ADEO-9999", liveIssueFetch(calls)),
    /Unknown issue key: ADEO-9999\./,
  );
  const failed = failedDetail(
    Object.assign(new Error("transport"), {
      data: { message: "Unknown issue key: ADEO-9999. Demo-only REST read; nothing was written." },
    }),
  );
  assert.equal(failed.issue, null);
  assert.equal(failed.demoOnly, false);
  assert.match(failed.error ?? "", /Unknown issue key: ADEO-9999\./);
  assert.match(failed.error ?? "", /nothing was written/);
  resetIssues();
});

test("detail reflects demo writes through the canonical read", async () => {
  resetIssues();
  const created = createIssue({ title: "Canonical detail reload" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  assert.equal(updateIssue(key, { status: "In Progress" }).ok, true);
  const calls: string[] = [];
  const reloaded = await fetchIssueDetail(key, liveIssueFetch(calls));
  assert.equal(reloaded.issue.status, "In Progress");
  assert.deepEqual(reloaded.issue, { ...getIssue(key)! });
  resetIssues();
});

test("comments read the canonical comment route and map author/created", async () => {
  resetIssues();
  assert.equal(
    restCommentsUrl("ADEO-1"),
    `/api/rest/api/3/issue/ADEO-1/comment?startAt=${REST_BOARD_START_AT}&maxResults=${REST_BOARD_PAGE_SIZE}`,
  );
  assert.equal(addComment("ADEO-1", { body: "Canonical comment" }).ok, true);
  const commentResult = await restComments("ADEO-1", {});
  const single: RestComment = commentResult.ok
    ? commentResult.data.comments[0]!
    : ({} as RestComment);
  const mapped = restCommentToDemoComment(single);
  assert.equal(mapped.body, "Canonical comment");
  assert.equal(typeof mapped.author, "string");
  assert.ok(mapped.author.length > 0);
  assert.equal(typeof mapped.createdAt, "string");
  assert.deepEqual(restCommentsToDemoComments({}), []);
  const calls: string[] = [];
  const result = await fetchIssueComments("ADEO-1", liveCommentsFetch(calls));
  assert.deepEqual(calls, [restCommentsUrl("ADEO-1")]);
  assert.equal(result.demoOnly, true);
  assert.deepEqual(
    result.comments.map((comment) => comment.body),
    ["Canonical comment"],
  );
  resetIssues();
});

test("comment read stays honest for unknown keys", async () => {
  resetIssues();
  await assert.rejects(
    fetchIssueComments("ADEO-9999", liveCommentsFetch([])),
    /Unknown issue key: ADEO-9999\./,
  );
  resetIssues();
});

/**
 * Bounded board paging math: fixed startAt/maxResults=50 windows over the
 * reported store total. Out-of-range offsets surface an empty range with
 * the intact total instead of fixture fallback.
 */
test("board paging math stays inside bounded startAt/maxResults windows", () => {
  assert.equal(boardStartAtForPage(1), REST_BOARD_START_AT);
  assert.equal(boardStartAtForPage(2), REST_BOARD_PAGE_SIZE);
  assert.equal(boardStartAtForPage(0), REST_BOARD_START_AT);
  assert.equal(boardPageForStartAt(0), 1);
  assert.equal(boardPageForStartAt(REST_BOARD_PAGE_SIZE), 2);
  assert.equal(boardTotalPages(0), 1);
  assert.equal(boardTotalPages(REST_BOARD_PAGE_SIZE), 1);
  assert.equal(boardTotalPages(REST_BOARD_PAGE_SIZE + 1), 2);
  assert.equal(hasPrevBoardPage(REST_BOARD_START_AT), false);
  assert.equal(hasPrevBoardPage(REST_BOARD_PAGE_SIZE), true);
  assert.equal(
    hasNextBoardPage(
      REST_BOARD_START_AT,
      REST_BOARD_PAGE_SIZE,
      REST_BOARD_PAGE_SIZE + 1,
    ),
    true,
  );
  assert.equal(
    hasNextBoardPage(
      REST_BOARD_PAGE_SIZE,
      REST_BOARD_PAGE_SIZE,
      REST_BOARD_PAGE_SIZE + 1,
    ),
    false,
  );
  assert.deepEqual(
    boardVisibleRange(0, REST_BOARD_PAGE_SIZE, 4, 4),
    { start: 1, end: 4 },
  );
  assert.deepEqual(
    boardVisibleRange(REST_BOARD_PAGE_SIZE, REST_BOARD_PAGE_SIZE, 59, 9),
    { start: 51, end: 59 },
  );
  assert.deepEqual(
    boardVisibleRange(500, REST_BOARD_PAGE_SIZE, 59, 0),
    { start: 0, end: 0 },
  );
  assert.equal(
    clampBoardStartAt(500, REST_BOARD_PAGE_SIZE + 1),
    REST_BOARD_PAGE_SIZE,
  );
  assert.equal(clampBoardStartAt(-5, 10), REST_BOARD_START_AT);
  assert.equal(clampBoardStartAt(0, 0), REST_BOARD_START_AT);
});

/** Second bounded page reads keys the single-page board used to truncate. */
test("board list pages past 50 through bounded startAt windows", async () => {
  resetIssues();
  const created: string[] = [];
  try {
    for (let bulk = 0; bulk < 55; bulk += 1) {
      const made = createIssue({ title: `Bulk paging issue ${bulk}` });
      assert.equal(made.ok, true);
      if (made.ok) created.push(made.issue.key);
    }
    const calls: string[] = [];
    const first = await fetchBoardIssues(liveSearchFetch(calls));
    assert.equal(first.total, getIssues().length);
    assert.ok(first.total > REST_BOARD_PAGE_SIZE);
    assert.equal(first.issues.length, REST_BOARD_PAGE_SIZE);
    const second = await fetchBoardIssues(
      liveSearchFetch(calls),
      REST_BOARD_PAGE_SIZE,
      REST_BOARD_PAGE_SIZE,
    );
    assert.equal(second.total, first.total);
    assert.deepEqual(calls, [
      boardSearchUrl(),
      boardSearchUrl(REST_BOARD_PAGE_SIZE, REST_BOARD_PAGE_SIZE),
    ]);
    assert.deepEqual(
      second.issues.map((issue) => issue.key),
      getIssues()
        .slice(REST_BOARD_PAGE_SIZE, REST_BOARD_PAGE_SIZE * 2)
        .map((issue) => issue.key),
    );
    // No overlap and no fixture fallback: every key beyond 50 is a stored key.
    const firstKeys = new Set(first.issues.map((issue) => issue.key));
    for (const issue of second.issues) {
      assert.equal(firstKeys.has(issue.key), false);
      assert.ok(getIssue(issue.key) !== undefined);
    }
  } finally {
    resetIssues();
  }
});

/** An out-of-range page fails honestly with an empty window, not fixtures. */
test("board list stays honest on an out-of-range startAt page", async () => {
  resetIssues();
  const calls: string[] = [];
  const result = await fetchBoardIssues(
    liveSearchFetch(calls),
    10_000,
    REST_BOARD_PAGE_SIZE,
  );
  assert.deepEqual(calls, [boardSearchUrl(10_000, REST_BOARD_PAGE_SIZE)]);
  assert.equal(result.total, getIssues().length);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(
    boardVisibleRange(10_000, REST_BOARD_PAGE_SIZE, result.total, 0),
    { start: 0, end: 0 },
  );
  resetIssues();
});

/**
 * Filtered count/range honesty: selecting one match out of a 4-issue window
 * must report "1 of 4 in this window" with the server window 1-4, never
 * "1 of 4 issues · showing 1-4 of 4 issues" (which reads as if the store
 * filtered down to one issue). Mirrors the reported Board + "issue list"
 * case: only ADEO-2 visible.
 */
test("filtered summary stays window-scoped instead of reusing the store total", () => {
  resetIssues();
  try {
    const windowed = getIssues().slice(0, 4);
    assert.equal(windowed.length, 4);
    const matches = windowed.filter((issue) =>
      `${issue.key} ${issue.title}`.toLowerCase().includes("issue list"),
    );
    assert.deepEqual(
      matches.map((issue) => issue.key),
      ["ADEO-2"],
    );
    const summary = boardFilteredSummary(matches.length, windowed.length, 4);
    assert.deepEqual(summary, { shown: 1, windowSize: 4, windowTotal: 4 });
    assert.equal(boardFilteredLabel(summary), "1 of 4 in this window (match)");
    // A search larger than one page stays scoped to its loaded window too.
    const paged = boardFilteredSummary(9, 50, 59);
    assert.equal(
      boardFilteredLabel(paged),
      "9 of 50 in this window (matches)",
    );
    assert.deepEqual(
      boardVisibleRange(0, REST_BOARD_PAGE_SIZE, 59, 50),
      { start: 1, end: 50 },
    );
  } finally {
    resetIssues();
  }
});
