import test from "node:test";
import assert from "node:assert/strict";
import type { NeonQueryFunction, NeonQueryFunctionInTransaction } from "@neondatabase/serverless";
import {
  createNeonBoardPersistence,
  listPersistentBoards,
  resetMemoryBoards,
  resetPersistentBoards,
} from "../server/utils/boardPersistence.ts";
import {
  mcpWriteIdentity,
  restBoards,
  restCreateBoard,
} from "../server/utils/jiraRest.ts";

test("memory board persistence creates a board that subsequent reads observe", async () => {
  assert.deepEqual(await resetPersistentBoards(), [
    { id: "1", name: "KAN board", type: "simple", projectKey: "KAN" },
  ]);
  const before = await restBoards();
  assert.equal(before.ok && before.data.total, 1);

  const created = await restCreateBoard(mcpWriteIdentity("demo-member"), {
    name: "Workshop delivery",
    type: "kanban",
  });
  assert.equal(created.ok, true);
  if (created.ok) {
    assert.deepEqual(
      {
        id: created.data.board.id,
        name: created.data.board.name,
        type: created.data.board.type,
        projectKey: created.data.board.location.projectKey,
      },
      { id: "2", name: "Workshop delivery", type: "kanban", projectKey: "KAN" },
    );
  }

  const after = await listPersistentBoards();
  assert.deepEqual(after.map(({ id, name }) => ({ id, name })), [
    { id: "1", name: "KAN board" },
    { id: "2", name: "Workshop delivery" },
  ]);
  resetMemoryBoards();
});

test("board creation validates and authorizes before persistence", async () => {
  resetMemoryBoards();
  const attempts = [
    restCreateBoard(mcpWriteIdentity("demo-viewer"), { name: "Denied", type: "kanban" }),
    restCreateBoard(mcpWriteIdentity("demo-member"), { name: " ", type: "kanban" }),
    restCreateBoard(mcpWriteIdentity("demo-member"), { name: "Bad type", type: "simple" }),
    restCreateBoard(mcpWriteIdentity("demo-member"), { name: "Bad project", type: "scrum", projectKey: "NOPE" }),
    restCreateBoard(mcpWriteIdentity("demo-member"), { name: "Failed", type: "kanban", fail: true }),
    restCreateBoard(mcpWriteIdentity("demo-member"), { name: "Extra", type: "kanban", extra: true } as never),
  ];
  const results = await Promise.all(attempts);
  assert.deepEqual(results.map((result) => result.ok ? 200 : result.statusCode), [403, 400, 400, 404, 500, 400]);
  assert.deepEqual((await listPersistentBoards()).map((board) => board.id), ["1"]);
});

test("Neon board persistence bootstraps, lists, and creates boards", async () => {
  const queries: string[] = [];
  const seed = { board_number: "1", name: "KAN board", type: "simple", project_key: "KAN" };
  const created = { board_number: "2", name: "Sprint planning", type: "scrum", project_key: "KAN" };

  const runQuery = async (strings: TemplateStringsArray): Promise<unknown[]> => {
    const text = strings.raw.join("$").replace(/\s+/g, " ").trim();
    queries.push(text);
    if (text.startsWith("SELECT board_number")) return [seed];
    if (text.startsWith("INSERT INTO jira_demo_boards (name")) return [created];
    return [];
  };
  const sql = ((strings: TemplateStringsArray) => runQuery(strings)) as unknown as NeonQueryFunction<false, false>;
  const tx = ((strings: TemplateStringsArray) => runQuery(strings)) as unknown as NeonQueryFunctionInTransaction<false, false>;
  Object.assign(sql, {
    transaction: async (callback: (transaction: NeonQueryFunctionInTransaction<false, false>) => readonly Promise<unknown>[]) =>
      Promise.all(callback(tx)),
  });

  const persistence = createNeonBoardPersistence(sql);
  assert.deepEqual(await persistence.listBoards(), [{ id: "1", name: "KAN board", type: "simple", projectKey: "KAN" }]);
  assert.deepEqual(
    await persistence.createBoard({ name: "Sprint planning", type: "scrum", projectKey: "KAN" }),
    { id: "2", name: "Sprint planning", type: "scrum", projectKey: "KAN" },
  );
  assert.deepEqual(await persistence.resetBoards(), [
    { id: "1", name: "KAN board", type: "simple", projectKey: "KAN" },
  ]);
  assert.equal(queries.filter((query) => query.startsWith("CREATE TABLE")).length, 1);
  assert.equal(queries.filter((query) => query.includes("setval(")).length, 2);
});
