import test from "node:test";
import assert from "node:assert/strict";
import {
  createIssue,
  getIssue,
  getIssues,
  resetIssues,
} from "../server/utils/issues.ts";

test("creation allocates the next demo key with fixture defaults", () => {
  resetIssues();
  const created = createIssue({ title: "A demo-only follow-up" });
  assert.equal(created.ok, true);
  if (created.ok) {
    assert.equal(created.issue.key, "ADEO-5");
    assert.equal(created.issue.title, "A demo-only follow-up");
    assert.equal(created.issue.type, "Task");
    assert.equal(created.issue.status, "To Do");
    assert.equal(created.issue.priority, "Medium");
    assert.equal(created.issue.assignee, "Unassigned");
    assert.equal(created.issue.description, "");
  }
  resetIssues();
});

test("created issues appear in list and single read, then reset", () => {
  resetIssues();
  const created = createIssue({
    title: "Demo save-path check",
    status: "In Progress",
    priority: "Highest",
    assignee: "Demo member",
    description: "demo",
  });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  assert.ok(getIssues().some((issue) => issue.key === key));
  assert.deepEqual(
    getIssue(key),
    getIssues().find((issue) => issue.key === key),
  );
  // A reload is a fresh read of the same demo-only store.
  assert.ok(getIssues().some((issue) => issue.key === key));
  resetIssues();
  assert.equal(getIssue(key), undefined);
  assert.deepEqual(
    getIssues().map((issue) => issue.key),
    ["ADEO-1", "ADEO-2", "ADEO-3", "ADEO-4"],
  );
});

test("blank titles and unknown values are rejected before writing", () => {
  resetIssues();
  const before = getIssues();
  for (const title of ["", "   ", undefined]) {
    const rejected = createIssue({ title });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.ok ? 0 : rejected.statusCode, 400);
  }
  const badStatus = createIssue({ title: "Nope", status: "Archived" });
  assert.equal(badStatus.ok, false);
  assert.equal(badStatus.ok ? 0 : badStatus.statusCode, 400);
  const badPriority = createIssue({ title: "Nope", priority: "Urgent" });
  assert.equal(badPriority.ok, false);
  assert.equal(badPriority.ok ? 0 : badPriority.statusCode, 400);
  assert.deepEqual(getIssues(), before);
  resetIssues();
});

test("deterministic failure writes nothing", () => {
  resetIssues();
  const before = getIssues();
  const failed = createIssue({ title: "Never saved" }, { fail: true });
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? 0 : failed.statusCode, 500);
  assert.deepEqual(getIssues(), before);
  assert.equal(getIssue("ADEO-5"), undefined);
  resetIssues();
});

test("keys keep increasing on the same server", () => {
  resetIssues();
  const first = createIssue({ title: "First" });
  const second = createIssue({ title: "Second" });
  assert.equal(first.ok ? first.issue.key : "", "ADEO-5");
  assert.equal(second.ok ? second.issue.key : "", "ADEO-6");
  resetIssues();
});
