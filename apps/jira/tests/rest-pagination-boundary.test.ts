import test from "node:test";
import assert from "node:assert/strict";
import type {
  NeonQueryFunction,
  NeonQueryFunctionInTransaction,
} from "@neondatabase/serverless";
import {
  createNeonIssuePersistence,
  getPersistentIssuesPage,
  listPersistentCommentsPage,
} from "../server/utils/issuePersistence.ts";
import {
  addComment,
  createIssue,
  getIssues,
  listComments,
  resetIssues,
} from "../server/utils/issues.ts";
import { restComments, restSearch } from "../server/utils/jiraRest.ts";

test("memory pagination returns the bounded page with the full total", async () => {
  resetIssues();
  for (let index = 0; index < 3; index += 1) {
    assert.equal(createIssue({ title: `Paged seed ${index}` }).ok, true);
  }
  const all = getIssues();
  assert.equal(all.length, 7);

  const page = await getPersistentIssuesPage(2, 3);
  assert.equal(page.total, 7);
  assert.deepEqual(
    page.issues.map((issue) => issue.key),
    all.slice(2, 5).map((issue) => issue.key),
  );

  const beyond = await getPersistentIssuesPage(99, 10);
  assert.equal(beyond.total, 7);
  assert.deepEqual(beyond.issues, []);

  assert.equal(addComment("ADEO-1", { body: "First" }).ok, true);
  assert.equal(addComment("ADEO-1", { body: "Second" }).ok, true);
  assert.equal(addComment("ADEO-1", { body: "Third" }).ok, true);
  const comments = await listPersistentCommentsPage("ADEO-1", 1, 1);
  assert.equal(comments?.total, 3);
  assert.deepEqual(
    comments?.comments.map((comment) => comment.body),
    ["Second"],
  );
  assert.equal(await listPersistentCommentsPage("ADEO-9999", 0, 10), undefined);

  // The REST adapter serves the same boundary page, not a re-sliced full list.
  const search = await restSearch({ startAt: "2", maxResults: "3" });
  assert.equal(search.ok, true);
  if (search.ok) {
    assert.equal(search.data.total, 7);
    assert.deepEqual(
      search.data.issues.map((issue) => issue.key),
      all.slice(2, 5).map((issue) => issue.key),
    );
  }
  const listed = await restComments("ADEO-1", { startAt: "1", maxResults: "1" });
  assert.equal(listed.ok, true);
  if (listed.ok) {
    assert.equal(listed.data.total, 3);
    assert.deepEqual(
      listed.data.comments.map((comment) => comment.body),
      ["Second"],
    );
  }
  assert.deepEqual(
    (listComments("ADEO-1") ?? []).map((comment) => comment.body),
    ["First", "Second", "Third"],
  );
  resetIssues();
});

test("Neon pagination applies LIMIT/OFFSET inside the database query", async () => {
  const seen: { text: string; values: unknown[] }[] = [];
  const issue = {
    key: "ADEO-1",
    title: "Seed issue",
    type: "Story",
    status: "To Do",
    priority: "Medium",
    assignee: "Unassigned",
    description: "Seed description",
  };
  const runQuery = async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown[]> => {
    const text = strings.raw.join("$").replace(/\s+/g, " ").trim();
    seen.push({ text, values });
    if (
      text.includes("jsonb_array_elements") ||
      text.includes("setval(") ||
      text.includes("TRUNCATE")
    ) {
      return [];
    }
    if (text.startsWith("SELECT COUNT(*)")) {
      // Postgres COUNT(*)::bigint serializes as text over the wire.
      return [{ count: text.includes("FROM jira_demo_comments") ? "3" : "7" }];
    }
    if (text.startsWith("SELECT comment_number")) {
      return [
        {
          comment_number: "2",
          issue_key: "ADEO-1",
          body: "Second",
          author: "Demo member (demo-only fixture)",
          created_at: "2026-09-13T00:00:00.000Z",
        },
      ];
    }
    if (text.includes("FROM jira_demo_issues") && text.includes("WHERE key")) {
      // Mirror the real lookup: only the seeded key resolves.
      return values.includes("ADEO-9") ? [] : [issue];
    }
    if (text.includes("FROM jira_demo_issues") && text.includes("ORDER BY issue_number")) {
      return [issue];
    }
    return [];
  };

  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
    runQuery(strings, ...values)) as unknown as NeonQueryFunction<false, false>;
  const tx = ((strings: TemplateStringsArray, ...values: unknown[]) =>
    runQuery(strings, ...values)) as unknown as NeonQueryFunctionInTransaction<
    false,
    false
  >;
  Object.assign(sql, {
    unsafe: (value: string) => value,
    transaction: async (
      callback: (
        transaction: NeonQueryFunctionInTransaction<false, false>,
      ) => readonly Promise<unknown>[],
    ) => Promise.all(callback(tx)),
  });

  const persistence = createNeonIssuePersistence(sql, [issue]);

  const page = await persistence.getIssuesPage(2, 3);
  assert.equal(page.total, 7);
  assert.deepEqual(
    page.issues.map((entry) => entry.key),
    ["ADEO-1"],
  );
  const issueSelects = seen.filter((query) =>
    query.text.includes("ORDER BY issue_number"),
  );
  assert.equal(issueSelects.length, 1);
  assert.match(issueSelects[0]!.text, /LIMIT/);
  assert.match(issueSelects[0]!.text, /OFFSET/);
  assert.deepEqual(issueSelects[0]!.values.slice(-2), [3, 2]);

  const comments = await persistence.listCommentsPage("ADEO-1", 1, 1);
  assert.equal(comments?.total, 3);
  assert.deepEqual(
    comments?.comments.map((comment) => comment.body),
    ["Second"],
  );
  const commentSelects = seen.filter((query) =>
    query.text.startsWith("SELECT comment_number"),
  );
  assert.equal(commentSelects.length, 1);
  assert.match(commentSelects[0]!.text, /LIMIT/);
  assert.match(commentSelects[0]!.text, /OFFSET/);
  assert.deepEqual(commentSelects[0]!.values, ["ADEO-1", 1, 1]);

  // Unknown keys stay 404-shaped without touching the comments table.
  const commentQueriesBefore = seen.filter((query) =>
    query.text.includes("FROM jira_demo_comments"),
  ).length;
  assert.equal(await persistence.listCommentsPage("ADEO-9", 0, 10), undefined);
  assert.equal(
    seen.filter((query) => query.text.includes("FROM jira_demo_comments")).length,
    commentQueriesBefore,
  );
});
