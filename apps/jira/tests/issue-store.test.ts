import test from "node:test";
import assert from "node:assert/strict";
import {
  armSaveFailure,
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
