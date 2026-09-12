import assert from "node:assert/strict";
import test from "node:test";
import { createApp, createRouter, toWebHandler } from "h3";
import cockpit from "../server/api/cockpit.get.ts";
import deleteDraft from "../server/api/cockpit/drafts/[id].delete.ts";
import postDraft from "../server/api/cockpit/drafts.post.ts";
import putDrafts from "../server/api/cockpit/drafts.put.ts";
import issueLink from "../server/api/cockpit/issue-link.post.ts";
import {
  buildManifest,
  composeIssueLink,
  normalizeDrafts,
  saveDraft,
  type DraftClock,
} from "../server/utils/cockpit-api.ts";

const clock: DraftClock = {
  nextId: () => "generated-id",
  now: () => "2026-09-12T12:00:00.000Z",
};

function createTestHandler() {
  const router = createRouter();
  router.get("/api/cockpit", cockpit);
  router.post("/api/cockpit/drafts", postDraft);
  router.put("/api/cockpit/drafts", putDrafts);
  router.delete("/api/cockpit/drafts/:id", deleteDraft);
  router.post("/api/cockpit/issue-link", issueLink);

  const app = createApp();
  app.use(router.handler);
  return toWebHandler(app);
}

async function request(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return createTestHandler()(new Request(`http://localhost${path}`, init));
}

test("the manifest exposes every product capability behind the cockpit UI", async () => {
  const response = await request("/api/cockpit");
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.apiVersion, "1");
  assert.equal(body.context.references.length, 4);
  assert.equal(body.context.starters.length, 3);
  assert.equal(body.context.stages.length, 6);
  assert.deepEqual(
    body.sections.map((section: { id: string }) => section.id),
    ["mining", "work", "knowledge", "growth"],
  );

  const operations = [
    ...body.resources.drafts.operations,
    body.resources.github,
    body.resources.issueReview,
    ...body.resources.investigations.operations,
  ];
  assert.deepEqual(
    operations.map((operation: { method: string; path: string }) => `${operation.method} ${operation.path}`),
    [
      "POST /api/cockpit/drafts",
      "PUT /api/cockpit/drafts",
      "DELETE /api/cockpit/drafts/{id}",
      "GET /api/github",
      "POST /api/cockpit/issue-link",
      "GET /eve/v1/health",
      "GET /eve/v1/info",
      "POST /eve/v1/session",
      "POST /eve/v1/session/{sessionId}",
      "GET /eve/v1/session/{sessionId}/stream",
      "POST /eve/v1/session/{sessionId}/cancel",
      "POST /eve/v1/session/{sessionId}/reset",
    ],
  );
});

test("draft save validates, trims, timestamps and returns the next caller-owned collection", () => {
  const result = saveDraft(
    {
      draft: { id: "draft-2", title: "  Request  ", request: "  Inspect KAN  " },
      drafts: [
        {
          id: "draft-1",
          title: "Existing",
          request: "Keep me",
          updatedAt: "2026-09-11T12:00:00.000Z",
        },
        { id: "invalid", title: "Missing date", request: "Drop me" },
      ],
    },
    clock,
  );

  assert.deepEqual(result, {
    draft: {
      id: "draft-2",
      title: "Request",
      request: "Inspect KAN",
      updatedAt: "2026-09-12T12:00:00.000Z",
    },
    drafts: [
      {
        id: "draft-2",
        title: "Request",
        request: "Inspect KAN",
        updatedAt: "2026-09-12T12:00:00.000Z",
      },
      {
        id: "draft-1",
        title: "Existing",
        request: "Keep me",
        updatedAt: "2026-09-11T12:00:00.000Z",
      },
    ],
  });
});

test("draft normalization caps collections and never trusts malformed entries", () => {
  const drafts = Array.from({ length: 35 }, (_, index) => ({
    id: `draft-${index}`,
    title: `Draft ${index}`,
    request: "A request",
    updatedAt: "2026-09-12T12:00:00.000Z",
  }));

  assert.equal(normalizeDrafts([...drafts, null, { id: "spoof", title: "No date" }]).length, 30);
  assert.deepEqual(normalizeDrafts({ drafts }), []);
});

test("draft routes use JSON boundaries and return normalized state", async () => {
  const invalidContentType = await request("/api/cockpit/drafts", {
    method: "POST",
    body: JSON.stringify({ draft: { title: "Request", request: "Inspect" } }),
  });
  assert.equal(invalidContentType.status, 415);

  const response = await request("/api/cockpit/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      draft: { id: "draft-1", title: "Request", request: "Inspect KAN" },
      drafts: [],
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.draft.id, "draft-1");
  assert.equal(body.data.drafts.length, 1);
  assert.equal(body.meta.storage, "caller-owned");

  const invalid = await request("/api/cockpit/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ draft: { title: "", request: "" } }),
  });
  assert.equal(invalid.status, 400);
});

test("draft restore and delete routes preserve only valid caller state", async () => {
  const drafts = [
    {
      id: "draft-1",
      title: "One",
      request: "Keep",
      updatedAt: "2026-09-12T12:00:00.000Z",
    },
    {
      id: "draft-2",
      title: "Two",
      request: "Remove",
      updatedAt: "2026-09-12T12:00:00.000Z",
    },
  ];
  const headers = { "content-type": "application/json" };

  const restored = await request("/api/cockpit/drafts", {
    method: "PUT",
    headers,
    body: JSON.stringify({ drafts: [...drafts, { id: "bad" }] }),
  });
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).data.drafts.length, 2);

  const deleted = await request("/api/cockpit/drafts/draft-2", {
    method: "DELETE",
    headers,
    body: JSON.stringify({ drafts }),
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(
    (await deleted.json()).data.drafts.map((draft: { id: string }) => draft.id),
    ["draft-1"],
  );

  const invalidId = await request("/api/cockpit/drafts/not%20an%20id", {
    method: "DELETE",
    headers,
    body: JSON.stringify({ drafts }),
  });
  assert.equal(invalidId.status, 400);
});

test("issue-link API always targets the fixed repository and encodes user content", async () => {
  const title = "A title & review";
  const requestText = "Inspect /api and do not publish";
  const direct = composeIssueLink({ title, request: requestText });
  assert.equal(direct.repository, "software-factory-workshop/jira-clone");
  assert.equal(new URL(direct.url).searchParams.get("title"), title);
  assert.equal(new URL(direct.url).searchParams.get("body"), requestText);

  const response = await request("/api/cockpit/issue-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, request: requestText }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.repository, "software-factory-workshop/jira-clone");
  assert.equal(body.data.url, direct.url);

  const attemptedOverride = await request("/api/cockpit/issue-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      request: requestText,
      repository: "attacker/example",
    }),
  });
  assert.equal(attemptedOverride.status, 400);
});

test("manifest helper keeps the fixed repository and current stage explicit", () => {
  const manifest = buildManifest();
  assert.equal(manifest.repository.name, "software-factory-workshop/jira-clone");
  assert.equal(manifest.currentStage?.number, "01");
  assert.equal(manifest.resources.drafts.storage, "caller-owned");
});
