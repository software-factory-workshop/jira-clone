import test from "node:test";
import assert from "node:assert/strict";
import { reconcileManuallyMergedDelivery } from "../app/utils/delivery-reconcile.ts";

const head = "a".repeat(40);
const base = "b".repeat(40);
const commit = "d".repeat(40);

function saved(overrides: Record<string, unknown> = {}) {
  return {
    phase: "human_review",
    publication: {
      number: 35, url: "https://github.com/software-factory-workshop/jira-clone/pull/35",
      headSha: head, targetHeadSha: base, targetBranch: "main",
      ownerSessionId: "wrun_owner", branch: "factory/work-owner",
    },
    review: {
      headSha: head, baseSha: base, targetBranch: "main",
      verdict: "incomplete", summary: "Browser evidence incomplete but nonblocking.",
      findings: [], limitations: ["Required host evidence missing: exercise the changed UI in a real browser."],
    },
    mergeReview: {
      headSha: head, baseSha: base, targetBranch: "main",
      verdict: "incomplete", findings: [], limitations: ["Required host evidence missing: exercise the changed UI in a real browser."],
    },
    reviewerSessionId: "wrun_reviewer",
    mergeDecision: { status: "manual", reason: "PR or target changed since the independent review." },
    ...overrides,
  };
}

function pr(overrides: Record<string, unknown> = {}) {
  return { number: 35, merged: true, state: "closed", headSha: head, targetBranch: "main", commitSha: commit, ...overrides };
}

test("a manually merged reviewed candidate reconciles with preserved review evidence", () => {
  const result = reconcileManuallyMergedDelivery(saved(), pr());
  assert.equal(result.eligible, true);
  assert.match(result.reason, /PR #35/);
  assert.match(result.reason, /preserved/);
  assert.equal(result.commitSha, commit);
});

test("already-merged deliveries stay merged without GitHub evidence", () => {
  const result = reconcileManuallyMergedDelivery(saved({ phase: "merged" }), undefined);
  assert.equal(result.eligible, true);
  assert.match(result.reason, /already/);
});

test("active, cancelled and needs-revision deliveries never reconcile", () => {
  for (const phase of ["working", "reviewing", "merging", "ready", "blocked", "cancelled", "needs_revision"]) {
    const input = saved({ phase });
    const result = reconcileManuallyMergedDelivery(input, pr());
    // ready and blocked are stopped and may reconcile when the independent
    // review is complete; the other phases must stay untouched.
    if (phase === "ready" || phase === "blocked") assert.equal(result.eligible, true, phase);
    else assert.equal(result.eligible, false, phase);
  }
});

test("missing publication, review binding, or independence fails closed", () => {
  assert.equal(reconcileManuallyMergedDelivery(saved({ publication: undefined }), pr()).eligible, false);
  assert.equal(reconcileManuallyMergedDelivery(saved({ publication: { ...saved().publication, branch: "" } }), pr()).eligible, false);
  assert.equal(reconcileManuallyMergedDelivery(saved({ review: undefined }), pr()).eligible, false);
  assert.equal(reconcileManuallyMergedDelivery(saved({ review: { ...saved().review, headSha: "c".repeat(40) } }), pr()).eligible, false);
  assert.equal(reconcileManuallyMergedDelivery(saved({ reviewerSessionId: "wrun_owner" }), pr()).eligible, false);
  assert.equal(reconcileManuallyMergedDelivery(saved({ review: { ...saved().review, verdict: "changes_requested" } }), pr()).eligible, false);
  assert.equal(reconcileManuallyMergedDelivery(saved({ review: { ...saved().review, findings: [{ severity: "blocking" }] } }), pr()).eligible, false);
  assert.equal(reconcileManuallyMergedDelivery(saved({ mergeReview: { ...saved().mergeReview, headSha: "c".repeat(40) } }), pr()).eligible, false);
});

test("closed-but-unmerged, wrong-number, changed-head and retargeted PRs fail closed", () => {
  assert.match(reconcileManuallyMergedDelivery(saved(), pr({ merged: false, state: "closed" })).reason, /not merged/);
  assert.match(reconcileManuallyMergedDelivery(saved(), pr({ merged: false, state: "open" })).reason, /not merged/);
  assert.match(reconcileManuallyMergedDelivery(saved(), pr({ number: 36 })).reason, /PR number/);
  assert.match(reconcileManuallyMergedDelivery(saved(), pr({ headSha: "c".repeat(40) })).reason, /candidate head/);
  assert.match(reconcileManuallyMergedDelivery(saved(), pr({ targetBranch: "other" })).reason, /retargeted/);
  assert.equal(reconcileManuallyMergedDelivery(saved(), undefined).eligible, false);
  assert.equal(reconcileManuallyMergedDelivery(saved(), null).eligible, false);
});

test("child-PR targets reconcile against their own recorded branch", () => {
  const child = saved({
    publication: { ...saved().publication, targetBranch: "factory/work-parent" },
    review: { ...saved().review, targetBranch: "factory/work-parent", baseSha: base },
    mergeReview: { ...saved().mergeReview, targetBranch: "factory/work-parent", baseSha: base },
  });
  const result = reconcileManuallyMergedDelivery(child, pr({ targetBranch: "factory/work-parent" }));
  assert.equal(result.eligible, true);
  assert.match(result.reason, /factory\/work-parent/);
});

test("malformed inputs never throw and never mark merged", () => {
  assert.equal(reconcileManuallyMergedDelivery(null, pr()).eligible, false);
  assert.equal(reconcileManuallyMergedDelivery(undefined, pr()).eligible, false);
  assert.equal(reconcileManuallyMergedDelivery({} as never, pr()).eligible, false);
  assert.equal(reconcileManuallyMergedDelivery(saved(), { ...pr(), headSha: "short" }).eligible, false);
  // Invalid commit SHAs are ignored rather than failing the merge evidence.
  const result = reconcileManuallyMergedDelivery(saved(), pr({ commitSha: "short" }));
  assert.equal(result.eligible, true);
  assert.equal(result.commitSha, undefined);
});
