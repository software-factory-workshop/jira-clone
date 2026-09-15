import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const components = ["JiraIssueList.vue", "JiraIssueBoard.vue"] as const;

test("list rows and board cards show issue type text beside a decorative icon", async () => {
  const root = new URL("../app/components/", import.meta.url);

  for (const component of components) {
    const source = await readFile(new URL(component, root), "utf8");
    assert.match(
      source,
      /<span class="issue-type[^"]*">[\s\S]*?<UIcon[\s\S]*?aria-hidden="true"[\s\S]*?<span>\{\{ issue\.type \}\}<\/span>/,
      `${component} renders a visible type label and hides its redundant icon from assistive technology`,
    );
  }
});

test("both issue views preserve distinct Story, Task, and Bug icon mappings", async () => {
  const root = new URL("../app/components/", import.meta.url);

  for (const component of components) {
    const source = await readFile(new URL(component, root), "utf8");
    assert.match(source, /type === "Bug"/);
    assert.match(source, /type === "Story"/);
    assert.match(source, /i-lucide-square-check/);
  }
});
