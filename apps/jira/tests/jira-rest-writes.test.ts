import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_ROLE_MATRIX_LABEL,
  authorizeDemoWrite,
} from "../server/utils/demoAccounts.ts";
import {
  authorizeAppWrite,
  resolveAppActor,
} from "../server/utils/appAccounts.ts";
import {
  REST_BOUNDARY,
  authorizeRestWrite,
  mcpWriteIdentity,
  restAddComment,
  restCreateIssue,
  restTransitionIssue,
  restUpdateIssue,
  restIssue,
  restTransitions,
  resolveRestTransitionTarget,
  toRestIssue,
  toRestTransitionId,
} from "../server/utils/jiraRest.ts";
import {
  addComment,
  createIssue,
  getIssue,
  getIssues,
  isObservedStatus,
  listComments,
  resetIssues,
  updateIssue,
} from "../server/utils/issues.ts";

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fakeJwt(payload: unknown): string {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return `${base64Url(JSON.stringify({ alg: "ES256", typ: "JWT" }))}.${base64Url(body)}.${base64Url("fake-signature")}`;
}

function passport(role: string, sub = `write-${role}`) {
  return {
    passportToken: fakeJwt({ external_sub: sub, role }),
    nodeEnv: "production" as const,
  };
}

function memberFallback() {
  return { demoUser: "demo-member", nodeEnv: "test" as const };
}

function viewerFallback() {
  return { demoUser: "demo-viewer", nodeEnv: "test" as const };
}

function assertWriteEnvelope(value: unknown) {
  assert.equal((value as { demoOnly: unknown }).demoOnly, undefined);
  // Helpers return data only; the HTTP routes attach the envelope. Here we
  // pin the boundary label the routes attach.
  assert.match(REST_BOUNDARY, /bounded writes/);
  assert.match(REST_BOUNDARY, /POST \/api\/rest\/api\/3\/issue/);
  assert.match(REST_BOUNDARY, /PUT \/api\/rest\/api\/3\/issue\/:key/);
  assert.match(REST_BOUNDARY, /issue\/:key\/comment/);
  assert.match(REST_BOUNDARY, /issue\/:key\/transitions/);
  assert.match(REST_BOUNDARY, /not full Jira parity/);
  assert.match(REST_BOUNDARY, /configured Jira demo persistence layer/);
  assert.match(DEMO_ROLE_MATRIX_LABEL, /Demo-only role matrix/);
}

test("rest create maps Jira fields to the demo model with actor metadata", async () => {
  resetIssues();
  assertWriteEnvelope({});
  const result = await restCreateIssue(memberFallback(), {
    fields: {
      summary: "  REST-created follow-up  ",
      priority: { name: "Highest" },
      assignee: { displayName: "Demo member" },
      description: "demo text",
      issuetype: { name: "Story" },
      project: { key: "KAN" },
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.issue.key, "ADEO-5");
    assert.equal(result.data.issue.fields.summary, "REST-created follow-up");
    assert.equal(result.data.issue.fields.priority.name, "Highest");
    assert.equal(result.data.issue.fields.assignee.displayName, "Demo member");
    assert.equal(result.data.issue.fields.description, "demo text");
    assert.equal(result.data.issue.fields.issuetype.name, "Story");
    assert.deepEqual(result.data.actor, {
      id: "demo-member",
      label: "Demo Member",
      role: "member",
      identitySource: "demoFallback",
    });
    assert.equal(result.data.identitySource, "demoFallback");
    const stored = getIssue("ADEO-5");
    assert.ok(stored);
    assert.equal(stored?.title, "REST-created follow-up");
    // The read-back agrees with the created bean.
    assert.deepEqual(await restIssue("ADEO-5"), {
      ok: true,
      data: toRestIssue(stored!),
    });
  }
  resetIssues();
});

test("rest create accepts assignee/description string shapes and status objects", async () => {
  resetIssues();
  const created = await restCreateIssue(memberFallback(), {
    fields: {
      summary: "Shapes",
      assignee: "Demo member",
      description: "plain",
      status: { name: "To Do" },
    },
  });
  assert.equal(created.ok, true);
  if (created.ok) {
    assert.equal(created.data.issue.fields.status.name, "To Do");
  }
  const doc = await restCreateIssue(memberFallback(), {
    fields: {
      summary: "Doc description",
      description: { content: [{ text: "hello " }, { text: "world" }] },
    },
  });
  assert.equal(doc.ok, true);
  if (doc.ok) {
    assert.equal(doc.data.issue.fields.description, "hello world");
  }
  resetIssues();
});

test("rest create rejects unsupported fields, bad values and unknown projects", async () => {
  resetIssues();
  const before = getIssues();
  for (const body of [
    {},
    { fields: undefined },
    { fields: null },
    { fields: [] },
    { fields: {} },
    { fields: { summary: "   " } },
    { fields: { summary: "x", labels: ["a"] } },
    { fields: { summary: "x", status: "Archived" } },
    { fields: { summary: "x", status: { name: "Archived" } } },
    { fields: { summary: "x", priority: "Urgent" } },
    { fields: { summary: "x", priority: { name: "Urgent" } } },
    { fields: { summary: "x", assignee: 42 } },
    { fields: { summary: "x", description: 42 } },
    { fields: { summary: "x", issuetype: { name: "  " } } },
    { fields: { summary: "x", project: { key: "NOPE" } } },
  ]) {
    const rejected = await restCreateIssue(
      memberFallback(),
      body as { fields?: unknown },
    );
    assert.equal(rejected.ok, false, JSON.stringify(body));
    assert.ok(
      (rejected.ok ? 0 : rejected.statusCode) >= 400 &&
        (rejected.ok ? 0 : rejected.statusCode) < 500,
      JSON.stringify(body),
    );
    assert.match(rejected.ok ? "" : rejected.error, /Nothing was written/);
  }
  const unknownField = await restCreateIssue(memberFallback(), {
    fields: { summary: "x", storyPoints: 3 },
  });
  assert.equal(unknownField.ok, false);
  assert.equal(unknownField.ok ? 0 : unknownField.statusCode, 400);
  assert.match(unknownField.ok ? "" : unknownField.error, /Unsupported demoOnly field/);
  assert.match(unknownField.ok ? "" : unknownField.error, /storyPoints/);
  const unknownProject = await restCreateIssue(memberFallback(), {
    fields: { summary: "x", project: { key: "NOPE" } },
  });
  assert.equal(unknownProject.ok, false);
  assert.equal(unknownProject.ok ? 0 : unknownProject.statusCode, 404);
  assert.match(unknownProject.ok ? "" : unknownProject.error, /Unknown demo project/);
  assert.deepEqual(getIssues(), before);
  assert.equal(getIssue("ADEO-5"), undefined);
  resetIssues();
});

test("rest create preserves the deterministic fail path without writing", async () => {
  resetIssues();
  const before = getIssues();
  const failed = await restCreateIssue(memberFallback(), {
    fields: { summary: "Never saved" },
    fail: true,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? 0 : failed.statusCode, 500);
  assert.match(failed.ok ? "" : failed.error, /No changes were saved/);
  assert.deepEqual(getIssues(), before);
  assert.equal(getIssue("ADEO-5"), undefined);
  resetIssues();
});

test("rest update maps summary/priority/assignee/description with actor metadata", async () => {
  resetIssues();
  const result = await restUpdateIssue(memberFallback(), "ADEO-1", {
    fields: {
      summary: "Renamed via REST",
      priority: "Lowest",
      assignee: { displayName: "Demo member" },
      description: "updated text",
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.issue.key, "ADEO-1");
    assert.equal(result.data.issue.fields.summary, "Renamed via REST");
    assert.equal(result.data.issue.fields.priority.name, "Lowest");
    assert.equal(result.data.issue.fields.assignee.displayName, "Demo member");
    assert.equal(result.data.issue.fields.description, "updated text");
    assert.deepEqual(result.data.actor, {
      id: "demo-member",
      label: "Demo Member",
      role: "member",
      identitySource: "demoFallback",
    });
    assert.equal(result.data.identitySource, "demoFallback");
  }
  assert.equal(getIssue("ADEO-1")?.title, "Renamed via REST");
  assert.equal(getIssue("ADEO-1")?.priority, "Lowest");
  assert.equal(getIssue("ADEO-1")?.assignee, "Demo member");
  assert.equal(getIssue("ADEO-1")?.description, "updated text");
  // A same-server reload reads the same demo-only store.
  assert.equal(getIssue("ADEO-1")?.title, "Renamed via REST");
  resetIssues();
  assert.equal(getIssue("ADEO-1")?.title, "Welcome to the ADEO Jira workspace");
});

test("rest update rejects status fields, unknown fields, keys and values", async () => {
  resetIssues();
  const before = getIssue("ADEO-1");
  const statusHint = await restUpdateIssue(memberFallback(), "ADEO-1", {
    fields: { status: { name: "In Progress" } },
  });
  assert.equal(statusHint.ok, false);
  assert.equal(statusHint.ok ? 0 : statusHint.statusCode, 400);
  assert.match(statusHint.ok ? "" : statusHint.error, /transitions/);
  assert.match(statusHint.ok ? "" : statusHint.error, /Nothing was written/);
  for (const body of [
    { fields: {} },
    { fields: { summary: "   " } },
    { fields: { labels: ["x"] } },
    { fields: { priority: "Urgent" } },
    { fields: { priority: { name: "Urgent" } } },
    { fields: { assignee: "" } },
    { fields: { description: 42 } },
  ]) {
    const rejected = await restUpdateIssue(memberFallback(), "ADEO-1", body);
    assert.equal(rejected.ok, false, JSON.stringify(body));
    assert.match(rejected.ok ? "" : rejected.error, /Nothing was written/);
  }
  const unknown = await restUpdateIssue(memberFallback(), "ADEO-9999", {
    fields: { summary: "Never" },
  });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok ? 0 : unknown.statusCode, 404);
  assert.match(unknown.ok ? "" : unknown.error, /Unknown issue key/);
  const unsupported = await restUpdateIssue(memberFallback(), "ADEO-1", {
    fields: { summary: "x", duedate: "2026-01-01" },
  });
  assert.equal(unsupported.ok, false);
  assert.match(unsupported.ok ? "" : unsupported.error, /Unsupported demoOnly field/);
  const failed = await restUpdateIssue(memberFallback(), "ADEO-1", {
    fields: { summary: "Never saved" },
    fail: true,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? 0 : failed.statusCode, 500);
  assert.deepEqual(getIssue("ADEO-1"), before);
  resetIssues();
});

test("rest update agrees with the native store and transition guard", async () => {
  resetIssues();
  // Native edits stay visible through the REST read-back.
  assert.equal(updateIssue("ADEO-1", { priority: "High" }).ok, true);
  const read = await restIssue("ADEO-1");
  assert.equal(read.ok, true);
  if (read.ok) assert.equal(read.data.fields.priority.name, "High");
  // The shared matrix still guards status-only native moves (409).
  const illegal = updateIssue("ADEO-1", { status: "Done" });
  assert.equal(illegal.ok, false);
  assert.equal(illegal.ok ? 0 : illegal.statusCode, 409);
  // REST field edits then persist on the same boundary.
  const edited = await restUpdateIssue(memberFallback(), "ADEO-1", {
    fields: { summary: "Shared boundary" },
  });
  assert.equal(edited.ok, true);
  assert.equal(getIssue("ADEO-1")?.title, "Shared boundary");
  resetIssues();
});

test("rest comment creates Jira-shaped comments with actor metadata", async () => {
  resetIssues();
  const result = await restAddComment(memberFallback(), "ADEO-1", {
    body: "  REST comment  ",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.comment.body, "REST comment");
    assert.ok(result.data.comment.id.startsWith("ADEO-1-comment-"));
    assert.ok(result.data.comment.author.displayName.length > 0);
    assert.ok(result.data.comment.created.length > 0);
    assert.equal(result.data.comment.demoOnly, true);
    assert.deepEqual(result.data.actor, {
      id: "demo-member",
      label: "Demo Member",
      role: "member",
      identitySource: "demoFallback",
    });
    assert.equal(result.data.identitySource, "demoFallback");
  }
  assert.deepEqual(
    (listComments("ADEO-1") ?? []).map((comment) => comment.body),
    ["REST comment"],
  );
  // A doc-shaped body is best-effort text, matching creation.
  const doc = await restAddComment(memberFallback(), "ADEO-1", {
    body: { content: [{ text: "doc " }, { text: "body" }] },
  } as unknown as { body?: unknown });
  assert.equal(doc.ok, true);
  resetIssues();
});

test("rest comment rejects unknown keys, blank bodies and fail paths", async () => {
  resetIssues();
  const before = listComments("ADEO-1");
  const unknown = await restAddComment(memberFallback(), "ADEO-9999", { body: "x" });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok ? 0 : unknown.statusCode, 404);
  assert.match(unknown.ok ? "" : unknown.error, /Unknown issue key/);
  for (const body of ["", "   ", undefined, 42]) {
    const rejected = await restAddComment(memberFallback(), "ADEO-1", { body } as {
      body?: unknown;
    });
    assert.equal(rejected.ok, false, JSON.stringify(body));
    assert.equal(rejected.ok ? 0 : rejected.statusCode, 400);
    assert.match(rejected.ok ? "" : rejected.error, /Nothing was written/);
  }
  const failed = await restAddComment(memberFallback(), "ADEO-1", {
    body: "Never saved",
    fail: true,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? 0 : failed.statusCode, 500);
  assert.deepEqual(listComments("ADEO-1"), before);
  // The native comment helper agrees on isolation: ADEO-2 stays empty.
  assert.equal(addComment("ADEO-2", { body: "Other" }).ok, true);
  assert.equal((listComments("ADEO-2") ?? []).length, 1);
  assert.equal((listComments("ADEO-1") ?? []).length, 0);
  resetIssues();
});

test("rest transitions perform allowed moves and reject the rest", async () => {
  resetIssues();
  const listed = await restTransitions("ADEO-1", {});
  assert.equal(listed.ok, true);
  const allowedId = listed.ok ? listed.data.transitions[0]?.id : "";
  assert.equal(allowedId, toRestTransitionId("In Progress"));
  const moved = await restTransitionIssue(memberFallback(), "ADEO-1", {
    transition: { id: allowedId },
  });
  assert.equal(moved.ok, true);
  if (moved.ok) {
    assert.equal(moved.data.issue.fields.status.name, "In Progress");
    assert.deepEqual(moved.data.transition, {
      id: "demo-in-progress",
      name: "In Progress",
      to: { name: "In Progress" },
    });
    assert.deepEqual(moved.data.actor, {
      id: "demo-member",
      label: "Demo Member",
      role: "member",
      identitySource: "demoFallback",
    });
    assert.equal(moved.data.identitySource, "demoFallback");
  }
  assert.equal(getIssue("ADEO-1")?.status, "In Progress");
  // Bare id and name shapes resolve through the same pure helper.
  const bare = await resolveRestTransitionTarget("ADEO-2", "demo-in-review");
  assert.deepEqual(bare, { ok: true, data: "In Review" });
  const named = await resolveRestTransitionTarget("ADEO-2", { name: "In Review" });
  assert.deepEqual(named, { ok: true, data: "In Review" });
  const nested = await resolveRestTransitionTarget("ADEO-2", {
    to: { name: "In Review" },
  });
  assert.deepEqual(nested, { ok: true, data: "In Review" });
  // Off-matrix names fail closed with a 409 naming the allowed ids.
  const skip = await restTransitionIssue(memberFallback(), "ADEO-2", {
    transition: "Done",
  });
  assert.equal(skip.ok, false);
  assert.equal(skip.ok ? 0 : skip.statusCode, 409);
  assert.match(skip.ok ? "" : skip.error, /not in the demo matrix/);
  assert.match(skip.ok ? "" : skip.error, /demo-in-review/);
  assert.deepEqual(skip.ok ? [] : (skip.allowedFrom ?? []), ["In Review"]);
  const skipName = await resolveRestTransitionTarget("ADEO-2", "Done");
  assert.equal(skipName.ok, false);
  assert.equal(skipName.ok ? 0 : skipName.statusCode, 409);
  const bogus = await restTransitionIssue(memberFallback(), "ADEO-2", {
    transition: { id: "demo-archived" },
  });
  assert.equal(bogus.ok, false);
  assert.equal(bogus.ok ? 0 : bogus.statusCode, 400);
  assert.match(bogus.ok ? "" : bogus.error, /Unknown demo transition id/);
  const missing = await restTransitionIssue(memberFallback(), "ADEO-2", {});
  assert.equal(missing.ok, false);
  assert.equal(missing.ok ? 0 : missing.statusCode, 400);
  assert.match(missing.ok ? "" : missing.error, /expected `transition`/);
  const unknown = await restTransitionIssue(memberFallback(), "ADEO-9999", {
    transition: { id: "demo-in-progress" },
  });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok ? 0 : unknown.statusCode, 404);
  const failed = await restTransitionIssue(memberFallback(), "ADEO-2", {
    transition: { id: "demo-in-review" },
    fail: true,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? 0 : failed.statusCode, 500);
  assert.equal(getIssue("ADEO-2")?.status, "In Progress");
  assert.equal(getIssue("ADEO-1")?.status, "In Progress");
  resetIssues();
});

test("rest writes keep admin/member semantics and denials change nothing", async () => {
  resetIssues();
  const beforeIssues = getIssues();
  const beforeComments = listComments("ADEO-1");
  // The shared gate agrees with the native demo authority per action.
  for (const action of ["create", "update", "comment"] as const) {
    assert.equal(
      authorizeRestWrite(viewerFallback(), action).ok,
      false,
      `viewer ${action}`,
    );
    assert.equal(
      authorizeRestWrite(viewerFallback(), action).ok ? 0 : authorizeRestWrite(viewerFallback(), action).statusCode,
      403,
    );
    assert.equal(authorizeDemoWrite("demo-viewer", action).ok, false);
  }
  const deniedResults = await Promise.all([
    restCreateIssue(viewerFallback(), { fields: { summary: "Denied" } }),
    restUpdateIssue(viewerFallback(), "ADEO-1", { fields: { summary: "Denied" } }),
    restAddComment(viewerFallback(), "ADEO-1", { body: "Denied" }),
    restTransitionIssue(viewerFallback(), "ADEO-1", {
      transition: { id: "demo-in-progress" },
    }),
  ]);
  for (const denied of deniedResults) {
    assert.equal(denied.ok, false);
    assert.equal(denied.ok ? 0 : denied.statusCode, 403);
    assert.match(denied.ok ? "" : denied.error, /Demo-only permission denied/);
    assert.match(denied.ok ? "" : denied.error, /Nothing was written/);
  }
  // Passport viewers are denied identically; admins/members succeed.
  const passportViewer = await restCreateIssue(passport("viewer"), {
    fields: { summary: "Denied" },
  });
  assert.equal(passportViewer.ok, false);
  assert.equal(passportViewer.ok ? 0 : passportViewer.statusCode, 403);
  const passportMember = await restCreateIssue(passport("member", "write-m-1"), {
    fields: { summary: "Member write" },
  });
  assert.equal(passportMember.ok, true);
  if (passportMember.ok) {
    assert.equal(passportMember.data.identitySource, "passport");
    assert.equal(passportMember.data.actor.id, "passport:write-m-1");
    assert.equal(passportMember.data.actor.identitySource, "passport");
  }
  const passportAdmin = await restUpdateIssue(passport("admin", "write-a-1"), "ADEO-1", {
    fields: { summary: "Admin write" },
  });
  assert.equal(passportAdmin.ok, true);
  if (passportAdmin.ok) {
    assert.equal(passportAdmin.data.identitySource, "passport");
  }
  // Unknown/malformed identities fail closed per action without writing.
  resetIssues();
  const clean = getIssues();
  for (const identity of [
    { demoUser: "mallory", nodeEnv: "test" as const },
    { demoUser: "", nodeEnv: "test" as const },
    { demoUser: 42, nodeEnv: "test" as const },
    { passportToken: "bogus", nodeEnv: "production" as const },
    {
      passportToken: fakeJwt({ external_sub: "bad-role", role: "superuser" }),
      nodeEnv: "production" as const,
    },
  ]) {
    const attempts = await Promise.all([
      restCreateIssue(identity, { fields: { summary: "Denied" } }),
      restUpdateIssue(identity, "ADEO-1", { fields: { summary: "Denied" } }),
      restAddComment(identity, "ADEO-1", { body: "Denied" }),
      restTransitionIssue(identity, "ADEO-1", {
        transition: { id: "demo-in-progress" },
      }),
    ]);
    for (const attempt of attempts) {
      assert.equal(attempt.ok, false, JSON.stringify(identity));
      assert.ok(
        [400, 401].includes(attempt.ok ? 0 : attempt.statusCode),
        JSON.stringify(identity),
      );
      assert.match(attempt.ok ? "" : attempt.error, /Nothing was written/);
    }
  }
  assert.deepEqual(getIssues(), clean);
  assert.deepEqual(listComments("ADEO-1"), []);
  assert.ok(isObservedStatus(getIssue("ADEO-1")?.status));
  void beforeIssues;
  void beforeComments;
  resetIssues();
});

test("passport admin/member/viewer write parity matches native routes", async () => {
  resetIssues();
  // Passport member comments; Passport viewer cannot; malformed never falls back.
  const memberComment = await restAddComment(passport("member", "parity-m"), {
    body: "Member comment",
  } as unknown as Parameters<typeof restAddComment>[2]);
  void memberComment;
  const memberOk = await restAddComment(
    { passportToken: fakeJwt({ external_sub: "parity-m", role: "member" }), nodeEnv: "production" },
    "ADEO-1",
    { body: "Member comment" },
  );
  assert.equal(memberOk.ok, true);
  const viewerDenied = await restAddComment(
    { passportToken: fakeJwt({ external_sub: "parity-v" }), nodeEnv: "production" },
    "ADEO-1",
    { body: "Viewer comment" },
  );
  assert.equal(viewerDenied.ok, false);
  assert.equal(viewerDenied.ok ? 0 : viewerDenied.statusCode, 403);
  const malformed = await restAddComment(
    { passportToken: "bogus", demoUser: "demo-admin", nodeEnv: "production" },
    "ADEO-1",
    { body: "Never" },
  );
  assert.equal(malformed.ok, false);
  assert.equal(malformed.ok ? 0 : malformed.statusCode, 401);
  // Native authority agrees action by action.
  assert.equal(
    authorizeAppWrite(
      { passportToken: fakeJwt({ external_sub: "parity-v" }), nodeEnv: "production" },
      "comment",
    ).ok,
    false,
  );
  assert.equal(
    authorizeAppWrite(
      { passportToken: fakeJwt({ external_sub: "parity-m", role: "member" }), nodeEnv: "production" },
      "comment",
    ).ok,
    true,
  );
  assert.equal(resolveAppActor({ demoUser: "demo-viewer", nodeEnv: "test" }).ok, true);
  // The member comment persisted exactly once (the malformed/viewer denials wrote nothing).
  assert.equal((listComments("ADEO-1") ?? []).length, 1);
  resetIssues();
});

test("mcp demoUser fallback reports demoFallback without Passport claims", async () => {
  resetIssues();
  assert.deepEqual(mcpWriteIdentity(undefined), {
    passportToken: undefined,
    demoUser: undefined,
    devUser: undefined,
    nodeEnv: "test",
  });
  const created = await restCreateIssue(mcpWriteIdentity("demo-member"), {
    fields: { summary: "MCP-shaped write" },
  });
  assert.equal(created.ok, true);
  if (created.ok) {
    assert.equal(created.data.identitySource, "demoFallback");
    assert.equal(created.data.actor.identitySource, "demoFallback");
  }
  const gated = authorizeRestWrite(mcpWriteIdentity("demo-viewer"), "create");
  assert.equal(gated.ok, false);
  assert.equal(gated.ok ? 0 : gated.statusCode, 403);
  // Native member creation agrees: the store path is shared.
  const native = createIssue({ title: "Native write" });
  assert.equal(native.ok, true);
  assert.ok(getIssue(native.ok ? native.issue.key : ""));
  resetIssues();
});
