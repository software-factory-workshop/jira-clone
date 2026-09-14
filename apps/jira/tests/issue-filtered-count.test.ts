import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ALL_ASSIGNEES,
  ALL_STATUSES,
  filterIssues,
  type BoardIssue,
} from "../app/utils/boardMove.ts";
import { filteredIssueCountLabel } from "../app/utils/restIssues.ts";

const seed: BoardIssue[] = [
  { key: "ADEO-1", title: "Welcome to the ADEO Jira workspace", type: "Story", status: "To Do", priority: "Medium", assignee: "Unassigned", description: "demo" },
  { key: "ADEO-2", title: "Make the issue list easy to scan", type: "Task", status: "In Progress", priority: "High", assignee: "Demo member", description: "demo" },
  { key: "ADEO-3", title: "Clarify who can move an issue", type: "Task", status: "In Review", priority: "High", assignee: "Demo member", description: "demo" },
  { key: "ADEO-4", title: "Keep demo data separate from evidence", type: "Bug", status: "To Do", priority: "Medium", assignee: "Unassigned", description: "demo" },
];

test("filtered count uses existing client-side filtered data", () => {
  const filtered = filterIssues(seed, {
    search: "",
    status: ALL_STATUSES,
    assignee: "Demo member",
  });
  assert.equal(filteredIssueCountLabel(filtered.length, seed.length), "Showing 2 of 4 issues");
  const cleared = filterIssues(seed, {
    search: "",
    status: ALL_STATUSES,
    assignee: ALL_ASSIGNEES,
  });
  assert.equal(filteredIssueCountLabel(cleared.length, seed.length), "Showing 4 of 4 issues");
});

test("filtered count stays window-scoped on empty matches", () => {
  const narrowed = filterIssues(seed, {
    search: "no-such-issue",
    status: ALL_STATUSES,
    assignee: ALL_ASSIGNEES,
  });
  assert.equal(narrowed.length, 0);
  assert.equal(filteredIssueCountLabel(narrowed.length, seed.length), "Showing 0 of 4 issues");
});

test("filtered count clamps invalid input and singular nouns", () => {
  assert.equal(filteredIssueCountLabel(1, 1), "Showing 1 of 1 issue");
  assert.equal(filteredIssueCountLabel(-2, -4), "Showing 0 of 0 issues");
  assert.equal(filteredIssueCountLabel(Number.NaN, Number.NaN), "Showing 0 of 0 issues");
});

test("list and board views render an accessible count from the same client-side data", async () => {
  const root = new URL("../app/components/", import.meta.url);
  const list = await readFile(new URL("JiraIssueList.vue", root), "utf8");
  const board = await readFile(new URL("JiraIssueBoard.vue", root), "utf8");
  const filters = await readFile(new URL("JiraIssueFilters.vue", root), "utf8");
  const workspace = await readFile(new URL("JiraWorkspace.vue", root), "utf8");
  for (const [name, source] of [
    ["JiraIssueList", list],
    ["JiraIssueBoard", board],
  ] as const) {
    assert.match(source, /data-testid="issue-count"/, `${name} exposes a count hook`);
    assert.match(source, /role="status"/, `${name} announces the count accessibly`);
    assert.match(source, /countLabel/, `${name} renders the shared count label`);
  }
  assert.match(filters, /role="status"/, "filters keep an accessible summary");
  assert.match(workspace, /filteredIssueCountLabel/, "workspace uses the shared count helper");
  assert.match(workspace, /:count-label="filteredIssueCount"/, "workspace wires the count into both views");
});
