import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentRoot = new URL("../app/components/", import.meta.url);

test("indicator legend explains status and priority with text", async () => {
  const legend = await readFile(new URL("JiraBoardLegend.vue", componentRoot), "utf8");

  assert.match(legend, /Board indicator legend/);
  assert.match(legend, /Workflow stage: To Do → In Progress → In Review → Done → To Do/);
  assert.match(legend, /Urgency, highest to lowest: Highest, High, Medium, Low, Lowest/);
  assert.match(legend, /same text appears in board columns and list badges/i);
  assert.match(legend, /selected priority is always shown as text/i);
});

test("indicator legend is labelled and shared by list and board views", async () => {
  const legend = await readFile(new URL("JiraBoardLegend.vue", componentRoot), "utf8");
  const workspace = await readFile(new URL("JiraWorkspace.vue", componentRoot), "utf8");

  assert.match(legend, /<aside[^>]+aria-labelledby="board-legend-title"/);
  assert.match(legend, /<h2 id="board-legend-title">/);

  const legendPosition = workspace.indexOf("<JiraBoardLegend />");
  const listPosition = workspace.indexOf("<JiraIssueList");
  const boardPosition = workspace.indexOf("<JiraIssueBoard");
  assert.ok(legendPosition >= 0, "workspace renders the indicator legend");
  assert.ok(legendPosition < listPosition, "legend is outside and before the list view");
  assert.ok(legendPosition < boardPosition, "legend is outside and before the board view");
});
