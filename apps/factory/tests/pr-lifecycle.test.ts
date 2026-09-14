import assert from "node:assert/strict";
import test from "node:test";
import { factoryRepository, requiredCheckName } from "../runtime/lib/factory-config.ts";
import { inspectMergeCandidate, markPullRequestReady, readGithubPullSnapshot, snapshotIsMergedCandidate, summarizeGithubChecks, type PullPublicationBinding } from "../runtime/lib/pr-lifecycle.ts";
import type { MergeReview } from "../runtime/lib/merge-policy.ts";

const head = "a".repeat(40);
const base = "b".repeat(40);
const advanced = "c".repeat(40);
const mergeCommit = "d".repeat(40);
const publication: PullPublicationBinding & { ownerSessionId: string } = {
  number: 7,
  url: `https://github.com/${factoryRepository}/pull/7`,
  headSha: head,
  targetHeadSha: base,
  targetBranch: "main",
  ownerSessionId: "worker-session",
};
const review: MergeReview = {
  headSha: head,
  baseSha: base,
  targetBranch: "main",
  verdict: "approve",
  findings: [],
  limitations: [],
  verification: { prepared: true, repositoryChecksPassed: true, candidateUnchanged: true },
};
const file = {
  filename: "apps/jira/app/assets/colors.css",
  status: "modified",
  patch: "@@ -1 +1 @@\n-color: red;\n+color: blue;",
};

function providerState() {
  return {
    draft: false,
    merged: false,
    state: "open",
    targetHead: base,
    head: head,
    requiredStatus: "completed",
    requiredConclusion: "success",
    files: [file],
    patchCalls: 0,
  };
}

function installProvider(state: ReturnType<typeof providerState>) {
  const prior = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const path = String(url);
    if (path.includes("/files?")) return Response.json(state.files);
    if (path.includes("/check-runs?")) {
      return Response.json({
        total_count: 1,
        check_runs: [{ name: requiredCheckName, app: { slug: "github-actions" }, status: state.requiredStatus, conclusion: state.requiredStatus === "completed" ? state.requiredConclusion : null }],
      });
    }
    if (path.includes("/status?")) return Response.json({ total_count: 0, statuses: [] });
    if (path.includes("/git/ref/heads/")) return Response.json({ object: { sha: state.targetHead } });
    if (path.endsWith("/pulls/7") && init?.method === "PATCH") {
      state.patchCalls++;
      state.draft = JSON.parse(String(init.body)).draft;
      return Response.json({});
    }
    if (path.endsWith("/pulls/7")) {
      return Response.json({
        number: 7,
        html_url: publication.url,
        title: "Cosmetic change",
        body: null,
        state: state.state,
        merged: state.merged,
        merge_commit_sha: state.merged ? mergeCommit : null,
        head: { sha: state.head, ref: "factory/work-owner", repo: { full_name: factoryRepository } },
        base: { sha: base, ref: "main", repo: { full_name: factoryRepository } },
        changed_files: state.files.length,
        draft: state.draft,
        mergeable: state.merged ? null : true,
        mergeable_state: state.merged ? "unknown" : "clean",
      });
    }
    throw new Error(`Unexpected GitHub request: ${path}`);
  };
  return () => { globalThis.fetch = prior; };
}

test("check summaries name required, failed and pending GitHub evidence", () => {
  const failed = summarizeGithubChecks(
    { total_count: 1, check_runs: [{ name: requiredCheckName, status: "completed", conclusion: "neutral", app: { slug: "github-actions" } }] },
    { total_count: 0, statuses: [] },
  );
  assert.equal(failed.status, "failed");
  assert.ok(failed.blockers.some((blocker) => blocker.includes(`Required check "${requiredCheckName}"`)));

  const pending = summarizeGithubChecks(
    { total_count: 1, check_runs: [{ name: requiredCheckName, status: "in_progress", conclusion: null, app: { slug: "github-actions" } }] },
    { total_count: 0, statuses: [] },
  );
  assert.equal(pending.status, "pending");
  assert.ok(pending.pending.includes(requiredCheckName));
});

test("Draft is a specific blocker and never becomes ready during merge inspection", async () => {
  const state = providerState();
  state.draft = true;
  const restore = installProvider(state);
  try {
    const result = await inspectMergeCandidate("token", publication, review, "reviewer-session");
    assert.equal(result.decision.status, "manual");
    assert.match(result.decision.reason, /still Draft/);
    assert.equal(state.patchCalls, 0);
  } finally {
    restore();
  }
});

test("the merge operation never promotes a Draft PR implicitly", async () => {
  const state = providerState();
  state.draft = true;
  const restore = installProvider(state);
  try {
    const { mergeReviewed } = await import("../runtime/lib/merge-reviewed.ts");
    const result = await mergeReviewed({ publication, review, reviewerSessionId: "reviewer-session" }, "token");
    assert.equal(result.status, "manual");
    assert.match(result.reason, /mark it ready/i);
    assert.equal(state.patchCalls, 0);
  } finally {
    restore();
  }
});

test("ready candidate waits on named checks and becomes eligible only at the exact head", async () => {
  const state = providerState();
  state.requiredStatus = "in_progress";
  const restore = installProvider(state);
  try {
    const waiting = await inspectMergeCandidate("token", publication, review, "reviewer-session");
    assert.equal(waiting.decision.status, "waiting");
    assert.match(waiting.decision.reason, new RegExp(requiredCheckName));

    state.requiredStatus = "completed";
    const eligible = await inspectMergeCandidate("token", publication, review, "reviewer-session");
    assert.equal(eligible.decision.status, "eligible");
    assert.equal(eligible.decision.checkedHeadSha, head);
  } finally {
    restore();
  }
});

test("target and candidate drift produce a manual decision instead of a merge", async () => {
  const state = providerState();
  state.targetHead = advanced;
  const restore = installProvider(state);
  try {
    const result = await inspectMergeCandidate("token", publication, review, "reviewer-session");
    assert.equal(result.decision.status, "manual");
    assert.match(result.decision.reason, /target branch advanced/i);
  } finally {
    restore();
  }
});

test("mark ready re-reads GitHub before reporting success", async () => {
  const state = providerState();
  state.draft = true;
  const restore = installProvider(state);
  try {
    const result = await markPullRequestReady("token", publication);
    assert.equal(result.lifecycle, "ready");
    assert.equal(state.patchCalls, 1);
  } finally {
    restore();
  }
});

test("external merge readback confirms only the recorded candidate", async () => {
  const state = providerState();
  state.merged = true;
  state.state = "closed";
  const restore = installProvider(state);
  try {
    const snapshot = await readGithubPullSnapshot("token", publication);
    assert.equal(snapshot.lifecycle, "merged");
    assert.equal(snapshot.mergeCommitSha, mergeCommit);
    assert.equal(snapshotIsMergedCandidate(snapshot, publication), true);
    const result = await inspectMergeCandidate("token", publication);
    assert.equal(result.decision.status, "merged");
    assert.equal(snapshotIsMergedCandidate(snapshot, { ...publication, headSha: advanced }), false);
  } finally {
    restore();
  }
});
