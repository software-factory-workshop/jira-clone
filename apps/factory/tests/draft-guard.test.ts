import test from "node:test";
import assert from "node:assert/strict";
import {
  applySaveReceipt,
  cleanSnapshot,
  destinationLabel,
  emptySnapshot,
  isDraftDirty,
} from "../app/utils/draft-guard.ts";

test("whitespace alone never marks the editor dirty", () => {
  const snapshot = cleanSnapshot("one", 1, { title: "Title", request: "Body" });
  assert.equal(isDraftDirty({ title: "  Title  ", request: "Body\n" }, snapshot), false);
});

test("title or request edits mark the editor unsaved until saved", () => {
  const snapshot = emptySnapshot();
  assert.equal(isDraftDirty({ title: "", request: "" }, snapshot), false);
  assert.equal(isDraftDirty({ title: "New", request: "" }, snapshot), true);
  assert.equal(isDraftDirty({ title: "", request: "Work" }, snapshot), true);
  const saved = cleanSnapshot(null, 0, { title: "New", request: "Work" });
  assert.equal(isDraftDirty({ title: "New", request: "Work" }, saved), false);
});

test("switching destinations keeps exact text until the choice resolves", () => {
  assert.equal(destinationLabel({ kind: "new" }), "a new draft");
  assert.match(
    destinationLabel({ kind: "draft", draft: { id: "one", title: "Saved", request: "Body" } }),
    /Saved/,
  );
  assert.equal(
    destinationLabel({ kind: "proposal", value: { title: "Proposal", body: "Body" } }),
    "the proposal draft",
  );
});

test("a delayed save receipt cannot claim an editor that moved on", () => {
  const moved = applySaveReceipt({ activeId: "other", activeVersion: 3 }, "one", { id: "one", version: 2 });
  assert.equal(moved.applied, false);
  assert.equal(moved.activeId, "other");
  assert.equal(moved.activeVersion, 3);
  const same = applySaveReceipt({ activeId: "one", activeVersion: 1 }, "one", { id: "one", version: 2 });
  assert.equal(same.applied, true);
  assert.equal(same.activeId, "one");
  assert.equal(same.activeVersion, 2);
});

test("a new-draft save receipt adopts the confirmed identity", () => {
  const created = applySaveReceipt({ activeId: null, activeVersion: 0 }, null, { id: "fresh", version: 1 });
  assert.equal(created.applied, true);
  assert.equal(created.activeId, "fresh");
  assert.equal(created.activeVersion, 1);
});
