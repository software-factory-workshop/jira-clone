import { test } from "node:test";
import assert from "node:assert/strict";
import { createIncompleteReviewFeedback, publishReviewFeedback, reviewFeedbackCommentBody } from "../runtime/lib/review-feedback.ts";
import { withVisualReviewSection } from "../runtime/lib/visual-review.ts";

const base = "a".repeat(40);
const head = "b".repeat(40);
const repository = "software-factory-workshop/jira-clone";

test("incomplete feedback publishes a partial packet and a non-approval review", async t => {
  const writes: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  const pull = {
    number: 140,
    html_url: `https://github.com/${repository}/pull/140`,
    title: "Visual change",
    body: "Original PR body",
    state: "open",
    head: { sha: head, ref: "factory/work-visual", repo: { full_name: repository } },
    base: { sha: base, ref: "main", repo: { full_name: repository } },
  };
  t.mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
    const target = new URL(String(url));
    const path = target.pathname.slice(`/repos/${repository}/`.length);
    const method = init.method || "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    if (path === "pulls/140" && method === "GET") return Response.json(pull);
    if (path === "pulls/140/files" && method === "GET") return Response.json([{ filename: "apps/jira/app/app.vue", status: "modified" }]);
    if (path === "pulls/140" && method === "PATCH") { writes.push({ method, path, body }); return Response.json(pull); }
    if (path === "git/ref/heads/main" && method === "GET") return Response.json({ object: { sha: base } });
    if (path === "pulls/140/reviews" && method === "GET") return Response.json([]);
    if (path === "pulls/140/reviews" && method === "POST") {
      writes.push({ method, path, body });
      return Response.json({ id: 7, body: body?.body, commit_id: body?.commit_id, html_url: `https://github.com/${repository}/pull/140#review-7` });
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  });

  const result = await createIncompleteReviewFeedback({
    token: "test-token",
    prNumber: 140,
    reviewerSessionId: "wrun_reviewer",
    baseSha: base,
    targetBranch: "main",
    reason: "The reviewer stopped before record_review.",
  });

  assert.equal(result.review.verdict, "incomplete");
  assert.equal(result.review.visualReview.status, "partial");
  assert.equal(result.publication.body, "published");
  assert.equal(result.publication.githubReview, "published");
  assert.deepEqual(result.publication.errors, []);
  assert.equal(writes.filter(write => write.method === "PATCH").length, 1);
  assert.equal(writes.filter(write => write.method === "POST").length, 1);
  assert.equal(writes.find(write => write.method === "POST")?.body?.event, "COMMENT");
  assert.match(String(writes.find(write => write.method === "POST")?.body?.body), /visual-review:incomplete/);
});

test("review comment body keeps exact binding and lists missing evidence", () => {
  const body = reviewFeedbackCommentBody({
    kind: "incomplete",
    verdict: "incomplete",
    summary: "The reviewer stopped.",
    findings: [],
    limitations: ["Browser evidence was not captured."],
    visualReview: {
      version: 1,
      status: "partial",
      requiredApps: ["jira"],
      baseSha: base,
      headSha: head,
      targetBranch: "main",
      reviewerSessionId: "wrun_reviewer",
      capturedAt: "2026-09-15T00:00:00.000Z",
      artifacts: [],
      limitations: ["Browser evidence was not captured."],
    },
    baseSha: base,
    headSha: head,
    targetBranch: "main",
  });
  assert.match(body, new RegExp(`visual-review:incomplete:${head}:${base}:main`));
  assert.match(body, new RegExp(head));
  assert.match(body, /Browser evidence was not captured/);
});

test("incomplete retry preserves an existing same-binding public visual packet", async t => {
  const visualReview = {
    version: 1 as const,
    status: "partial" as const,
    requiredApps: ["jira" as const],
    baseSha: base,
    headSha: head,
    targetBranch: "main",
    reviewerSessionId: "wrun_previous",
    capturedAt: "2026-09-15T00:00:00.000Z",
    artifacts: [{
      id: "a".repeat(32),
      app: "jira" as const,
      origin: "http://127.0.0.1:3001",
      route: "/",
      baseSha: base,
      headSha: head,
      targetBranch: "main",
      capturedAt: "2026-09-15T00:00:00.000Z",
      after: {
        phase: "after" as const,
        source: "head" as const,
        sourceSha: head,
        url: "https://visual.public.blob.vercel-storage.com/after.png",
        sha256: "c".repeat(64),
        mediaType: "image/png" as const,
      },
    }],
    limitations: [],
  };
  const currentBody = withVisualReviewSection("Original PR body", visualReview, { baseSha: base, headSha: head, targetBranch: "main" });
  const writes: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  const pull = {
    number: 140,
    html_url: `https://github.com/${repository}/pull/140`,
    title: "Visual change",
    body: currentBody,
    state: "open",
    head: { sha: head, ref: "factory/work-visual", repo: { full_name: repository } },
    base: { sha: base, ref: "main", repo: { full_name: repository } },
  };
  t.mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
    const target = new URL(String(url));
    const path = target.pathname.slice(`/repos/${repository}/`.length);
    const method = init.method || "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    if (path === "pulls/140" && method === "GET") return Response.json(pull);
    if (path === "git/ref/heads/main" && method === "GET") return Response.json({ object: { sha: base } });
    if (path === "pulls/140/reviews" && method === "GET") return Response.json([]);
    if (path === "pulls/140/reviews" && method === "POST") {
      writes.push({ method, path, body });
      return Response.json({ id: 8, body: body?.body, commit_id: body?.commit_id, html_url: `https://github.com/${repository}/pull/140#review-8` });
    }
    if (path === "pulls/140" && method === "PATCH") throw new Error("same-binding incomplete retry must not replace the public packet");
    throw new Error(`Unexpected request ${method} ${path}`);
  });

  const publication = await publishReviewFeedback({
    token: "test-token",
    prNumber: 140,
    currentBody,
    headSha: head,
    baseSha: base,
    targetBranch: "main",
    verdict: "incomplete",
    summary: "The retry stopped after the previous packet was published.",
    findings: [],
    limitations: ["The retry was incomplete."],
    visualReview,
    includeVisualSection: true,
    kind: "incomplete",
  });

  assert.equal(publication.body, "published");
  assert.equal(publication.githubReview, "published");
  assert.equal(writes.filter(write => write.method === "PATCH").length, 0);
  assert.equal(writes.filter(write => write.method === "POST").length, 1);
});
