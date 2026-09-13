import test from "node:test";
import assert from "node:assert/strict";
import {
  createIssue,
  getIssue,
  resetIssues,
  updateIssue,
} from "../server/utils/issues.ts";
import {
  failedDetail,
  fetchIssueDetail,
  loadedDetail,
  type IssueDetailResponse,
} from "../app/utils/issueDetail.ts";

/** Stub JSON fetcher backed by the real demo-only server store. */
function serverFetch(calls: string[]) {
  return async (url: string): Promise<IssueDetailResponse> => {
    calls.push(url);
    const key = url.split("/").pop() ?? "";
    const issue = getIssue(key);
    if (!issue) {
      throw new Error(`Unknown issue key: ${key}.`);
    }
    return { issue, demoOnly: true };
  };
}

test("selecting an issue reads GET /api/issues/:key with the demo-only label", async () => {
  resetIssues();
  const calls: string[] = [];
  const result = await fetchIssueDetail("ADEO-1", serverFetch(calls));
  assert.deepEqual(calls, ["/api/issues/ADEO-1"]);
  assert.equal(result.issue.key, "ADEO-1");
  assert.equal(result.demoOnly, true);
  const loaded = loadedDetail(result);
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.issue, getIssue("ADEO-1"));
  resetIssues();
});

test("unknown key reports a clear error and clears stale detail", async () => {
  resetIssues();
  const calls: string[] = [];
  const stale = getIssue("ADEO-1");
  assert.ok(stale);
  await assert.rejects(
    fetchIssueDetail("ADEO-9999", serverFetch(calls)),
    /Unknown issue key: ADEO-9999\./,
  );
  const failed = failedDetail(new Error("Unknown issue key: ADEO-9999."));
  assert.equal(failed.issue, null);
  assert.equal(failed.demoOnly, false);
  assert.match(failed.error ?? "", /Unknown issue key: ADEO-9999\./);
  resetIssues();
});

test("updated created issue reflects its server value on reload", async () => {
  resetIssues();
  const created = createIssue({ title: "Demo detail check" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  const updated = updateIssue(key, { status: "In Progress", priority: "Lowest" });
  assert.equal(updated.ok, true);
  const calls: string[] = [];
  const reloaded = await fetchIssueDetail(key, serverFetch(calls));
  assert.equal(reloaded.issue.status, "In Progress");
  assert.equal(reloaded.issue.priority, "Lowest");
  assert.deepEqual(reloaded.issue, getIssue(key));
  resetIssues();
});

test("failed detail fetch preserves the selected key without claiming success", async () => {
  resetIssues();
  let selectedKey: string | null = "ADEO-9999";
  const calls: string[] = [];
  let state = { issue: getIssue("ADEO-1") ?? null, demoOnly: false };
  try {
    const result = await fetchIssueDetail(selectedKey, serverFetch(calls));
    state = { issue: result.issue, demoOnly: result.demoOnly };
  } catch (error) {
    const failed = failedDetail(error);
    state = { issue: failed.issue, demoOnly: failed.demoOnly };
    assert.match(failed.error ?? "", /Unknown issue key/);
  }
  assert.equal(selectedKey, "ADEO-9999");
  assert.equal(state.issue, null);
  assert.equal(state.demoOnly, false);
  resetIssues();
});
