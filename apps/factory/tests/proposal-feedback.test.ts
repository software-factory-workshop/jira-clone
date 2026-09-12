import test from "node:test";
import assert from "node:assert/strict";
import {
  clearFeedbackEntry,
  feedbackKeyFor,
  loadFeedback,
  readFeedbackMap,
  setFeedbackEntry,
  storeFeedback,
  proposalFeedbackStorageKey,
} from "../app/utils/proposal-feedback.ts";

const verdict = { verdict: "useful", reason: "It names the gap" } as const;

test("two proposal IDs receive different judgments; changing one leaves the other unchanged", () => {
  let entries = setFeedbackEntry({}, "wrun_a:proposal:1", verdict);
  entries = setFeedbackEntry(entries, "wrun_a:proposal:2", { verdict: "not-useful", reason: "Duplicates existing work" });
  assert.equal(entries["wrun_a:proposal:1"]?.verdict, "useful");
  assert.equal(entries["wrun_a:proposal:2"]?.verdict, "not-useful");
  entries = setFeedbackEntry(entries, "wrun_a:proposal:1", { verdict: "not-useful", reason: "Changed my mind" });
  assert.equal(entries["wrun_a:proposal:1"]?.verdict, "not-useful");
  assert.equal(entries["wrun_a:proposal:1"]?.reason, "Changed my mind");
  assert.equal(entries["wrun_a:proposal:2"]?.verdict, "not-useful");
  assert.equal(entries["wrun_a:proposal:2"]?.reason, "Duplicates existing work");
});

test("reload restores feedback for the same proposal; clearing removes only that entry", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
  let entries = setFeedbackEntry({}, "wrun_a:proposal:1", verdict);
  entries = setFeedbackEntry(entries, "wrun_a:proposal:2", { verdict: "not-useful", reason: "Too broad" });
  assert.equal(storeFeedback(storage, entries).unavailable, false);
  // Simulate a reload: re-read the raw stored value with no in-memory state.
  const reloaded = loadFeedback(storage);
  assert.equal(reloaded.unavailable, false);
  assert.equal(reloaded.malformed, false);
  assert.equal(reloaded.entries["wrun_a:proposal:1"]?.verdict, "useful");
  assert.equal(reloaded.entries["wrun_a:proposal:1"]?.reason, "It names the gap");
  const afterClear = clearFeedbackEntry(reloaded.entries, "wrun_a:proposal:1");
  assert.equal(afterClear["wrun_a:proposal:1"], undefined);
  assert.equal(afterClear["wrun_a:proposal:2"]?.verdict, "not-useful");
});

test("malformed or unavailable storage degrades gracefully", () => {
  assert.deepEqual(readFeedbackMap("{not-json"), { entries: {}, malformed: true });
  assert.deepEqual(readFeedbackMap("[]"), { entries: {}, malformed: true });
  const mixed = readFeedbackMap({ good: { verdict: "useful", reason: "", updatedAt: "2026-09-12T00:00:00.000Z" }, bad: { verdict: "maybe", reason: "" } });
  assert.equal(mixed.malformed, true);
  assert.equal(mixed.entries.good?.verdict, "useful");
  assert.equal(mixed.entries.bad, undefined);
  assert.deepEqual(readFeedbackMap(null), { entries: {}, malformed: false });
  const throwing = { getItem: () => { throw new Error("denied"); } };
  assert.equal(loadFeedback(throwing).unavailable, true);
  const rejecting = { getItem: () => null, setItem: () => { throw new Error("denied"); } };
  assert.equal(storeFeedback(rejecting, {}).unavailable, true);
});

test("legacy findings without a host-assigned proposal ID never share feedback", () => {
  assert.equal(feedbackKeyFor(undefined), undefined);
  assert.equal(feedbackKeyFor(""), undefined);
  assert.equal(feedbackKeyFor("   "), undefined);
  assert.equal(feedbackKeyFor("wrun_host:proposal:2"), "wrun_host:proposal:2");
  assert.equal(proposalFeedbackStorageKey, "adeo-factory-proposal-feedback-v1");
});

test("reasons are trimmed, bounded and editable without touching the verdict", () => {
  const entries = setFeedbackEntry({}, "wrun_a:proposal:1", verdict);
  const long = setFeedbackEntry(entries, "wrun_a:proposal:1", { verdict: "useful", reason: `  ${"r".repeat(600)}  ` });
  assert.equal(long["wrun_a:proposal:1"]?.reason.length, 500);
  assert.equal(long["wrun_a:proposal:1"]?.verdict, "useful");
  assert.ok(long["wrun_a:proposal:1"]?.updatedAt);
});
