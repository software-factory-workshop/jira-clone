import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVisualReviewPacket, visualReviewMarkdown, visualReviewStatusFor, withVisualReviewSection, VISUAL_REVIEW_END, VISUAL_REVIEW_START } from "../runtime/lib/visual-review.ts";

const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const digest = "c".repeat(64);
const frame = (phase: "before" | "after") => ({ phase, source: phase === "before" ? "base" as const : "head" as const, sourceSha: phase === "before" ? baseSha : headSha, url: `https://factory.example/factory/review-artifacts/packet?phase=${phase}`, sha256: digest, mediaType: "image/png" as const });

test("visual packets distinguish complete, partial and unrequired browser coverage", () => {
  const complete = buildVisualReviewPacket({ version: 1, requiredApps: ["jira"], baseSha, headSha, targetBranch: "main", reviewerSessionId: "wrun_reviewer", capturedAt: "2026-09-13T12:00:00.000Z", artifacts: [{ id: "a".repeat(32), app: "jira", origin: "http://127.0.0.1:3001", route: "/issues", baseSha, headSha, targetBranch: "main", capturedAt: "2026-09-13T12:00:00.000Z", before: frame("before"), after: frame("after") }], limitations: [] });
  assert.equal(complete.status, "complete");
  assert.equal(visualReviewStatusFor(complete, { baseSha, headSha, targetBranch: "main" }), "complete");
  assert.equal(visualReviewStatusFor(complete, { baseSha, headSha: "d".repeat(40), targetBranch: "main" }), "stale");

  const partial = buildVisualReviewPacket({ ...complete, artifacts: [{ ...complete.artifacts[0]!, after: undefined }], limitations: ["After state was not captured."] });
  assert.equal(partial.status, "partial");
  assert.equal(buildVisualReviewPacket({ ...complete, requiredApps: [], artifacts: [] }).status, "not_required");
});

test("visual PR section is deterministic, bound to the candidate, and replaceable", () => {
  const packet = buildVisualReviewPacket({ version: 1, requiredApps: ["jira"], baseSha, headSha, targetBranch: "main", reviewerSessionId: "wrun_reviewer", capturedAt: "2026-09-13T12:00:00.000Z", artifacts: [{ id: "a".repeat(32), app: "jira", origin: "http://127.0.0.1:3001", route: "/issues?filter=open", baseSha, headSha, targetBranch: "main", capturedAt: "2026-09-13T12:00:00.000Z", before: frame("before"), after: frame("after") }], limitations: [] });
  const body = withVisualReviewSection("Keep the original reviewer summary.", packet);
  assert.match(body, /Keep the original reviewer summary\./);
  assert.match(body, /exact candidate/);
  assert.match(body, /factory\/review-artifacts/);
  assert.match(body, /Base design/);
  assert.match(body, /Candidate design/);
  assert.match(body, new RegExp(VISUAL_REVIEW_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(body, new RegExp(VISUAL_REVIEW_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const replaced = withVisualReviewSection(body, { ...packet, status: "partial", limitations: ["One frame is missing."] });
  assert.equal((replaced.match(/## Visual review/g) || []).length, 1);
  assert.match(replaced, /One frame is missing\./);
});
