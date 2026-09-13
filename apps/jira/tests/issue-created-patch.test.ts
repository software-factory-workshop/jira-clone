import test from "node:test";
import assert from "node:assert/strict";
import {
  createIssue,
  getIssue,
  getIssues,
  resetIssues,
  updateIssue,
} from "../server/utils/issues.ts";

test("created demo issues are editable through the PATCH save path", () => {
  resetIssues();
  const created = createIssue({ title: "Demo follow-up" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  const updated = updateIssue(key, { status: "In Progress", priority: "High" });
  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.issue.key, key);
    assert.equal(updated.issue.status, "In Progress");
    assert.equal(updated.issue.priority, "High");
  }
  resetIssues();
});

test("created-issue edits agree across list and single read (same-server reload)", () => {
  resetIssues();
  const created = createIssue({ title: "Demo save-path check" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  const updated = updateIssue(key, { status: "In Progress", priority: "Lowest" });
  assert.equal(updated.ok, true);
  // A reload is a fresh read of the same demo-only store.
  assert.deepEqual(getIssue(key), getIssues().find((issue) => issue.key === key));
  assert.equal(getIssue(key)?.status, "In Progress");
  assert.equal(getIssues().find((issue) => issue.key === key)?.priority, "Lowest");
  resetIssues();
});

test("unknown keys remain 404 and unknown values reject before writing", () => {
  resetIssues();
  const created = createIssue({ title: "Demo validation check" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  const before = getIssue(key);
  const badKey = updateIssue("ADEO-9999", { status: "In Progress" });
  assert.equal(badKey.ok, false);
  assert.equal(badKey.ok ? 0 : badKey.statusCode, 404);
  const badStatus = updateIssue(key, { status: "Archived" });
  assert.equal(badStatus.ok, false);
  assert.equal(badStatus.ok ? 0 : badStatus.statusCode, 400);
  const badPriority = updateIssue(key, { priority: "Urgent" });
  assert.equal(badPriority.ok, false);
  assert.equal(badPriority.ok ? 0 : badPriority.statusCode, 400);
  assert.deepEqual(getIssue(key), before);
  resetIssues();
});

test("deterministic failure on a created issue writes nothing", () => {
  resetIssues();
  const created = createIssue({ title: "Demo failure check" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  const before = getIssue(key);
  const failed = updateIssue(key, { status: "In Progress" }, { fail: true });
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? 0 : failed.statusCode, 500);
  assert.deepEqual(getIssue(key), before);
  resetIssues();
});

test("reset clears created issues and overrides", () => {
  resetIssues();
  const created = createIssue({ title: "Demo reset check" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  assert.equal(updateIssue(key, { priority: "Highest" }).ok, true);
  assert.equal(updateIssue("ADEO-1", { priority: "Lowest" }).ok, true);
  resetIssues();
  assert.equal(getIssue(key), undefined);
  assert.deepEqual(
    getIssues().map((issue) => issue.key),
    ["ADEO-1", "ADEO-2", "ADEO-3", "ADEO-4"],
  );
  assert.equal(
    getIssues().find((issue) => issue.key === "ADEO-1")?.priority,
    "Medium",
  );
});
