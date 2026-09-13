import test from "node:test";
import assert from "node:assert/strict";
import {
  columnIssues,
  isObservedStatus,
  moveIssue,
  moveTargets,
  type BoardIssue,
} from "../app/utils/boardMove.ts";

const seed: BoardIssue[] = [
  { key: "ADEO-1", title: "One", type: "Story", status: "To Do", priority: "Medium", assignee: "Unassigned", description: "demo" },
  { key: "ADEO-2", title: "Two", type: "Task", status: "In Progress", priority: "High", assignee: "Demo member", description: "demo" },
];

test("keyboard-first move saves and returns the new column", async () => {
  const result = await moveIssue(seed, "ADEO-1", "In Progress", async () => ({
    ...seed[0]!,
    status: "In Progress",
  }));
  assert.equal(result.ok, true);
  assert.equal(
    result.issues.find((issue) => issue.key === "ADEO-1")?.status,
    "In Progress",
  );
  assert.deepEqual(
    columnIssues(result.issues, "In Progress").map((issue) => issue.key),
    ["ADEO-1", "ADEO-2"],
  );
});

test("failed save keeps the original column, reports an error, and keeps selection input", async () => {
  const before = seed.map((issue) => ({ ...issue }));
  const result = await moveIssue(seed, "ADEO-1", "In Progress", async () => {
    throw new Error("Demo-only save failure (deterministic test path).");
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.issues, before);
  assert.match(result.error, /Demo-only save failure/);
  // Caller contract: selection key is preserved by the UI layer; the failed
  // result still references the original issue so drafts are not lost.
  assert.equal(
    result.issues.find((issue) => issue.key === "ADEO-1")?.status,
    "To Do",
  );
});

test("unknown statuses are rejected without touching issues", async () => {
  let saves = 0;
  const result = await moveIssue(seed, "ADEO-1", "Archived", async () => {
    saves += 1;
    return { ...seed[0]!, status: "Archived" };
  });
  assert.equal(result.ok, false);
  assert.equal(saves, 0);
  assert.deepEqual(result.issues, seed);
  assert.equal(isObservedStatus("Archived"), false);
  assert.equal(isObservedStatus("Done"), true);
});

test("move targets offer only the allowed demo transition for keyboard operation", () => {
  assert.deepEqual(moveTargets(["To Do", "In Progress", "In Review", "Done"], "To Do"), [
    "In Progress",
  ]);
  assert.deepEqual(moveTargets(["To Do", "In Progress", "In Review", "Done"], "Done"), [
    "To Do",
  ]);
  // Unknown statuses keep the old fallback (exclude only the current
  // column) so keyboard operation never strands an issue.
  assert.deepEqual(moveTargets(["To Do", "In Progress", "Archived"], "Archived"), [
    "To Do",
    "In Progress",
  ]);
});
