import test from "node:test";
import assert from "node:assert/strict";
import {
  getIssue,
  getIssues,
  resetIssues,
  updateIssue,
} from "../server/utils/issues.ts";
import {
  authorizeAppWrite,
} from "../server/utils/appAccounts.ts";
import {
  detailDraftFromIssue,
  isDetailDraftDirty,
  saveDetailFields,
  toDetailPatch,
  validateDetailDraft,
} from "../app/utils/issueFields.ts";
import {
  canInvokeMutation,
  capabilitiesForAccount,
} from "../app/utils/roleAffordances.ts";
import type { BoardIssue } from "../app/utils/boardMove.ts";

const boardSeed: BoardIssue[] = [
  { key: "ADEO-1", title: "One", type: "Story", status: "To Do", priority: "Medium", assignee: "Unassigned", description: "demo" },
  { key: "ADEO-2", title: "Two", type: "Task", status: "In Progress", priority: "High", assignee: "Demo member", description: "details" },
];

test("native PATCH save path accepts summary/assignee/description and reload agrees", () => {
  resetIssues();
  const updated = updateIssue("ADEO-1", {
    title: "Renamed summary",
    assignee: "Demo member",
    description: "Edited description",
  });
  assert.equal(updated.ok, true);
  if (updated.ok) {
    assert.equal(updated.issue.title, "Renamed summary");
    assert.equal(updated.issue.assignee, "Demo member");
    assert.equal(updated.issue.description, "Edited description");
  }
  // A reload is a fresh read of the same demo-only store on both reads.
  assert.equal(getIssue("ADEO-1")?.title, "Renamed summary");
  assert.equal(getIssues().find((issue) => issue.key === "ADEO-1")?.assignee, "Demo member");
  assert.deepEqual(getIssue("ADEO-1"), getIssues().find((issue) => issue.key === "ADEO-1"));
  resetIssues();
});

test("reset clears field overrides back to fixtures", () => {
  resetIssues();
  assert.equal(updateIssue("ADEO-1", { title: "Changed", assignee: "Demo member", description: "changed" }).ok, true);
  resetIssues();
  assert.equal(getIssue("ADEO-1")?.title, "Welcome to the ADEO Jira workspace");
  assert.equal(getIssue("ADEO-1")?.assignee, "Unassigned");
  resetIssues();
});

test("blank title/assignee and non-string description reject before writing", () => {
  resetIssues();
  const before = getIssue("ADEO-1");
  for (const patch of [
    { title: "   " },
    { assignee: "" },
    { assignee: null },
    { description: 42 },
  ]) {
    const rejected = updateIssue("ADEO-1", patch);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.ok ? 0 : rejected.statusCode, 400);
  }
  assert.deepEqual(getIssue("ADEO-1"), before);
  resetIssues();
});

test("Unassigned clears the assignee; empty description clears it", () => {
  resetIssues();
  assert.equal(updateIssue("ADEO-2", { assignee: "Unassigned" }).ok, true);
  assert.equal(getIssue("ADEO-2")?.assignee, "Unassigned");
  assert.equal(updateIssue("ADEO-2", { description: "" }).ok, true);
  assert.equal(getIssue("ADEO-2")?.description, "");
  resetIssues();
});

test("deterministic failure writes nothing", () => {
  resetIssues();
  const before = getIssue("ADEO-1");
  const failed = updateIssue("ADEO-1", { title: "Never saved" }, { fail: true });
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? 0 : failed.statusCode, 500);
  assert.deepEqual(getIssue("ADEO-1"), before);
  resetIssues();
});

test("viewer writes stay 403 and member reset stays 403 through the shared authority", () => {
  resetIssues();
  const before = getIssues();
  const viewer = authorizeAppWrite({ demoUser: "demo-viewer", nodeEnv: "test" }, "update");
  assert.equal(viewer.ok, false);
  assert.equal(viewer.ok ? 0 : viewer.statusCode, 403);
  const memberReset = authorizeAppWrite({ demoUser: "demo-member", nodeEnv: "test" }, "reset");
  assert.equal(memberReset.ok, false);
  assert.equal(memberReset.ok ? 0 : memberReset.statusCode, 403);
  assert.deepEqual(getIssues(), before);
  resetIssues();
});

test("detail draft round-trips the server read and detects edits", () => {
  resetIssues();
  const issue = getIssue("ADEO-1");
  assert.ok(issue);
  const draft = detailDraftFromIssue(issue!);
  assert.equal(draft.summary, issue!.title);
  assert.equal(draft.assignee, issue!.assignee);
  assert.equal(draft.description, issue!.description);
  assert.equal(isDetailDraftDirty(draft, issue!), false);
  assert.equal(isDetailDraftDirty({ ...draft, summary: `${draft.summary} v2` }, issue!), true);
  assert.equal(isDetailDraftDirty({ ...draft, assignee: "Demo member" }, issue!), true);
  assert.equal(isDetailDraftDirty({ ...draft, description: `${draft.description} more` }, issue!), true);
  // Summary/assignee compare trimmed like the store; description is exact.
  assert.equal(isDetailDraftDirty({ ...draft, summary: `  ${draft.summary}  ` }, issue!), false);
  assert.deepEqual(toDetailPatch(draft), {
    title: draft.summary.trim(),
    assignee: draft.assignee.trim(),
    description: draft.description,
  });
  resetIssues();
});

test("draft validation rejects blanks before any save", () => {
  assert.match(validateDetailDraft({ summary: "  ", assignee: "Demo member", description: "x" }) ?? "", /nonblank demo summary/);
  assert.match(validateDetailDraft({ summary: "x", assignee: "  ", description: "x" }) ?? "", /Unassigned/);
  assert.match(validateDetailDraft({ summary: "x", assignee: "Demo member", description: 42 }) ?? "", /must be a string/);
  assert.equal(validateDetailDraft({ summary: "x", assignee: "Unassigned", description: "" }), null);
});

test("client helper saves fields and reload read agrees; failure keeps the draft", async () => {
  resetIssues();
  const issues = getIssues();
  const saved = await saveDetailFields(issues, "ADEO-1", {
    summary: "Saved summary",
    assignee: "Demo member",
    description: "Saved description",
  }, async (key, patch) => {
    const result = updateIssue(key, patch);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error("unexpected save failure");
    return result.issue;
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.issues.find((issue) => issue.key === "ADEO-1")?.title, "Saved summary");
  assert.equal(getIssue("ADEO-1")?.assignee, "Demo member");
  assert.equal(getIssue("ADEO-1")?.description, "Saved description");

  const failed = await saveDetailFields(boardSeed, "ADEO-1", {
    summary: "Kept draft",
    assignee: "Demo member",
    description: "kept",
  }, async () => {
    throw new Error("Demo-only save failure (deterministic test path). No changes were saved.");
  });
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.issues, boardSeed);
  if (!failed.ok) {
    assert.equal(failed.draft.summary, "Kept draft");
    assert.match(failed.error, /Demo-only save failure/);
  }
  resetIssues();
});

test("client helper rejects blank drafts before saving", async () => {
  let saves = 0;
  const result = await saveDetailFields(boardSeed, "ADEO-1", {
    summary: "  ",
    assignee: "Demo member",
    description: "x",
  }, async () => {
    saves += 1;
    return { ...boardSeed[0]! };
  });
  assert.equal(result.ok, false);
  assert.equal(saves, 0);
  assert.deepEqual(result.issues, boardSeed);
});

test("role affordance gates the dialog save path without duplicating the matrix", () => {
  const viewer = capabilitiesForAccount({ role: "viewer", canWrite: false, canReset: false });
  const member = capabilitiesForAccount({ role: "member", canWrite: true, canReset: false });
  assert.equal(canInvokeMutation("update", viewer), false);
  assert.equal(canInvokeMutation("update", member), true);
  assert.equal(canInvokeMutation("reset", member), false);
});
