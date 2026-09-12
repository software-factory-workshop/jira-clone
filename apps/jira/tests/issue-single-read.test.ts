import test from "node:test";
import assert from "node:assert/strict";
import {
  getIssue,
  getIssues,
  resetIssues,
  updateIssue,
} from "../server/utils/issues.ts";

test("single-issue read matches the list shape with demo-only label data", () => {
  resetIssues();
  const single = getIssue("ADEO-1");
  const listed = getIssues().find((issue) => issue.key === "ADEO-1");
  assert.deepEqual(single, listed);
  assert.ok(single);
  resetIssues();
});

test("unknown key reads undefined without writing", () => {
  resetIssues();
  const before = getIssues();
  assert.equal(getIssue("ADEO-9"), undefined);
  assert.deepEqual(getIssues(), before);
  resetIssues();
});

test("single read reflects status/priority overrides after PATCH", () => {
  resetIssues();
  const updated = updateIssue("ADEO-2", { status: "Done", priority: "Lowest" });
  assert.equal(updated.ok, true);
  assert.deepEqual(getIssue("ADEO-2"), updated.ok ? updated.issue : undefined);
  assert.equal(getIssue("ADEO-2")?.status, "Done");
  assert.equal(getIssue("ADEO-2")?.priority, "Lowest");
  resetIssues();
});

test("reset clears single-read overrides back to fixtures", () => {
  resetIssues();
  updateIssue("ADEO-2", { status: "Done", priority: "Lowest" });
  resetIssues();
  assert.equal(getIssue("ADEO-2")?.status, "In Progress");
  assert.equal(getIssue("ADEO-2")?.priority, "High");
});
