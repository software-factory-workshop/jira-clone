import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  availableBoardId,
  boardTypeLabel,
  jiraBoardsFromResponse,
} from "../app/utils/jiraBoards.ts";

const boards = [
  { id: "1", name: "KAN board", type: "simple" as const, projectKey: "KAN" },
  { id: "2", name: "Workshop delivery", type: "kanban" as const, projectKey: "KAN" },
];

test("board responses are narrowed into the UI selection shape", () => {
  assert.deepEqual(
    jiraBoardsFromResponse({
      total: 3,
      values: [
        { id: "1", name: "KAN board", type: "simple", location: { projectKey: "KAN" } },
        { id: "2", name: "Workshop delivery", type: "kanban", location: { projectKey: "KAN" } },
        { id: "3", name: "", type: "scrum", location: { projectKey: "KAN" } },
      ],
    }),
    boards,
  );
});

test("selection retains an available board and falls back after reset", () => {
  assert.equal(availableBoardId(boards, "2"), "2");
  assert.equal(availableBoardId(boards, "missing"), "1");
  assert.equal(availableBoardId([], "2"), "");
  assert.equal(boardTypeLabel("simple"), "Simple");
  assert.equal(boardTypeLabel("kanban"), "Kanban");
});

test("the Jira workspace exposes and wires an accessible board selector", async () => {
  const components = new URL("../app/components/", import.meta.url);
  const sidebar = await readFile(new URL("JiraProjectSidebar.vue", components), "utf8");
  const workspace = await readFile(new URL("JiraWorkspace.vue", components), "utf8");

  assert.match(sidebar, /aria-labelledby="board-selector-label"/);
  assert.match(sidebar, /v-model="boardId"/);
  assert.match(workspace, /\/api\/rest\/agile\/1\.0\/board/);
  assert.match(workspace, /v-model:board-id="selectedBoardId"/);
  assert.match(workspace, /selectedBoard\?\.name/);
});
