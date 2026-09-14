import test from "node:test";
import assert from "node:assert/strict";
import { attentionPhases, deriveAttentionReason, describeDeliveryPhase, formatDeliveryUpdatedAt, isLoopRun, summarizeDelivery, summarizeDeliveryStatus } from "../app/utils/delivery-summary.ts";
import { factoryRepositoryUrl } from "../runtime/lib/factory-config.ts";

const now = new Date("2026-09-12T12:00:00.000Z");

test("delivery phases map to readable labels and badge colors", () => {
  assert.deepEqual(describeDeliveryPhase("reviewing"), { label: "Reviewing", color: "primary" });
  assert.deepEqual(describeDeliveryPhase("human_review"), { label: "Needs human review", color: "warning" });
  assert.deepEqual(describeDeliveryPhase("awaiting_input"), { label: "Waiting for you", color: "warning" });
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
    publication: { number: 4, url: `${factoryRepositoryUrl}/pull/4`, targetBranch: "main" },
  }, "Fallback title", now);
  assert.equal(summary?.title, "Jira issue list");
  assert.equal(summary?.phaseLabel, "Reviewing");
  assert.equal(summary?.updatedLabel, "Updated 2 min ago");
  assert.equal(summary?.targetBranch, "main");
  assert.equal(summary?.prNumber, 4);
  assert.equal(summary?.prUrl, `${factoryRepositoryUrl}/pull/4`);
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

test("attention reasons prefer errors, then review summaries, then merge reasons", () => {
  assert.equal(
    deriveAttentionReason({ error: "Worker failed", review: { summary: "Review notes" }, mergeDecision: { reason: "Merge note" } }),
    "Worker failed",
  );
  assert.equal(deriveAttentionReason({ review: { summary: "  Review  notes\nwith spacing " } }), "Review notes with spacing");
  assert.equal(deriveAttentionReason({ mergeDecision: { reason: "Needs an owner" } }), "Needs an owner");
  assert.equal(deriveAttentionReason({ error: "   ", review: { summary: "" } }), undefined);
  assert.equal(deriveAttentionReason({}), undefined);
});

test("long attention reasons are safely bounded", () => {
  const reason = deriveAttentionReason({ error: `${"a".repeat(250)} end` });
  assert.ok(reason);
  assert.ok(reason.length <= 180);
  assert.ok(reason.endsWith("\u2026"));
});

test("timed-out observations keep the exact error and direct to resume", () => {
  const reason = deriveAttentionReason({ error: "Session observation timed out; no partial result accepted." });
  assert.ok(reason?.startsWith("Session observation timed out; no partial result accepted."));
  assert.ok(reason?.includes("resume the blocked delivery"));
  assert.ok(!reason?.includes("retry advance"));
  assert.ok(reason && reason.length <= 1500);
  assert.equal(deriveAttentionReason({ error: "Worker failed" }), "Worker failed");
});

test("the long observation bound applies to the error path only", () => {
  const longReview = `Review notes ${"no partial result accepted ".repeat(20)}end`;
  assert.ok(longReview.length > 180);
  const reason = deriveAttentionReason({ review: { summary: longReview } });
  assert.ok(reason);
  assert.ok(reason.length <= 180);
  assert.ok(reason.endsWith("\u2026"));
});

test("terminal attention cards keep a bounded reason while active cards do not need a line", () => {
  const blocked = summarizeDelivery({ id: "delivery-blocked", phase: "blocked", error: "Delivery is blocked", failure: { kind: "provider", retryable: true } }, "History label", now);
  assert.equal(blocked?.phaseLabel, "Blocked");
  assert.equal(blocked?.attentionReason, "Delivery is blocked");
  assert.equal(blocked?.failureKind, "provider");
  assert.equal(blocked?.failureRetryable, true);
  assert.equal(attentionPhases.has(blocked?.phase ?? ""), true);
  const reviewing = summarizeDelivery({ id: "delivery-reviewing", phase: "reviewing", error: "Delivery is blocked" }, "History label", now);
  assert.equal(reviewing?.attentionReason, "Delivery is blocked");
  assert.equal(attentionPhases.has(reviewing?.phase ?? ""), false);
});

test("waiting deliveries expose the unanswered owner question", () => {
  const summary = summarizeDelivery({
    id: "delivery-question",
    phase: "awaiting_input",
    questions: [
      { question: "Which project should receive the issue?", operationId: "operation-one", sessionId: "wrun-owner", askedAt: now.toISOString() },
      { question: "This answer is already recorded", operationId: "operation-two", sessionId: "wrun-owner", askedAt: now.toISOString(), answer: "ADEO", answeredBy: "owner" },
    ],
  }, "History label", now);
  assert.equal(summary?.phaseLabel, "Waiting for you");
  assert.equal(summary?.question, "Which project should receive the issue?");
  assert.equal(summary?.attentionReason, "Which project should receive the issue?");
  assert.equal(attentionPhases.has("awaiting_input"), true);
});

test("delivery summaries retain positive model usage without rendering zeroes", () => {
  const summary = summarizeDelivery({ id: "delivery-usage", phase: "reviewing", usage: { inputTokens: 1200, outputTokens: 300, usd: 0.125 } });
  assert.equal(summary?.usageLabel, "1,200 in · 300 out · $0.125");
  assert.equal(summarizeDelivery({ id: "delivery-zero", phase: "reviewing", usage: { inputTokens: 0, outputTokens: 0, usd: 0 } })?.usageLabel, undefined);
});

test("delivery status summary surfaces the latest result, blocker and next action", () => {
  const summary = summarizeDeliveryStatus({
    id: "delivery-summary",
    phase: "human_review",
    publication: { number: 7, url: "https://github.com/software-factory-workshop/jira-clone/pull/7" },
    review: { verdict: "incomplete", summary: "Hosted browser evidence is missing.", limitations: ["Preview was access protected."] },
    history: [{ phase: "reviewing", to: "human_review" }],
  });
  assert.deepEqual(summary, {
    phaseLabel: "Needs human review",
    phaseColor: "warning",
    latestResult: "Independent review · incomplete: Hosted browser evidence is missing.",
    blocker: "The review has limitations, so the host keeps merge gated.",
    nextAction: "Review the exact PR, then merge it or request a revision.",
  });
});

test("blocked status directs retryable failures back to the same delivery", () => {
  const summary = summarizeDeliveryStatus({
    id: "delivery-blocked",
    phase: "blocked",
    error: "Observation timed out.",
    failure: { kind: "observation", retryable: true },
  });
  assert.equal(summary?.blocker, "Observation timed out.");
  assert.equal(summary?.nextAction, "Retry the blocked phase, then inspect the same run if it remains blocked.");
});

test("owner questions take priority over generic waiting copy", () => {
  const summary = summarizeDeliveryStatus({
    id: "delivery-question",
    phase: "awaiting_input",
    questions: [{ question: "Which target should receive this change?" }],
  });
  assert.equal(summary?.blocker, "Which target should receive this change?");
  assert.equal(summary?.nextAction, "Answer the worker's question to continue.");
});
