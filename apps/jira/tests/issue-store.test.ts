import test from "node:test";
import assert from "node:assert/strict";
import {
  addIssueComment,
  armSaveFailure,
  listComments,
  listIssues,
  resetIssues,
  saveIssuePriority,
} from "../server/utils/issue-store.ts";

test("priority save persists and reload (list) shows the saved value", () => {
  resetIssues();
  const saved = saveIssuePriority("ADEO-1", "Highest");
  assert.equal(saved.ok, true);
  assert.equal(listIssues().find((issue) => issue.key === "ADEO-1")?.priority, "Highest");
});

test("deterministic failure stores nothing and reports the error", () => {
  resetIssues();
  const before = listIssues().find((issue) => issue.key === "ADEO-2")?.priority;
  const failed = saveIssuePriority("ADEO-2", "Lowest", { failSave: true });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.status, 500);
  assert.equal(
    listIssues().find((issue) => issue.key === "ADEO-2")?.priority,
    before,
  );
});

test("armed failure fires once, then the next save succeeds", () => {
  resetIssues();
  armSaveFailure();
  const failed = saveIssuePriority("ADEO-3", "Lowest");
  assert.equal(failed.ok, false);
  const retry = saveIssuePriority("ADEO-3", "Lowest");
  assert.equal(retry.ok, true);
  assert.equal(listIssues().find((issue) => issue.key === "ADEO-3")?.priority, "Lowest");
});

test("unknown priority and unknown issue are rejected with status codes", () => {
  resetIssues();
  const badPriority = saveIssuePriority("ADEO-1", "Urgent");
  assert.equal(badPriority.ok, false);
  if (!badPriority.ok) assert.equal(badPriority.status, 400);
  const missing = saveIssuePriority("ADEO-999", "High");
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.status, 404);
});

test("reset restores seeded fixtures", () => {
  saveIssuePriority("ADEO-1", "Lowest");
  resetIssues();
  assert.equal(
    listIssues().find((issue) => issue.key === "ADEO-1")?.priority,
    "Medium",
  );
});

test("comment save appends to that issue thread and survives list reads", () => {
  resetIssues();
  const before = listComments("ADEO-1").length;
  const saved = addIssueComment("ADEO-1", "  Hello from the demo thread  ");
  assert.equal(saved.ok, true);
  if (saved.ok) {
    assert.equal(saved.comment.author, "Demo member (synthetic)");
    assert.equal(saved.comment.body, "Hello from the demo thread");
  }
  assert.equal(listComments("ADEO-1").length, before + 1);
  assert.equal(listComments("ADEO-2").length, 2);
});

test("comment threads are isolated per issue", () => {
  resetIssues();
  const saved = addIssueComment("ADEO-4", "Only on ADEO-4");
  assert.equal(saved.ok, true);
  assert.ok(
    listComments("ADEO-4").some((comment) => comment.body === "Only on ADEO-4"),
  );
  assert.ok(
    !listComments("ADEO-1").some((comment) => comment.body === "Only on ADEO-4"),
  );
});

test("failed comment save stores nothing for draft-retention UI", () => {
  resetIssues();
  const before = listComments("ADEO-1");
  const failed = addIssueComment("ADEO-1", "Keep my draft", { failSave: true });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.status, 500);
  assert.deepEqual(
    listComments("ADEO-1").map((comment) => comment.id),
    before.map((comment) => comment.id),
  );
});

test("empty comment and unknown issue are rejected with status codes", () => {
  resetIssues();
  const empty = addIssueComment("ADEO-1", "   ");
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.status, 400);
  const missing = addIssueComment("ADEO-999", "Hello");
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.status, 404);
});

test("reset restores seeded comment threads", () => {
  resetIssues();
  addIssueComment("ADEO-1", "Temporary thread addition");
  resetIssues();
  assert.equal(listComments("ADEO-1").length, 1);
});
