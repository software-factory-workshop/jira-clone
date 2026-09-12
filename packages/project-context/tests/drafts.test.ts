import test from "node:test";
import assert from "node:assert/strict";
import { parseDrafts } from "../src/index.ts";
test("keeps valid drafts and rejects malformed browser storage", () => {
  const valid = {
    id: "draft-1",
    title: "Request",
    request: "Inspect KAN",
    updatedAt: "2026-09-12T12:00:00Z",
  };
  assert.deepEqual(
    parseDrafts([
      null,
      valid,
      { ...valid, request: 1 },
      { ...valid, updatedAt: "invalid" },
    ]),
    [valid],
  );
  assert.deepEqual(parseDrafts({ draft: valid }), []);
});
