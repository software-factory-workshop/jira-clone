import test from "node:test";
import assert from "node:assert/strict";
import {
  REST_BOUNDARY,
  REST_ISSUE_TYPES,
  REST_PROJECT_KEY,
  checkNoJql,
  parseRestPagination,
  restComments,
  restIssue,
  restMyself,
  restProject,
  restProjectStatuses,
  restSearch,
  restTransitions,
  toRestIssue,
  toRestTransitionId,
} from "../server/utils/jiraRest.ts";
import {
  DEMO_ROLE_MATRIX_LABEL,
  authorizeDemoWrite,
} from "../server/utils/demoAccounts.ts";
import {
  addComment,
  createIssue,
  getIssue,
  getIssues,
  listComments,
  resetIssues,
  updateIssue,
} from "../server/utils/issues.ts";

function assertEnvelope(value: unknown) {
  assert.equal((value as { demoOnly: unknown }).demoOnly, true);
  assert.equal(
    (value as { roleMatrix: unknown }).roleMatrix,
    DEMO_ROLE_MATRIX_LABEL,
  );
  assert.equal((value as { boundary: unknown }).boundary, REST_BOUNDARY);
  assert.match(REST_BOUNDARY, /GET-only/);
  assert.match(REST_BOUNDARY, /no JQL/i);
}

test("myself maps the resolved demo account with the demo envelope", () => {
  const member = restMyself("demo-member");
  assert.equal(member.ok, true);
  if (member.ok) {
    assert.equal(member.data.accountId, "demo-member");
    assert.equal(member.data.displayName, "Demo Member");
    assert.equal(member.data.demoRole, "member");
    assert.equal(member.data.accountType, "atlassian:passport-demo");
    assert.equal(member.data.identitySource, "demoFallback");
    assert.equal(member.data.externalSub, null);
    assert.equal(member.data.active, true);
    assertEnvelope(member.data);
  }
  // The default fallback and the viewer read stay available on the read path.
  const fallback = restMyself(undefined);
  assert.equal(fallback.ok, true);
  const viewer = restMyself("demo-viewer");
  assert.equal(viewer.ok, true);
  if (viewer.ok) {
    assert.equal(viewer.data.demoRole, "viewer");
    assertEnvelope(viewer.data);
  }
  const unknown = restMyself("mallory");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok ? 0 : unknown.statusCode, 401);
  assert.match(unknown.ok ? "" : unknown.error, /Unknown demo identity/);
});

test("project KAN serves the observed reference fields; others stay 404", () => {
  resetIssues();
  const project = restProject(REST_PROJECT_KEY);
  assert.equal(project.ok, true);
  if (project.ok) {
    assert.equal(project.data.id, "10000");
    assert.equal(project.data.key, "KAN");
    assert.equal(project.data.name, "My Kanban Space");
    assert.equal(project.data.projectTypeKey, "software");
    assert.equal(project.data.simplified, true);
    assert.equal(project.data.style, "next-gen");
    assertEnvelope(project.data);
  }
  const before = getIssues();
  const unknown = restProject("NOPE");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok ? 0 : unknown.statusCode, 404);
  assert.match(unknown.ok ? "" : unknown.error, /Unknown demo project/);
  assert.deepEqual(getIssues(), before);
  resetIssues();
});

test("project statuses list every observed type/status with the demo envelope", () => {
  const statuses = restProjectStatuses("KAN");
  assert.equal(statuses.ok, true);
  if (statuses.ok) {
    assert.equal(statuses.data.projectKey, "KAN");
    assert.deepEqual(
      statuses.data.issueTypes.map((entry) => entry.name),
      [...REST_ISSUE_TYPES],
    );
    for (const entry of statuses.data.issueTypes) {
      assert.deepEqual(
        entry.statuses.map((status) => status.name),
        ["To Do", "In Progress", "In Review", "Done"],
      );
    }
    assertEnvelope(statuses.data);
  }
  const unknown = restProjectStatuses("NOPE");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok ? 0 : unknown.statusCode, 404);
});

test("issue read maps key/summary/status/priority/assignee plus demo envelope", () => {
  resetIssues();
  const result = restIssue("ADEO-1");
  assert.equal(result.ok, true);
  if (result.ok) {
    const stored = getIssue("ADEO-1");
    assert.ok(stored);
    assert.equal(result.data.id, "ADEO-1");
    assert.equal(result.data.key, "ADEO-1");
    assert.equal(result.data.self, "/api/rest/api/3/issue/ADEO-1");
    assert.equal(result.data.fields.summary, stored?.title);
    assert.equal(result.data.fields.issuetype.name, stored?.type);
    assert.equal(result.data.fields.status.name, stored?.status);
    assert.equal(result.data.fields.priority.name, stored?.priority);
    assert.equal(result.data.fields.assignee.displayName, stored?.assignee);
    assert.equal(result.data.fields.description, stored?.description);
    assert.equal(result.data.fields.project.key, "KAN");
    assertEnvelope(result.data);
    assert.deepEqual(toRestIssue(stored!).fields, result.data.fields);
  }
  resetIssues();
});

test("unknown issue keys return a labelled 404 without writing", () => {
  resetIssues();
  const beforeIssues = getIssues();
  const beforeComments = listComments("ADEO-1");
  for (const read of [
    restIssue("ADEO-9999"),
    restComments("ADEO-9999"),
    restTransitions("ADEO-9999"),
  ]) {
    assert.equal(read.ok, false);
    assert.equal(read.ok ? 0 : read.statusCode, 404);
    assert.match(read.ok ? "" : read.error, /Unknown issue key: ADEO-9999\./);
    assert.match(read.ok ? "" : read.error, /nothing was written/);
  }
  assert.deepEqual(getIssues(), beforeIssues);
  assert.deepEqual(listComments("ADEO-1"), beforeComments);
  resetIssues();
});

test("search-lite returns the bounded list-lite slice with total", () => {
  resetIssues();
  const full = restSearch({});
  assert.equal(full.ok, true);
  if (full.ok) {
    assert.equal(full.data.startAt, 0);
    assert.equal(full.data.maxResults, 25);
    assert.equal(full.data.total, getIssues().length);
    assert.equal(full.data.issues.length, getIssues().length);
    assert.deepEqual(
      full.data.issues.map((issue) => issue.key),
      getIssues().map((issue) => issue.key),
    );
    for (const issue of full.data.issues) {
      assertEnvelope(issue);
      assert.ok(issue.fields.summary);
    }
    assertEnvelope(full.data);
  }
  const page = restSearch({ startAt: "1", maxResults: "2" });
  assert.equal(page.ok, true);
  if (page.ok) {
    assert.equal(page.data.startAt, 1);
    assert.equal(page.data.maxResults, 2);
    assert.equal(page.data.total, getIssues().length);
    assert.deepEqual(
      page.data.issues.map((issue) => issue.key),
      getIssues().slice(1, 3).map((issue) => issue.key),
    );
  }
  const beyond = restSearch({ startAt: "999", maxResults: "10" });
  assert.equal(beyond.ok, true);
  if (beyond.ok) {
    assert.equal(beyond.data.total, getIssues().length);
    assert.deepEqual(beyond.data.issues, []);
  }
  resetIssues();
});

test("any jql/JQL parameter is a labelled demoOnly 400, never silent", () => {
  resetIssues();
  for (const query of [{ jql: "project=KAN" }, { JQL: "x" }, { Jql: "y" }]) {
    const search = restSearch(query);
    assert.equal(search.ok, false);
    assert.equal(search.ok ? 0 : search.statusCode, 400);
    assert.match(search.ok ? "" : search.error, /no JQL engine/);
    assert.match(search.ok ? "" : search.error, /Nothing was written/);
    const comments = restComments("ADEO-1", query);
    assert.equal(comments.ok, false);
    assert.equal(comments.ok ? 0 : comments.statusCode, 400);
    const transitions = restTransitions("ADEO-1", query);
    assert.equal(transitions.ok, false);
    assert.equal(transitions.ok ? 0 : transitions.statusCode, 400);
  }
  assert.equal(checkNoJql({ startAt: "0" }), null);
  assert.notEqual(checkNoJql({ jql: "" }), null);
  assert.notEqual(checkNoJql({ JQL: "" }), null);
  resetIssues();
});

test("startAt/maxResults are bounded with labelled 400s", () => {
  assert.deepEqual(parseRestPagination({}), {
    ok: true,
    data: { startAt: 0, maxResults: 25 },
  });
  for (const query of [
    { startAt: "-1" },
    { startAt: "1.5" },
    { startAt: "abc" },
    { maxResults: "0" },
    { maxResults: "51" },
    { maxResults: "abc" },
    { startAt: "0", maxResults: "500" },
  ]) {
    const parsed = parseRestPagination(query);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.ok ? 0 : parsed.statusCode, 400);
    const searched = restSearch(query);
    assert.equal(searched.ok, false);
    assert.equal(searched.ok ? 0 : searched.statusCode, 400);
    assert.match(searched.ok ? "" : searched.error, /Nothing was written/);
  }
  const capped = parseRestPagination({ maxResults: "50" });
  assert.equal(capped.ok, true);
  if (capped.ok) assert.equal(capped.data.maxResults, 50);
  const comments = restComments("ADEO-1", { maxResults: "51" });
  assert.equal(comments.ok, false);
  assert.equal(comments.ok ? 0 : comments.statusCode, 400);
});

test("comment list maps demo comments with bounded pagination", () => {
  resetIssues();
  assert.equal(addComment("ADEO-1", { body: "First" }).ok, true);
  assert.equal(addComment("ADEO-1", { body: "Second" }).ok, true);
  const full = restComments("ADEO-1", {});
  assert.equal(full.ok, true);
  if (full.ok) {
    assert.equal(full.data.total, 2);
    assert.equal(full.data.startAt, 0);
    assert.equal(full.data.maxResults, 25);
    assert.deepEqual(
      full.data.comments.map((comment) => comment.body),
      ["First", "Second"],
    );
    assert.equal(full.data.comments[0]?.author.displayName.length! > 0, true);
    assert.equal(full.data.comments[0]?.demoOnly, true);
    assertEnvelope(full.data);
  }
  const page = restComments("ADEO-1", { startAt: "1", maxResults: "1" });
  assert.equal(page.ok, true);
  if (page.ok) {
    assert.equal(page.data.total, 2);
    assert.deepEqual(
      page.data.comments.map((comment) => comment.body),
      ["Second"],
    );
  }
  const other = restComments("ADEO-2", {});
  assert.equal(other.ok, true);
  if (other.ok) assert.equal(other.data.total, 0);
  resetIssues();
});

test("transitions agree with DEMO_TRANSITIONS for every status", () => {
  resetIssues();
  const matrix: Record<string, string[]> = {
    "To Do": ["In Progress"],
    "In Progress": ["In Review"],
    "In Review": ["Done"],
    Done: ["To Do"],
  };
  for (const [from, targets] of Object.entries(matrix)) {
    // Route ADEO-1 (To Do), ADEO-2 (In Progress), ADEO-3 (In Review) directly;
    // move ADEO-4 (To Do) to Done through the legal chain for the Done case.
    const key = from === "To Do" ? "ADEO-1" : from === "In Progress" ? "ADEO-2" : from === "In Review" ? "ADEO-3" : "ADEO-4";
    if (from === "Done") {
      assert.equal(updateIssue(key, { status: "In Progress" }).ok, true);
      assert.equal(updateIssue(key, { status: "In Review" }).ok, true);
      assert.equal(updateIssue(key, { status: "Done" }).ok, true);
    }
    assert.equal(getIssue(key)?.status, from);
    const result = restTransitions(key, {});
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.issueKey, key);
      assert.equal(result.data.from, from);
      assert.deepEqual(
        result.data.transitions.map((transition) => transition.name),
        targets,
      );
      assert.deepEqual(
        result.data.transitions.map((transition) => transition.to.name),
        targets,
      );
      for (const transition of result.data.transitions) {
        assert.equal(transition.id, toRestTransitionId(transition.name));
      }
      assertEnvelope(result.data);
    }
    resetIssues();
  }
});

test("reads expose created/edited issues without writes and keep native semantics", () => {
  resetIssues();
  const created = createIssue({ title: "Adapter visibility check" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  assert.equal(updateIssue(key, { status: "In Progress" }).ok, true);
  assert.equal(addComment(key, { body: "Visible via adapter" }).ok, true);
  const issue = restIssue(key);
  assert.equal(issue.ok, true);
  if (issue.ok) {
    assert.equal(issue.data.fields.summary, "Adapter visibility check");
    assert.equal(issue.data.fields.status.name, "In Progress");
  }
  const search = restSearch({});
  assert.equal(search.ok, true);
  if (search.ok) {
    assert.ok(search.data.issues.some((entry) => entry.key === key));
    assert.equal(search.data.total, getIssues().length);
  }
  const comments = restComments(key, {});
  assert.equal(comments.ok, true);
  if (comments.ok) assert.equal(comments.data.total, 1);
  const transitions = restTransitions(key, {});
  assert.equal(transitions.ok, true);
  if (transitions.ok) {
    assert.deepEqual(
      transitions.data.transitions.map((transition) => transition.name),
      ["In Review"],
    );
  }
  // Native write routes and transition semantics are unchanged: the viewer is
  // still denied before any mutation, and an illegal skip is still a 409.
  const denied = authorizeDemoWrite("demo-viewer", "update");
  assert.equal(denied.ok, false);
  assert.equal(denied.ok ? 0 : denied.statusCode, 403);
  const illegal = updateIssue(key, { status: "Done" });
  assert.equal(illegal.ok, false);
  assert.equal(illegal.ok ? 0 : illegal.statusCode, 409);
  resetIssues();
});

test("adapter reads never mutate: no-write behavior across every shape", () => {
  resetIssues();
  const beforeIssues = getIssues();
  const beforeComments = listComments("ADEO-1");
  assert.equal(restMyself("demo-viewer").ok, true);
  assert.equal(restProject("KAN").ok, true);
  assert.equal(restProjectStatuses("KAN").ok, true);
  assert.equal(restIssue("ADEO-1").ok, true);
  assert.equal(restSearch({ startAt: "0", maxResults: "2" }).ok, true);
  assert.equal(restComments("ADEO-1", {}).ok, true);
  assert.equal(restTransitions("ADEO-1", {}).ok, true);
  // Even failing adapter reads (404/400) change nothing.
  assert.equal(restIssue("ADEO-9999").ok, false);
  assert.equal(restSearch({ jql: "x" }).ok, false);
  assert.equal(restSearch({ maxResults: "99" }).ok, false);
  assert.deepEqual(getIssues(), beforeIssues);
  assert.deepEqual(listComments("ADEO-1"), beforeComments);
  assert.equal(getIssue("ADEO-9999"), undefined);
  resetIssues();
});
