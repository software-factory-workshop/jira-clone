import test from "node:test";
import assert from "node:assert/strict";
import { createIssue, deleteIssue, getIssue, getIssues, listComments, addComment, resetIssues } from "../server/utils/issues.ts";
import { restDeleteIssue } from "../server/utils/jiraRest.ts";
import { authorizeDemoWrite } from "../server/utils/demoAccounts.ts";

test("delete: removes created and seeded issues with their comments; reset brings seeds back", () => {
  resetIssues();
  const created = createIssue({ title: "Throwaway" });
  assert.ok(created.ok);
  const key = created.ok ? created.issue.key : "";
  addComment(key, { body: "bye" });
  assert.equal(deleteIssue(key).ok, true);
  assert.equal(getIssue(key), undefined);
  assert.equal(listComments(key), undefined);
  assert.equal(deleteIssue(key).ok ? 0 : deleteIssue(key).statusCode, 404);
  const before = getIssues().length;
  assert.equal(deleteIssue("ADEO-1").ok, true);
  assert.equal(getIssues().length, before - 1);
  assert.equal(getIssue("ADEO-1"), undefined);
  assert.equal(deleteIssue("ADEO-2", { fail: true }).ok, false);
  assert.ok(getIssue("ADEO-2"));
  resetIssues();
  assert.ok(getIssue("ADEO-1"));
});

test("delete: viewer denied, member allowed, admin allowed; REST helper fails closed", async () => {
  resetIssues();
  assert.equal(authorizeDemoWrite("demo-viewer", "delete").ok, false);
  assert.equal(authorizeDemoWrite("demo-member", "delete").ok, true);
  assert.equal(authorizeDemoWrite("demo-admin", "delete").ok, true);
  const denied = await restDeleteIssue({ demoUser: "demo-viewer", nodeEnv: "test" }, "ADEO-3");
  assert.equal(denied.ok, false);
  assert.equal(denied.ok ? 0 : denied.statusCode, 403);
  assert.ok(getIssue("ADEO-3"));
  const unknown = await restDeleteIssue({ demoUser: "demo-member", nodeEnv: "test" }, "ADEO-999");
  assert.equal(unknown.ok ? 0 : unknown.statusCode, 404);
  const done = await restDeleteIssue({ demoUser: "demo-member", nodeEnv: "test" }, "ADEO-3");
  assert.ok(done.ok);
  if (done.ok) assert.equal(done.data.deleted, true);
  assert.equal(getIssue("ADEO-3"), undefined);
  resetIssues();
});
