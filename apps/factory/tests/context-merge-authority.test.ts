import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const documents = [new URL("../../../factory/CONTRACT.md", import.meta.url)];

test("factory context keeps station and host merge authority distinct", async () => {
  const text = (await Promise.all(documents.map((document) => readFile(document, "utf8")))).join("\n");

  assert.match(text, /Stations? (?:cannot|have no) (?:merge PRs or activate factory policy|merge or factory-policy activation capability)/);
  assert.match(text, /host delivery driver (?:may perform|can merge) only (?:the documented )?narrow(?:ly defined)? low-risk/);
  assert.match(text, /broad or elevated merges remain human-controlled/);
  assert.doesNotMatch(text, /No station merges PRs or activates factory policy\./);
});
