import assert from "node:assert/strict";
import test from "node:test";
import { parseMarkdown } from "@comark/vue/parse";
import { markdownOptions, markdownPlugins } from "../app/utils/markdown.ts";

function collectTags(nodes: unknown[], tags: string[] = []): string[] {
  for (const node of nodes) {
    if (!Array.isArray(node)) continue;
    const [tag, , ...children] = node;
    if (typeof tag !== "string") continue;
    tags.push(tag);
    collectTags(children, tags);
  }
  return tags;
}

function collectLinks(nodes: unknown[], links: unknown[] = []): unknown[] {
  for (const node of nodes) {
    if (!Array.isArray(node)) continue;
    const [tag, attributes, ...children] = node;
    if (tag === "a") links.push(attributes);
    if (typeof tag === "string") collectLinks(children, links);
  }
  return links;
}

test("Jira Markdown rendering keeps formatting and rejects unsafe content", async () => {
  const document = await parseMarkdown(
    [
      "# Issue details",
      "",
      "**bold** and [safe link](https://example.com)",
      "",
      "![tracking image](https://example.com/pixel)",
      "",
      "<script>alert(1)</script>",
      "",
      "[unsafe link](javascript:alert(1))",
    ].join("\n"),
    { ...markdownOptions, plugins: markdownPlugins },
  );
  const tags = collectTags(document.nodes);

  assert(tags.includes("h1"));
  assert(tags.includes("strong"));
  assert(tags.includes("a"));
  assert(!tags.includes("img"));
  assert(!tags.includes("script"));
  assert.match(JSON.stringify(document.nodes), /<script>alert\(1\)<\/script>/);
  assert.deepEqual(collectLinks(document.nodes), [{ href: "https://example.com" }]);
});
