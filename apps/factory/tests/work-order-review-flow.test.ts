import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

test("home composes a work order and task mining is a separate route", async () => {
  const [home, editor, miningPage, shell] = await Promise.all([
    source("app/pages/index.vue"),
    source("app/components/NewDraftEditor.vue"),
    source("app/pages/task-mining.vue"),
    source("app/app.vue"),
  ]);

  assert.match(home, /<NewDraftEditor/);
  assert.doesNotMatch(home, /<MiningStation/);
  assert.match(editor, /path: "\/task-mining", query: \{ draft: activeId\.value \}/);
  assert.doesNotMatch(editor, /\$fetch<\{ id: string \}>\("\/factory\/delivery"/);
  assert.match(miningPage, /<MiningStation/);
  assert.match(shell, />Work order/);
  assert.match(shell, /to="\/task-mining"/);
});

test("only the approval action starts delivery and rejection restores the saved request", async () => {
  const miningRun = await source("app/components/MiningRun.vue");

  assert.match(miningRun, /async function approveWorkOrder/);
  assert.match(miningRun, /admission\?\.kind !== "work_order"/);
  assert.match(miningRun, /"\/factory\/cockpit\/approve"/);
  assert.match(miningRun, /"\/factory\/delivery"/);
  assert.match(miningRun, /path: "\/", query: \{ draft: props\.sourceWorkOrder\.id \}/);
});
