import test from "node:test";
import assert from "node:assert/strict";
import {
  getIssues,
  resetIssues,
  updateIssue,
  updateIssueStatus,
} from "../server/utils/issues.ts";
import {
  changePriority,
  isPriority,
  type BoardIssue,
} from "../app/utils/boardMove.ts";

const boardSeed: BoardIssue[] = [
  { key: "ADEO-1", title: "One", type: "Story", status: "To Do", priority: "Medium", assignee: "Unassigned", description: "demo" },
  { key: "ADEO-2", title: "Two", type: "Task", status: "In Progress", priority: "High", assignee: "Demo member", description: "demo" },
];

test("priority update persists and survives a reload read", () => {
  resetIssues();
  const updated = updateIssue("ADEO-1", { priority: "Highest" });
  assert.equal(updated.ok, true);
  assert.equal(
    getIssues().find((issue) => issue.key === "ADEO-1")?.priority,
    "Highest",
  );
  // A reload is a fresh read of the same demo-only store.
  assert.equal(
    getIssues().find((issue) => issue.key === "ADEO-1")?.priority,
    "Highest",
  );
  resetIssues();
});

test("priority can be saved together with status on one PATCH", () => {
  resetIssues();
  const updated = updateIssue("ADEO-1", { status: "In Progress", priority: "Low" });
  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.issue.status, "In Progress");
    assert.equal(updated.issue.priority, "Low");
  }
  resetIssues();
});

test("unknown priority and unknown key are rejected without writing", () => {
  resetIssues();
  const badValue = updateIssue("ADEO-1", { priority: "Urgent" });
  assert.equal(badValue.ok, false);
  assert.match(badValue.ok ? "" : badValue.error, /Allowed demo priorities/);
  assert.equal(badValue.ok ? 0 : badValue.statusCode, 400);
  assert.equal(
    getIssues().find((issue) => issue.key === "ADEO-1")?.priority,
    "Medium",
  );
  const badKey = updateIssue("ADEO-9", { priority: "High" });
  assert.equal(badKey.ok, false);
  assert.equal(badKey.ok ? 0 : badKey.statusCode, 404);
  // Priority-only validation leaves the status path untouched.
  const statusStill = updateIssueStatus("ADEO-1", "In Progress");
  assert.equal(statusStill.ok, true);
  resetIssues();
});

test("reset clears priority overrides back to fixtures", () => {
  resetIssues();
  updateIssue("ADEO-1", { priority: "Lowest" });
  assert.equal(
    getIssues().find((issue) => issue.key === "ADEO-1")?.priority,
    "Lowest",
  );
  resetIssues();
  assert.equal(
    getIssues().find((issue) => issue.key === "ADEO-1")?.priority,
    "Medium",
  );
});

test("deterministic priority failure never writes false success", () => {
  resetIssues();
  const failed = updateIssue("ADEO-1", { priority: "High" }, { fail: true });
  assert.equal(failed.ok, false);
  assert.equal(
    getIssues().find((issue) => issue.key === "ADEO-1")?.priority,
    "Medium",
  );
  resetIssues();
});

test("client helper recovers from a failed save with original priority and error", async () => {
  const before = boardSeed.map((issue) => ({ ...issue }));
  const result = await changePriority(boardSeed, "ADEO-1", "Highest", async () => {
    throw new Error("Demo-only save failure (deterministic test path).");
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues, before);
  assert.match(result.error, /Demo-only save failure/);
  // The draft selection is still available for retry: the attempted value is
  // known to the caller and the displayed row keeps the original priority.
  assert.equal(
    result.issues.find((issue) => issue.key === "ADEO-1")?.priority,
    "Medium",
  );
  assert.equal(isPriority("Urgent"), false);
  assert.equal(isPriority("Highest"), true);
});

test("client helper rejects unknown priority before saving", async () => {
  let saves = 0;
  const result = await changePriority(boardSeed, "ADEO-1", "Urgent", async () => {
    saves += 1;
    return { ...boardSeed[0]!, priority: "Urgent" };
  });
  assert.equal(result.ok, false);
  assert.equal(saves, 0);
  assert.deepEqual(result.issues, boardSeed);
});

test("client helper saves a new priority optimistically", async () => {
  const result = await changePriority(boardSeed, "ADEO-1", "Low", async () => ({
    ...boardSeed[0]!,
    priority: "Low",
  }));
  assert.equal(result.ok, true);
  assert.equal(
    result.issues.find((issue) => issue.key === "ADEO-1")?.priority,
    "Low",
  );
});
