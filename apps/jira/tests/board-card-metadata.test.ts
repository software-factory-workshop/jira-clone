import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentUrl = new URL("../app/components/JiraIssueBoard.vue", import.meta.url);
const stylesUrl = new URL("../app/assets/css/main.css", import.meta.url);

test("every board card exposes labelled type, priority, and assignee metadata", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(source, /v-for="issue in issuesForColumn\(column\)"[\s\S]*?<dl class="issue-metadata"/);
  assert.match(source, /<dt>Type<\/dt>[\s\S]*?\{\{ issue\.type \}\}/);
  assert.match(source, /<dt>Priority<\/dt>[\s\S]*?\{\{ issue\.priority \}\}/);
  assert.match(source, /<dt>Assignee<\/dt>[\s\S]*?\{\{ issue\.assignee \}\}/);
  assert.match(source, /<UIcon[\s\S]*?aria-hidden="true"[\s\S]*?<span>\{\{ issue\.type \}\}<\/span>/);
});

test("board card metadata and long summaries wrap within narrow cards", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.issue-card \{[\s\S]*?min-width: 0;/);
  assert.match(styles, /\.issue-card strong \{[\s\S]*?overflow-wrap: anywhere;/);
  assert.match(styles, /\.issue-metadata \{[\s\S]*?flex-wrap: wrap;/);
  assert.match(styles, /\.metadata-item \{[\s\S]*?flex: 1 1 70px;/);
  assert.match(styles, /\.metadata-item dd \{[\s\S]*?overflow-wrap: anywhere;/);
});
