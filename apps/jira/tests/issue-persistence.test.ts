import test from "node:test";
import assert from "node:assert/strict";
import type {
  NeonQueryFunction,
  NeonQueryFunctionInTransaction,
} from "@neondatabase/serverless";
import { demoIssues } from "@jira-clone/context";
import {
  createNeonIssuePersistence,
  createPersistentIssue,
  getIssuePersistence,
  getIssuePersistenceInfo,
  getPersistentIssues,
  addPersistentComment,
  listPersistentComments,
  resetPersistentIssues,
  updatePersistentIssue,
} from "../server/utils/issuePersistence.ts";
import { resetIssues } from "../server/utils/issues.ts";

async function withEnv<T>(
  values: Record<string, string | undefined>,
  callback: () => T | Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("memory persistence keeps the existing async demo contract", async () => {
  await withEnv(
    { JIRA_PERSISTENCE: "memory", DATABASE_URL: undefined },
    async () => {
      resetIssues();
      assert.deepEqual(getIssuePersistenceInfo(), {
        mode: "memory",
        durable: false,
        label: "In-memory fallback",
        description:
          "In-memory fallback. Writes survive reloads on this running server and reset on cold starts, deploys or the explicit demo reset.",
      });
      assert.equal(getIssuePersistence().mode, "memory");

      const created = await createPersistentIssue({ title: "Async persistence" });
      assert.equal(created.ok, true);
      assert.equal(created.ok ? created.issue.key : "", "ADEO-5");
      const comment = await addPersistentComment("ADEO-5", {
        body: "Stored through the shared boundary",
      });
      assert.equal(comment.ok, true);
      assert.equal((await listPersistentComments("ADEO-5"))?.length, 1);
      const updated = await updatePersistentIssue("ADEO-5", {
        title: "Reloaded persistence",
      });
      assert.equal(updated.ok, true);
      assert.equal((await getPersistentIssues()).at(-1)?.title, "Reloaded persistence");

      const reset = await resetPersistentIssues();
      assert.equal(reset.length, demoIssues.length);
      assert.equal((await listPersistentComments("ADEO-5")), undefined);
      resetIssues();
    },
  );
});

test("DATABASE_URL selects Neon without opening a connection during inspection", async () => {
  await withEnv(
    { JIRA_PERSISTENCE: undefined, DATABASE_URL: "postgresql://neon.example/demo" },
    () => {
      assert.deepEqual(getIssuePersistenceInfo(), {
        mode: "neon",
        durable: true,
        label: "Neon Postgres",
        description:
          "Neon Postgres persistence. Issue and comment writes survive reloads, cold starts and deploys until the demo reset is used.",
      });
    },
  );
});

test("forced Neon fails clearly when DATABASE_URL is missing", async () => {
  await withEnv(
    { JIRA_PERSISTENCE: "neon", DATABASE_URL: undefined },
    async () => {
      assert.throws(
        () => getIssuePersistence(),
        /Neon persistence requires DATABASE_URL/,
      );
      await assert.rejects(
        getPersistentIssues(),
        /Neon persistence requires DATABASE_URL/,
      );
    },
  );
});

test("Neon adapter bootstraps once and maps issue/comment reads and writes", async () => {
  const queries: string[] = [];
  const issue = {
    key: "ADEO-1",
    title: "Seed issue",
    type: "Story",
    status: "To Do",
    priority: "Medium",
    assignee: "Unassigned",
    description: "Seed description",
  };
  const created = { ...issue, key: "ADEO-5", title: "Created issue" };
  const comment = {
    comment_number: "1",
    issue_key: "ADEO-1",
    body: "Neon comment",
    author: "Demo member (demo-only fixture)",
    created_at: "2026-09-13T00:00:00.000Z",
  };

  const runQuery = async (
    strings: TemplateStringsArray,
  ): Promise<unknown[]> => {
    const text = strings.raw.join("$").replace(/\s+/g, " ").trim();
    queries.push(text);
    if (text.includes("jsonb_array_elements") || text.includes("setval(") || text.includes("TRUNCATE")) {
      return [];
    }
    if (text.startsWith("SELECT comment_number")) return [comment];
    if (text.startsWith("INSERT INTO jira_demo_comments")) return [comment];
    if (text.startsWith("UPDATE jira_demo_issues")) return [issue];
    if (text.startsWith("INSERT INTO jira_demo_issues")) return [created];
    if (text.includes("FROM jira_demo_issues") && text.includes("WHERE key")) {
      return [issue];
    }
    if (text.includes("FROM jira_demo_issues") && text.includes("ORDER BY issue_number")) {
      return [issue];
    }
    return [];
  };

  const sql = ((strings: TemplateStringsArray) => runQuery(strings)) as unknown as NeonQueryFunction<false, false>;
  const tx = ((strings: TemplateStringsArray) => runQuery(strings)) as unknown as NeonQueryFunctionInTransaction<false, false>;
  Object.assign(sql, {
    unsafe: (value: string) => value,
    transaction: async (callback: (transaction: NeonQueryFunctionInTransaction<false, false>) => readonly Promise<unknown>[]) =>
      Promise.all(callback(tx)),
  });

  const persistence = createNeonIssuePersistence(sql, [issue]);
  assert.deepEqual(await persistence.getIssues(), [issue]);
  assert.deepEqual(await persistence.getIssue("ADEO-1"), issue);
  assert.equal((await persistence.updateIssue("ADEO-1", { title: "Updated" })).ok, true);
  assert.equal((await persistence.createIssue({ title: "Created" })).ok, true);
  assert.equal((await persistence.listComments("ADEO-1"))?.[0]?.body, "Neon comment");
  assert.equal((await persistence.addComment("ADEO-1", { body: "Neon comment" })).ok, true);
  assert.deepEqual(await persistence.resetIssues(), [issue]);
  assert.equal(queries.filter((query) => query.startsWith("CREATE TABLE")).length, 2);
  assert.equal(queries.filter((query) => query.includes("jsonb_array_elements")).length, 2);
});
