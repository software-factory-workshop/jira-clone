import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "../app/utils/report.ts";

test("model reports cannot inject HTML, script links or remote images", () => {
  const html = renderReport('<script>alert(1)</script>\n\n<img src="https://example.com/track">\n\n[click](javascript:alert(1))\n\n![track](https://example.com/track)');
  assert(!html.includes("<script"));
  assert(!html.includes("<img"));
  assert(!html.includes('href="javascript:'));
  assert(html.includes("&lt;script&gt;"));
  assert(renderReport("## A useful task\n\n- Evidence").includes("<h2>A useful task</h2>"));
});
