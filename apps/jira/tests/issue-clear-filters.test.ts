import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_ASSIGNEES,
  ALL_STATUSES,
  clearedIssueFilters,
  filterIssues,
  isFiltersActive,
  type BoardIssue,
} from "../app/utils/boardMove.ts";

const seed: BoardIssue[] = [
  { key: "ADEO-1", title: "Welcome to the ADEO Jira workspace", type: "Story", status: "To Do", priority: "Medium", assignee: "Unassigned", description: "demo" },
  { key: "ADEO-2", title: "Make the issue list easy to scan", type: "Task", status: "In Progress", priority: "High", assignee: "Demo member", description: "demo" },
  { key: "ADEO-3", title: "Clarify who can move an issue", type: "Task", status: "In Review", priority: "High", assignee: "Demo member", description: "demo" },
  { key: "ADEO-4", title: "Keep demo data separate from evidence", type: "Bug", status: "To Do", priority: "Medium", assignee: "Unassigned", description: "demo" },
];

test("default filters are inactive", () => {
  assert.equal(
    isFiltersActive({ search: "", status: ALL_STATUSES, assignee: ALL_ASSIGNEES }),
    false,
  );
});

test("each active filter kind reports active", () => {
  assert.equal(
    isFiltersActive({ search: "move", status: ALL_STATUSES, assignee: ALL_ASSIGNEES }),
    true,
  );
  assert.equal(
    isFiltersActive({ search: "", status: "Done", assignee: ALL_ASSIGNEES }),
    true,
  );
  assert.equal(
    isFiltersActive({ search: "", status: ALL_STATUSES, assignee: "Demo member" }),
    true,
  );
});

test("whitespace-only search counts as inactive", () => {
  assert.equal(
    isFiltersActive({ search: "   ", status: ALL_STATUSES, assignee: ALL_ASSIGNEES }),
    false,
  );
});

test("cleared filters restore the full window", () => {
  assert.deepEqual(clearedIssueFilters(), {
    search: "",
    status: ALL_STATUSES,
    assignee: ALL_ASSIGNEES,
  });
  const keys = filterIssues(seed, clearedIssueFilters()).map((issue) => issue.key);
  assert.deepEqual(keys, ["ADEO-1", "ADEO-2", "ADEO-3", "ADEO-4"]);
});

test("clearing a narrowed search x status x assignee restores every issue", () => {
  const narrowed = filterIssues(seed, {
    search: "move",
    status: "In Review",
    assignee: "Demo member",
  });
  assert.deepEqual(
    narrowed.map((issue) => issue.key),
    ["ADEO-3"],
  );
  const cleared = filterIssues(seed, clearedIssueFilters());
  assert.equal(cleared.length, seed.length);
  assert.equal(isFiltersActive(clearedIssueFilters()), false);
});
