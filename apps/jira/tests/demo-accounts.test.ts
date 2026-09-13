import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DEMO_USER_ID,
  DEMO_ACCOUNTS,
  DEMO_ROLE_MATRIX_LABEL,
  authorizeDemoWrite,
  lookupDemoAccount,
  resolveDemoActor,
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

test("three labelled synthetic demo accounts with the fixed role matrix", () => {
  assert.equal(DEMO_ACCOUNTS.length, 3);
  assert.deepEqual(
    DEMO_ACCOUNTS.map((account) => account.id),
    ["demo-admin", "demo-member", "demo-viewer"],
  );
  for (const account of DEMO_ACCOUNTS) {
    assert.equal(account.demoOnly, true);
    assert.match(account.label, /Demo (Admin|Member|Viewer)/);
  }
  assert.equal(lookupDemoAccount("demo-admin")?.role, "admin");
  assert.equal(lookupDemoAccount("demo-member")?.role, "member");
  assert.equal(lookupDemoAccount("demo-viewer")?.role, "viewer");
  assert.equal(lookupDemoAccount("demo-admin")?.canWrite, true);
  assert.equal(lookupDemoAccount("demo-admin")?.canReset, true);
  assert.equal(lookupDemoAccount("demo-member")?.canWrite, true);
  assert.equal(lookupDemoAccount("demo-member")?.canReset, false);
  assert.equal(lookupDemoAccount("demo-viewer")?.canWrite, false);
  assert.equal(lookupDemoAccount("demo-viewer")?.canReset, false);
  assert.match(DEMO_ROLE_MATRIX_LABEL, /Demo-only role matrix/);
  assert.equal(DEFAULT_DEMO_USER_ID, "demo-member");
});

test("missing identity falls back to the explicit default without writing", () => {
  resetIssues();
  const before = getIssues();
  const fallback = resolveDemoActor(undefined);
  assert.equal(fallback.ok, true);
  if (fallback.ok) {
    assert.equal(fallback.account.id, DEFAULT_DEMO_USER_ID);
    assert.equal(fallback.explicit, false);
  }
  assert.deepEqual(getIssues(), before);
  resetIssues();
});

test("unknown identity is rejected with 401 and blank identity with 400, both labelled demo-only", () => {
  const unknown = resolveDemoActor("mallory");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok ? 0 : unknown.statusCode, 401);
  assert.match(unknown.ok ? "" : unknown.error, /Unknown demo identity/);
  assert.match(unknown.ok ? "" : unknown.error, /Demo-only role matrix/);
  for (const malformed of ["", "   ", 42, {}, []]) {
    const rejected = resolveDemoActor(malformed);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.ok ? 0 : rejected.statusCode, 400);
    assert.match(rejected.ok ? "" : rejected.error, /Malformed demo identity/);
  }
  const permission = authorizeDemoWrite("mallory", "create");
  assert.equal(permission.ok, false);
  assert.equal(permission.ok ? 0 : permission.statusCode, 401);
});

test("viewer is read-only: every write kind is denied with 403 and mutates nothing", () => {
  resetIssues();
  const beforeIssues = getIssues();
  const beforeCommentCount = (listComments("ADEO-1") ?? []).length;
  for (const action of ["create", "update", "comment", "reset"] as const) {
    const denied = authorizeDemoWrite("demo-viewer", action);
    assert.equal(denied.ok, false);
    assert.equal(denied.ok ? 0 : denied.statusCode, 403);
    assert.match(denied.ok ? "" : denied.error, /Demo-only permission denied/);
    assert.match(denied.ok ? "" : denied.error, /changed nothing/);
  }
  // The store itself does not enforce actors; this pins the no-write
  // contract the routes must keep: identity denial happens before touching
  // create/update/comment/reset.
  assert.deepEqual(getIssues(), beforeIssues);
  assert.equal((listComments("ADEO-1") ?? []).length, beforeCommentCount);
  assert.ok(getIssue("ADEO-1"));
  assert.ok(listComments("ADEO-1"));
  resetIssues();
});

test("member can write but cannot reset", () => {
  const write = authorizeDemoWrite("demo-member", "create");
  assert.equal(write.ok, true);
  const comment = authorizeDemoWrite("demo-member", "comment");
  assert.equal(comment.ok, true);
  const reset = authorizeDemoWrite("demo-member", "reset");
  assert.equal(reset.ok, false);
  assert.equal(reset.ok ? 0 : reset.statusCode, 403);
  assert.match(reset.ok ? "" : reset.error, /cannot reset/);
});

test("admin can write and reset while fail paths and reset semantics hold", () => {
  resetIssues();
  for (const action of ["create", "update", "comment", "reset"] as const) {
    assert.equal(authorizeDemoWrite("demo-admin", action).ok, true);
  }
  const failedCreate = createIssue({ title: "Never saved" }, { fail: true });
  assert.equal(failedCreate.ok, false);
  const failedUpdate = updateIssue("ADEO-1", { status: "Done" }, { fail: true });
  assert.equal(failedUpdate.ok, false);
  const failedComment = addComment("ADEO-1", { body: "Never saved" }, { fail: true });
  assert.equal(failedComment.ok, false);
  assert.equal(getIssue("ADEO-1")?.status, "To Do");
  assert.deepEqual(listComments("ADEO-1"), []);

  const created = createIssue({ title: "Demo actor write" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  assert.equal(updateIssue(key, { status: "Done" }).ok, true);
  assert.equal(addComment("ADEO-1", { body: "Visible" }).ok, true);
  resetIssues();
  assert.equal(getIssue(key), undefined);
  assert.deepEqual(listComments("ADEO-1"), []);
  assert.deepEqual(
    getIssues().map((issue) => issue.key),
    ["ADEO-1", "ADEO-2", "ADEO-3", "ADEO-4"],
  );
});
