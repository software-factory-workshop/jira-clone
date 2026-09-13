import test from "node:test";
import assert from "node:assert/strict";
import {
  addComment,
  createIssue,
  DEMO_COMMENT_AUTHOR,
  getIssue,
  listComments,
  resetIssues,
} from "../server/utils/issues.ts";
import {
  fetchIssueComments,
  submitIssueComment,
  type DemoComment,
  type IssueCommentsResponse,
} from "../app/utils/issueComments.ts";
import { restCommentsUrl } from "../app/utils/restIssues.ts";

/** Stub JSON fetcher backed by the real demo-only server store. */
function commentsFetch(calls: string[]) {
  return async (url: string): Promise<IssueCommentsResponse> => {
    calls.push(url);
    const match = /\/issue\/([^/]+)\/comment/.exec(url);
    const key = decodeURIComponent(match?.[1] ?? "");
    const comments = listComments(key);
    if (!comments) {
      throw new Error(`Unknown issue key: ${key}.`);
    }
    return { comments, demoOnly: true };
  };
}

test("add/list round-trips comments on a seeded key", async () => {
  resetIssues();
  const added = addComment("ADEO-1", { body: "First demo comment" });
  assert.equal(added.ok, true);
  if (added.ok) {
    assert.equal(added.comment.body, "First demo comment");
    assert.equal(added.comment.author, DEMO_COMMENT_AUTHOR);
    assert.match(added.comment.author, /demo-only/);
    assert.equal(added.comment.demoOnly, true);
    assert.ok(added.comment.id.startsWith("ADEO-1-comment-"));
  }
  const listed = listComments("ADEO-1");
  assert.equal(listed?.length, 1);
  const calls: string[] = [];
  const result = await fetchIssueComments("ADEO-1", commentsFetch(calls));
  assert.deepEqual(calls, [restCommentsUrl("ADEO-1")]);
  assert.equal(result.demoOnly, true);
  assert.deepEqual(result.comments, listed);
  resetIssues();
});

test("comments are isolated per issue key", () => {
  resetIssues();
  assert.equal(addComment("ADEO-1", { body: "Only on one" }).ok, true);
  assert.deepEqual(
    (listComments("ADEO-1") ?? []).map((comment) => comment.body),
    ["Only on one"],
  );
  assert.deepEqual(listComments("ADEO-2"), []);
  resetIssues();
});

test("seeded and created ADEO-n keys both accept comments", () => {
  resetIssues();
  const created = createIssue({ title: "Demo comment target" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  assert.ok(getIssue(key));
  assert.equal(addComment(key, { body: "On the created issue" }).ok, true);
  assert.equal(listComments(key)?.length, 1);
  assert.equal(listComments("ADEO-1")?.length, 0);
  resetIssues();
});

test("unknown keys are rejected before writing", () => {
  resetIssues();
  assert.equal(listComments("ADEO-9999"), undefined);
  const rejected = addComment("ADEO-9999", { body: "Never stored" });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.ok ? 0 : rejected.statusCode, 404);
  assert.equal(listComments("ADEO-1")?.length, 0);
  resetIssues();
});

test("blank bodies are rejected before writing", () => {
  resetIssues();
  for (const body of ["", "   ", undefined]) {
    const rejected = addComment("ADEO-1", { body });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.ok ? 0 : rejected.statusCode, 400);
  }
  assert.deepEqual(listComments("ADEO-1"), []);
  resetIssues();
});

test("deterministic failure writes nothing", () => {
  resetIssues();
  const before = listComments("ADEO-1");
  const failed = addComment(
    "ADEO-1",
    { body: "Never saved" },
    { fail: true },
  );
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? 0 : failed.statusCode, 500);
  assert.deepEqual(listComments("ADEO-1"), before);
  resetIssues();
});

test("reset clears comments", () => {
  resetIssues();
  assert.equal(addComment("ADEO-1", { body: "Temporary" }).ok, true);
  resetIssues();
  assert.deepEqual(listComments("ADEO-1"), []);
});

test("submit helper keeps the draft on failure and clears it on success", async () => {
  const seed: DemoComment[] = [
    {
      id: "ADEO-1-comment-1",
      body: "Existing",
      author: DEMO_COMMENT_AUTHOR,
      createdAt: "2026-09-12T00:00:00.000Z",
      demoOnly: true,
    },
  ];
  const failed = await submitIssueComment(seed, "  kept draft  ", async () => {
    throw new Error(
      "Demo-only comment save failure (deterministic test path).",
    );
  });
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.comments, seed);
  assert.equal(failed.draft, "  kept draft  ");
  assert.match(failed.error, /Demo-only comment save failure/);

  const blank = await submitIssueComment(seed, "   ", async () => seed[0]!);
  assert.equal(blank.ok, false);
  assert.deepEqual(blank.comments, seed);
  assert.equal(blank.draft, "   ");

  const saved: DemoComment = {
    id: "ADEO-1-comment-2",
    body: "kept draft",
    author: DEMO_COMMENT_AUTHOR,
    createdAt: "2026-09-12T00:00:01.000Z",
    demoOnly: true,
  };
  const succeeded = await submitIssueComment(
    seed,
    "  kept draft  ",
    async (body) => {
      assert.equal(body, "kept draft");
      return saved;
    },
  );
  assert.equal(succeeded.ok, true);
  assert.deepEqual(succeeded.comments, [...seed, saved]);
  assert.equal(succeeded.draft, "");
});
