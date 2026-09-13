import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_TRANSITIONS,
  allowedTransitions,
  createIssue,
  getIssue,
  getIssues,
  isDemoTransition,
  resetIssues,
  updateIssue,
  updateIssueStatus,
} from "../server/utils/issues.ts";
import { authorizeDemoWrite } from "../server/utils/demoAccounts.ts";
import { allowedMoveHint, moveTargets } from "../app/utils/boardMove.ts";

test("demo matrix is the fixed slice with exact fixture labels", () => {
  assert.deepEqual(DEMO_TRANSITIONS, {
    "To Do": ["In Progress"],
    "In Progress": ["In Review"],
    "In Review": ["Done"],
    "Done": ["To Do"],
  });
  assert.deepEqual([...allowedTransitions("To Do")], ["In Progress"]);
  assert.deepEqual([...allowedTransitions("In Progress")], ["In Review"]);
  assert.deepEqual([...allowedTransitions("In Review")], ["Done"]);
  assert.deepEqual([...allowedTransitions("Done")], ["To Do"]);
  assert.equal(isDemoTransition("To Do", "In Progress"), true);
  assert.equal(isDemoTransition("Done", "To Do"), true);
  assert.equal(isDemoTransition("To Do", "Done"), false);
  assert.equal(isDemoTransition("To Do", "To Do"), false);
});

test("each legal step moves and persists on the demo-only store", () => {
  resetIssues();
  assert.equal(updateIssueStatus("ADEO-1", "In Progress").ok, true);
  assert.equal(updateIssueStatus("ADEO-1", "In Review").ok, true);
  assert.equal(updateIssueStatus("ADEO-1", "Done").ok, true);
  assert.equal(updateIssueStatus("ADEO-1", "To Do").ok, true);
  assert.equal(getIssue("ADEO-1")?.status, "To Do");
  resetIssues();
});

test("illegal moves are rejected with structured 409 and write nothing", () => {
  resetIssues();
  const before = getIssue("ADEO-1");
  assert.equal(before?.status, "To Do");
  for (const illegal of ["In Review", "Done"] as const) {
    const rejected = updateIssueStatus("ADEO-1", illegal);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.ok ? 0 : rejected.statusCode, 409);
    assert.match(rejected.ok ? "" : rejected.error, /Demo-only transition rejected/);
    assert.match(rejected.ok ? "" : rejected.error, /Nothing was saved/);
    assert.deepEqual(rejected.ok ? [] : rejected.allowedFrom, ["In Progress"]);
  }
  assert.deepEqual(getIssue("ADEO-1"), before);
  // A skipped-step move on another fixture is also rejected.
  const skipped = updateIssue("ADEO-2", { status: "Done" });
  assert.equal(skipped.ok, false);
  assert.equal(skipped.ok ? 0 : skipped.statusCode, 409);
  assert.deepEqual(skipped.ok ? [] : skipped.allowedFrom, ["In Review"]);
  assert.equal(getIssue("ADEO-2")?.status, "In Progress");
  resetIssues();
});

test("same-status saves are no-ops and priority-only saves bypass the matrix", () => {
  resetIssues();
  const same = updateIssueStatus("ADEO-1", "To Do");
  assert.equal(same.ok, true);
  if (same.ok) assert.equal(same.issue.status, "To Do");
  const priorityOnly = updateIssue("ADEO-1", { priority: "Highest" });
  assert.equal(priorityOnly.ok, true);
  assert.equal(getIssue("ADEO-1")?.status, "To Do");
  assert.equal(getIssue("ADEO-1")?.priority, "Highest");
  // A combined save with an illegal status rejects the whole PATCH.
  const combined = updateIssue("ADEO-1", { status: "Done", priority: "Low" });
  assert.equal(combined.ok, false);
  assert.equal(combined.ok ? 0 : combined.statusCode, 409);
  assert.equal(getIssue("ADEO-1")?.priority, "Highest");
  resetIssues();
});

test("viewer authorization still runs first: 403 before any transition write", () => {
  resetIssues();
  const denied = authorizeDemoWrite("demo-viewer", "update");
  assert.equal(denied.ok, false);
  assert.equal(denied.ok ? 0 : denied.statusCode, 403);
  // The route contract: a 403 returns before touching the store, so even a
  // legal move mutates nothing. The store itself resolves no actors.
  assert.equal(getIssue("ADEO-1")?.status, "To Do");
  resetIssues();
});

test("fail path, unknown key and unknown status keep their semantics under the guard", () => {
  resetIssues();
  const failed = updateIssueStatus("ADEO-1", "In Progress", { fail: true });
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? 0 : failed.statusCode, 500);
  const unknownKey = updateIssueStatus("ADEO-9999", "In Progress");
  assert.equal(unknownKey.ok, false);
  assert.equal(unknownKey.ok ? 0 : unknownKey.statusCode, 404);
  const unknownStatus = updateIssueStatus("ADEO-1", "Archived");
  assert.equal(unknownStatus.ok, false);
  assert.equal(unknownStatus.ok ? 0 : unknownStatus.statusCode, 400);
  assert.equal(getIssue("ADEO-1")?.status, "To Do");
  resetIssues();
});

test("created issues follow the same matrix and reset clears transition state", () => {
  resetIssues();
  const created = createIssue({ title: "Demo transition check" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  assert.equal(updateIssue(key, { status: "In Progress" }).ok, true);
  const rejected = updateIssue(key, { status: "Done" });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.ok ? 0 : rejected.statusCode, 409);
  assert.deepEqual(rejected.ok ? [] : rejected.allowedFrom, ["In Review"]);
  assert.equal(getIssue(key)?.status, "In Progress");
  resetIssues();
  assert.equal(getIssue(key), undefined);
  assert.equal(getIssue("ADEO-1")?.status, "To Do");
});

test("legal moves agree across list and single read after reload", () => {
  resetIssues();
  assert.equal(updateIssueStatus("ADEO-1", "In Progress").ok, true);
  // A reload is a fresh read of the same demo-only store.
  assert.deepEqual(getIssue("ADEO-1"), getIssues().find((issue) => issue.key === "ADEO-1"));
  assert.equal(getIssue("ADEO-1")?.status, "In Progress");
  resetIssues();
});

test("client guidance names allowed targets and targets stay keyboard-usable", () => {
  assert.match(allowedMoveHint("To Do"), /from To Do you may move to In Progress/);
  assert.match(allowedMoveHint("Done"), /from Done you may move to To Do/);
  assert.match(allowedMoveHint("Archived"), /cannot move/);
  const statuses = ["To Do", "In Progress", "In Review", "Done"];
  assert.deepEqual(moveTargets(statuses, "In Progress"), ["In Review"]);
  assert.deepEqual(moveTargets(statuses, "In Review"), ["Done"]);
  // The narrowed target list is still a plain keyboard-operable select of
  // the legal next step; illegal columns surface the 409 rule error.
  assert.deepEqual(moveTargets(statuses, "To Do"), ["In Progress"]);
});
