import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_ASSIGNEES,
  UNASSIGNED,
  assigneeOptions,
  filterIssues,
  type BoardIssue,
} from "../app/utils/boardMove.ts";

const seed: BoardIssue[] = [
  { key: "ADEO-1", title: "Welcome to the ADEO Jira workspace", type: "Story", status: "To Do", priority: "Medium", assignee: "Unassigned", description: "demo" },
  { key: "ADEO-2", title: "Make the issue list easy to scan", type: "Task", status: "In Progress", priority: "High", assignee: "Demo member", description: "demo" },
  { key: "ADEO-3", title: "Clarify who can move an issue", type: "Task", status: "In Review", priority: "High", assignee: "Demo member", description: "demo" },
  { key: "ADEO-4", title: "Keep demo data separate from evidence", type: "Bug", status: "To Do", priority: "Medium", assignee: "Unassigned", description: "demo" },
];

test("assignee options list All, Unassigned, then fixture identities", () => {
  assert.deepEqual(assigneeOptions(seed), [
    ALL_ASSIGNEES,
    UNASSIGNED,
    "Demo member",
  ]);
});

test("Demo member filter shows ADEO-2 and ADEO-3", () => {
  const keys = filterIssues(seed, {
    search: "",
    status: "All statuses",
    assignee: "Demo member",
  }).map((issue) => issue.key);
  assert.deepEqual(keys, ["ADEO-2", "ADEO-3"]);
});

test("Unassigned filter shows ADEO-1 and ADEO-4", () => {
  const keys = filterIssues(seed, {
    search: "",
    status: "All statuses",
    assignee: "Unassigned",
  }).map((issue) => issue.key);
  assert.deepEqual(keys, ["ADEO-1", "ADEO-4"]);
});

test("assignee combines with search and status", () => {
  const keys = filterIssues(seed, {
    search: "move",
    status: "In Review",
    assignee: "Demo member",
  }).map((issue) => issue.key);
  assert.deepEqual(keys, ["ADEO-3"]);
});

test("assignee mismatch with status yields an empty result", () => {
  const result = filterIssues(seed, {
    search: "",
    status: "Done",
    assignee: "Demo member",
  });
  assert.deepEqual(result, []);
});

test("empty search with All assignees keeps every issue", () => {
  const keys = filterIssues(seed, {
    search: "",
    status: "All statuses",
    assignee: "All assignees",
  }).map((issue) => issue.key);
  assert.deepEqual(keys, ["ADEO-1", "ADEO-2", "ADEO-3", "ADEO-4"]);
});
