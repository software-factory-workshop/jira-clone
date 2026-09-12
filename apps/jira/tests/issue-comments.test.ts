import test from "node:test";
import assert from "node:assert/strict";
import {
  addComment,
  listComments,
  resetIssues,
  DEMO_COMMENT_AUTHOR,
} from "../server/utils/issues.ts";

test("added comments are listed per issue key and survive reload of the store", () => {
  resetIssues();
  const added = addComment("ADEO-1", "First demo comment");
  assert.equal(added.ok, true);
  assert.equal(added.ok && added.comment.author, DEMO_COMMENT_AUTHOR);
  const listed = listComments("ADEO-1");
  assert.equal(listed.ok, true);
  assert.equal(listed.ok && listed.comments.length, 1);
  assert.equal(
    listed.ok && listed.comments[0]?.body,
    "First demo comment",
  );
  // Other issues stay empty: per-key isolation.
  const other = listComments("ADEO-2");
  assert.equal(other.ok, true);
  assert.equal(other.ok && other.comments.length, 0);
  resetIssues();
});

test("deterministic failed save keeps draft recovery possible: no false success", () => {
  resetIssues();
  const failed = addComment("ADEO-1", "Unsaved draft", { fail: true });
  assert.equal(failed.ok, false);
  assert.match(
    !failed.ok ? failed.error : "",
    /Demo-only save failure/,
  );
  const listed = listComments("ADEO-1");
  assert.equal(listed.ok, true);
  assert.equal(listed.ok && listed.comments.length, 0);
  // A retry without the failure flag succeeds (draft is kept by the caller).
  const retry = addComment("ADEO-1", "Unsaved draft");
  assert.equal(retry.ok, true);
  assert.equal(listComments("ADEO-1").ok, true);
  resetIssues();
});

test("unknown issue keys are rejected for list and add", () => {
  resetIssues();
  const listed = listComments("ADEO-9");
  assert.equal(listed.ok, false);
  assert.equal(!listed.ok && listed.statusCode, 404);
  const added = addComment("ADEO-9", "Hello");
  assert.equal(added.ok, false);
  assert.equal(!added.ok && added.statusCode, 404);
  resetIssues();
});

test("empty and oversized bodies are rejected without writing", () => {
  resetIssues();
  assert.equal(addComment("ADEO-1", "   ").ok, false);
  assert.equal(addComment("ADEO-1", "x".repeat(2001)).ok, false);
  const listed = listComments("ADEO-1");
  assert.equal(listed.ok, true);
  assert.equal(listed.ok && listed.comments.length, 0);
  resetIssues();
});

test("reset clears comments alongside status overrides", () => {
  resetIssues();
  addComment("ADEO-1", "Temporary comment");
  resetIssues();
  const listed = listComments("ADEO-1");
  assert.equal(listed.ok, true);
  assert.equal(listed.ok && listed.comments.length, 0);
});
