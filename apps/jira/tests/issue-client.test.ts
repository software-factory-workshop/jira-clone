import test from "node:test";
import assert from "node:assert/strict";
import {
  applySavedIssue,
  filterIssues,
  type TeachingIssueView,
} from "../app/utils/issue-client.ts";

const rows: TeachingIssueView[] = [
  { key: "ADEO-1", title: "Welcome", type: "Story", status: "To Do", priority: "Medium", assignee: "Unassigned", description: "Seed" },
  { key: "ADEO-2", title: "Scan the list", type: "Task", status: "In Progress", priority: "High", assignee: "Demo member", description: "Seed" },
];

test("assignee filter narrows the list without changing other filters", () => {
  assert.deepEqual(
    filterIssues(rows, "", "All statuses", "Demo member").map((row) => row.key),
    ["ADEO-2"],
  );
  assert.equal(filterIssues(rows, "", "All statuses", "All assignees").length, 2);
  assert.equal(filterIssues(rows, "welcome", "All statuses", "Demo member").length, 0);
});

test("successful save updates only that issue's displayed priority", () => {
  const { issues, error } = applySavedIssue(rows, {
    key: "ADEO-1",
    priority: "Highest",
    appliedPriority: "Highest",
  });
  assert.equal(error, null);
  assert.equal(issues.find((row) => row.key === "ADEO-1")?.priority, "Highest");
  assert.equal(issues.find((row) => row.key === "ADEO-2")?.priority, "High");
});

test("failed save keeps displayed state and surfaces the error", () => {
  const { issues, error } = applySavedIssue(rows, {
    key: "ADEO-1",
    priority: "Highest",
    saveError: "Demo save failed on purpose",
  });
  assert.equal(error, "Demo save failed on purpose");
  assert.equal(issues.find((row) => row.key === "ADEO-1")?.priority, "Medium");
});
