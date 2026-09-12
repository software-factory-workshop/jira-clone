import test from "node:test";
import assert from "node:assert/strict";
import { describeDeliveryPhase, formatDeliveryUpdatedAt, isLoopRun, summarizeDelivery } from "../app/utils/delivery-summary.ts";

const now = new Date("2026-09-12T12:00:00.000Z");

test("delivery phases map to readable labels and badge colors", () => {
  assert.deepEqual(describeDeliveryPhase("reviewing"), { label: "Reviewing", color: "primary" });
  assert.deepEqual(describeDeliveryPhase("human_review"), { label: "Needs human review", color: "warning" });
  assert.deepEqual(describeDeliveryPhase("blocked"), { label: "Blocked", color: "error" });
  assert.deepEqual(describeDeliveryPhase("merged"), { label: "Merged", color: "success" });
  assert.deepEqual(describeDeliveryPhase("future_phase"), { label: "future_phase", color: "neutral" });
});

test("delivery update times stay readable when data is missing", () => {
  assert.equal(formatDeliveryUpdatedAt(new Date(now.getTime() - 30_000).toISOString(), now), "Updated just now");
  assert.equal(formatDeliveryUpdatedAt(new Date(now.getTime() - 5 * 60_000).toISOString(), now), "Updated 5 min ago");
  assert.equal(formatDeliveryUpdatedAt(new Date(now.getTime() - 3 * 3_600_000).toISOString(), now), "Updated 3 hr ago");
  assert.equal(formatDeliveryUpdatedAt(undefined, now), "Last update unavailable");
  assert.equal(formatDeliveryUpdatedAt("not-a-date", now), "Last update unavailable");
});

test("a saved delivery projects a compact card with title, phase, target and PR link", () => {
  const summary = summarizeDelivery({
    id: "delivery-one",
    phase: "reviewing",
    updatedAt: new Date(now.getTime() - 2 * 60_000).toISOString(),
    request: { title: "Jira issue list" },
    publication: { number: 4, url: "https://github.com/software-factory-workshop/jira-clone/pull/4", targetBranch: "main" },
  }, "Fallback title", now);
  assert.equal(summary?.title, "Jira issue list");
  assert.equal(summary?.phaseLabel, "Reviewing");
  assert.equal(summary?.updatedLabel, "Updated 2 min ago");
  assert.equal(summary?.targetBranch, "main");
  assert.equal(summary?.prNumber, 4);
  assert.equal(summary?.prUrl, "https://github.com/software-factory-workshop/jira-clone/pull/4");
});

test("unpublished deliveries fall back to the history title without a PR link", () => {
  const summary = summarizeDelivery({ id: "delivery-two", phase: "working", request: { title: "" } }, "History label", now);
  assert.equal(summary?.title, "History label");
  assert.equal(summary?.prNumber, undefined);
  assert.equal(summary?.targetBranch, undefined);
  assert.equal(summarizeDelivery({ id: "", phase: "working" }), undefined);
  assert.equal(summarizeDelivery(null), undefined);
});

test("insecure publication links are never rendered as PR links", () => {
  const summary = summarizeDelivery({ id: "delivery-three", phase: "ready", publication: { number: 4, url: "javascript:alert(1)" } });
  assert.equal(summary?.prNumber, undefined);
  assert.equal(summary?.prUrl, undefined);
});

test("only loop history rows request delivery state", () => {
  assert.equal(isLoopRun({ id: "one", value: { station: "loop" } }), true);
  assert.equal(isLoopRun({ id: "one", value: { station: "worker" } }), false);
  assert.equal(isLoopRun(null), false);
});
