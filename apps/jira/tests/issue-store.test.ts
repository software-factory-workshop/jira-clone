import test from "node:test";
import assert from "node:assert/strict";
import {
  getIssues,
  resetIssues,
  updateIssueStatus,
} from "../server/utils/issues.ts";

test("status move persists in the demo-only store and reloads", () => {
  resetIssues();
  const updated = updateIssueStatus("ADEO-1", "In Progress");
  assert.equal(updated.ok, true);
  assert.equal(
    getIssues().find((issue) => issue.key === "ADEO-1")?.status,
    "In Progress",
  );
  resetIssues();
  assert.equal(
    getIssues().find((issue) => issue.key === "ADEO-1")?.status,
    "To Do",
  );
});

test("deterministic failure never writes a false success", () => {
  resetIssues();
  const failed = updateIssueStatus("ADEO-1", "In Progress", { fail: true });
  assert.equal(failed.ok, false);
  assert.equal(
    getIssues().find((issue) => issue.key === "ADEO-1")?.status,
    "To Do",
  );
  resetIssues();
});

test("unknown status and unknown key are rejected", () => {
  resetIssues();
  assert.equal(updateIssueStatus("ADEO-1", "Archived").ok, false);
  assert.equal(updateIssueStatus("ADEO-9", "In Progress").ok, false);
  resetIssues();
});
