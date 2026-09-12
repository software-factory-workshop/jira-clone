import test from "node:test";
import assert from "node:assert/strict";
import {
  clearFeedbackEntry,
  feedbackKeyFor,
  loadFeedback,
  readFeedbackMap,
  setFeedbackEntry,
  storeFeedback,
  storageProblemFor,
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

test("storage warnings map cleanly from load results so recovery clears them", () => {
  assert.equal(storageProblemFor({ malformed: true, unavailable: false }), "malformed");
  assert.equal(storageProblemFor({ malformed: false, unavailable: true }), "unavailable");
  // Error-to-success: a clean load after either failure clears the warning.
  assert.equal(storageProblemFor({ malformed: false, unavailable: false }), "");
});

test("malformed storage recovers through a successful save that overwrites the bad entry", () => {
  let raw: string | null = "{not-json";
  const storage = {
    getItem: (_key: string) => raw,
    setItem: (_key: string, value: string) => { raw = value; },
  };
  const before = loadFeedback(storage);
  assert.equal(before.malformed, true);
  assert.equal(storageProblemFor(before), "malformed");
  const entries = setFeedbackEntry(before.entries, "wrun_a:proposal:1", verdict);
  assert.equal(storeFeedback(storage, entries).unavailable, false);
  const after = loadFeedback(storage);
  assert.equal(after.malformed, false);
  assert.equal(after.unavailable, false);
  assert.equal(storageProblemFor(after), "");
  assert.equal(after.entries["wrun_a:proposal:1"]?.verdict, "useful");
});

test("unavailable storage warning clears after a later load succeeds", () => {
  let broken = true;
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => {
      if (broken) throw new Error("denied");
      return store.get(key) ?? null;
    },
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
  const before = loadFeedback(storage);
  assert.equal(before.unavailable, true);
  assert.equal(storageProblemFor(before), "unavailable");
  broken = false;
  const after = loadFeedback(storage);
  assert.equal(after.unavailable, false);
  assert.equal(storageProblemFor(after), "");
});

test("a storage failure after a success shows a problem again without losing verdicts", () => {
  let broken = false;
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => {
      if (broken) throw new Error("denied");
      return store.get(key) ?? null;
    },
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
  // Success first: verdict and reason round-trip through storage.
  const saved = setFeedbackEntry({}, "wrun_a:proposal:1", verdict);
  assert.equal(storeFeedback(storage, saved).unavailable, false);
  let loaded = loadFeedback(storage);
  assert.equal(storageProblemFor(loaded), "");
  assert.equal(loaded.entries["wrun_a:proposal:1"]?.reason, "It names the gap");
  // Later failure: the loader reports a truthful problem again, and the
  // previously saved entry survives (component keeps last-known marks).
  broken = true;
  loaded = loadFeedback(storage);
  assert.equal(storageProblemFor(loaded), "unavailable");
  assert.equal(loaded.entries["wrun_a:proposal:1"], undefined);
  assert.equal(saved["wrun_a:proposal:1"]?.verdict, "useful");
  assert.equal(saved["wrun_a:proposal:1"]?.reason, "It names the gap");
  // A failed save reports unavailability without clobbering stored marks.
  const failedSave = storeFeedback(
    { getItem: storage.getItem, setItem: () => { throw new Error("denied"); } },
    setFeedbackEntry(saved, "wrun_a:proposal:2", { verdict: "not-useful", reason: "Too broad" }),
  );
  assert.equal(failedSave.unavailable, true);
  broken = false;
  const recovered = loadFeedback(storage);
  assert.equal(storageProblemFor(recovered), "");
  assert.equal(recovered.entries["wrun_a:proposal:1"]?.verdict, "useful");
  assert.equal(recovered.entries["wrun_a:proposal:1"]?.reason, "It names the gap");
});
