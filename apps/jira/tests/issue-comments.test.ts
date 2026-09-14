import test from "node:test";
import assert from "node:assert/strict";
import {
  addComment,
  createIssue,
  DEMO_COMMENT_AUTHOR,
  editComment,
  getIssue,
  listComments,
  resetIssues,
} from "../server/utils/issues.ts";
import {
  clearCommentDraft,
  clearCommentDraftAfterSave,
  commentDraftStorageKey,
  fetchIssueComments,
  isCommentDraftStorageAvailable,
  postIssueComment,
  putIssueComment,
  readCommentDraft,
  restCommentEditUrl,
  submitIssueComment,
  submitIssueCommentEdit,
  writeCommentDraft,
  type DemoComment,
  type IssueCommentsResponse,
  type RestCommentWriteResponse,
} from "../app/utils/issueComments.ts";
import {
  restCommentsUrl,
  restCommentWriteUrl,
} from "../app/utils/restIssues.ts";

/** Stub JSON fetcher backed by the real demo-only server store. */
function commentsFetch(calls: string[]) {
  return async (url: string): Promise<IssueCommentsResponse> => {
    calls.push(url);
    const match = /\/issue\/([^/]+)\/comment/.exec(url);
    const key = decodeURIComponent(match?.[1] ?? "");
    const comments = listComments(key);
    if (!comments) {
      throw new Error(`Unknown issue key: ${key}.`);
    }
    return { comments, demoOnly: true };
  };
}

test("add/list round-trips comments on a seeded key", async () => {
  resetIssues();
  const added = addComment("ADEO-1", { body: "First demo comment" });
  assert.equal(added.ok, true);
  if (added.ok) {
    assert.equal(added.comment.body, "First demo comment");
    assert.equal(added.comment.author, DEMO_COMMENT_AUTHOR);
    assert.match(added.comment.author, /demo-only/);
    assert.equal(added.comment.demoOnly, true);
    assert.ok(added.comment.id.startsWith("ADEO-1-comment-"));
  }
  const listed = listComments("ADEO-1");
  assert.equal(listed?.length, 1);
  const calls: string[] = [];
  const result = await fetchIssueComments("ADEO-1", commentsFetch(calls));
  assert.deepEqual(calls, [restCommentsUrl("ADEO-1")]);
  assert.equal(result.demoOnly, true);
  assert.deepEqual(result.comments, listed);
  resetIssues();
});

test("comments are isolated per issue key", () => {
  resetIssues();
  assert.equal(addComment("ADEO-1", { body: "Only on one" }).ok, true);
  assert.deepEqual(
    (listComments("ADEO-1") ?? []).map((comment) => comment.body),
    ["Only on one"],
  );
  assert.deepEqual(listComments("ADEO-2"), []);
  resetIssues();
});

test("seeded and created ADEO-n keys both accept comments", () => {
  resetIssues();
  const created = createIssue({ title: "Demo comment target" });
  assert.equal(created.ok, true);
  const key = created.ok ? created.issue.key : "";
  assert.ok(getIssue(key));
  assert.equal(addComment(key, { body: "On the created issue" }).ok, true);
  assert.equal(listComments(key)?.length, 1);
  assert.equal(listComments("ADEO-1")?.length, 0);
  resetIssues();
});

test("unknown keys are rejected before writing", () => {
  resetIssues();
  assert.equal(listComments("ADEO-9999"), undefined);
  const rejected = addComment("ADEO-9999", { body: "Never stored" });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.ok ? 0 : rejected.statusCode, 404);
  assert.equal(listComments("ADEO-1")?.length, 0);
  resetIssues();
});

test("blank bodies are rejected before writing", () => {
  resetIssues();
  for (const body of ["", "   ", undefined]) {
    const rejected = addComment("ADEO-1", { body });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.ok ? 0 : rejected.statusCode, 400);
  }
  assert.deepEqual(listComments("ADEO-1"), []);
  resetIssues();
});

test("deterministic failure writes nothing", () => {
  resetIssues();
  const before = listComments("ADEO-1");
  const failed = addComment(
    "ADEO-1",
    { body: "Never saved" },
    { fail: true },
  );
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? 0 : failed.statusCode, 500);
  assert.deepEqual(listComments("ADEO-1"), before);
  resetIssues();
});

test("edit updates the body and trims, preserving id/author", () => {
  resetIssues();
  const added = addComment("ADEO-1", { body: "Original body" });
  assert.equal(added.ok, true);
  const id = added.ok ? added.comment.id : "";
  const edited = editComment("ADEO-1", { commentId: id, body: "  Edited body  " });
  assert.equal(edited.ok, true);
  if (edited.ok) {
    assert.equal(edited.comment.id, id);
    assert.equal(edited.comment.body, "Edited body");
    assert.equal(edited.comment.author, DEMO_COMMENT_AUTHOR);
    assert.equal(edited.comment.demoOnly, true);
  }
  assert.deepEqual(
    (listComments("ADEO-1") ?? []).map((comment) => comment.body),
    ["Edited body"],
  );
  resetIssues();
});

test("edit fails closed on unknown keys, ids, blank and replay bodies", () => {
  resetIssues();
  assert.equal(listComments("ADEO-9999"), undefined);
  const unknownKey = editComment("ADEO-9999", { commentId: "ADEO-9999-comment-1", body: "x" });
  assert.equal(unknownKey.ok, false);
  assert.equal(unknownKey.ok ? 0 : unknownKey.statusCode, 404);

  const added = addComment("ADEO-1", { body: "Keep me" });
  assert.equal(added.ok, true);
  const id = added.ok ? added.comment.id : "";
  const before = listComments("ADEO-1");

  const unknownId = editComment("ADEO-1", { commentId: "ADEO-1-comment-9999", body: "Never" });
  assert.equal(unknownId.ok, false);
  assert.equal(unknownId.ok ? 0 : unknownId.statusCode, 404);

  for (const body of ["", "   ", undefined]) {
    const rejected = editComment("ADEO-1", { commentId: id, body });
    assert.equal(rejected.ok, false, JSON.stringify(body));
    assert.equal(rejected.ok ? 0 : rejected.statusCode, 400);
  }

  const missingId = editComment("ADEO-1", { body: "Never" });
  assert.equal(missingId.ok, false);
  assert.equal(missingId.ok ? 0 : missingId.statusCode, 400);

  const replay = editComment("ADEO-1", { commentId: id, body: "  Keep me  " });
  assert.equal(replay.ok, false);
  assert.equal(replay.ok ? 0 : replay.statusCode, 409);
  assert.match(replay.ok ? "" : replay.error, /replay/);

  const failed = editComment("ADEO-1", { commentId: id, body: "Never saved" }, { fail: true });
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? 0 : failed.statusCode, 500);

  assert.deepEqual(listComments("ADEO-1"), before);
  resetIssues();
});

test("edit agrees across list reads and reset clears edits", () => {
  resetIssues();
  const first = addComment("ADEO-1", { body: "First" });
  const second = addComment("ADEO-1", { body: "Second" });
  assert.equal(first.ok && second.ok, true);
  const id = first.ok ? first.comment.id : "";
  const edited = editComment("ADEO-1", { commentId: id, body: "First edited" });
  assert.equal(edited.ok, true);
  assert.deepEqual(
    (listComments("ADEO-1") ?? []).map((comment) => comment.body),
    ["First edited", "Second"],
  );
  resetIssues();
  assert.deepEqual(listComments("ADEO-1"), []);
});

test("canonical edit URL targets PUT /api/rest/api/3/issue/:key/comment/:commentId", () => {
  assert.equal(
    restCommentEditUrl("ADEO-1", "ADEO-1-comment-3"),
    "/api/rest/api/3/issue/ADEO-1/comment/ADEO-1-comment-3",
  );
  assert.equal(
    restCommentEditUrl("ADEO 1", "ADEO 1-comment-3"),
    "/api/rest/api/3/issue/ADEO%201/comment/ADEO%201-comment-3",
  );
});

test("canonical edit puts through the REST route and maps the bean", async () => {
  const bean = {
    id: "ADEO-1-comment-3",
    body: "Edited via REST",
    author: { displayName: "Demo Member (member) · demo-only" },
    created: "2026-09-12T00:00:04.000Z",
    demoOnly: true as const,
  };
  const calls: { url: string; body: unknown }[] = [];
  const mapped = await putIssueComment("ADEO-1", bean.id, "  Edited via REST  ", async (url, request) => {
    calls.push({ url, body: request });
    assert.deepEqual(request, { body: "  Edited via REST  " });
    const response: RestCommentWriteResponse = { comment: bean, demoOnly: true };
    return response;
  });
  assert.deepEqual(calls.map((call) => call.url), [
    "/api/rest/api/3/issue/ADEO-1/comment/ADEO-1-comment-3",
  ]);
  assert.deepEqual(mapped, {
    id: bean.id,
    body: bean.body,
    author: bean.author.displayName,
    createdAt: bean.created,
    demoOnly: true,
  });
});

test("canonical edit never reports false success on a missing bean", async () => {
  await assert.rejects(
    putIssueComment("ADEO-1", "ADEO-1-comment-3", "kept", async () => ({})),
    /returned no comment.*draft is kept/,
  );
  await assert.rejects(
    putIssueComment("ADEO-1", "", "kept", async () => ({})),
    /comment id is required/,
  );
  await assert.rejects(
    putIssueComment("ADEO-1", "ADEO-1-comment-3", "   ", async () => ({})),
    /nonblank/,
  );
});

test("edit submit helper replaces the entry, keeps drafts on failure, rejects replay", async () => {
  const seed: DemoComment[] = [
    {
      id: "ADEO-1-comment-1",
      body: "Existing",
      author: DEMO_COMMENT_AUTHOR,
      createdAt: "2026-09-12T00:00:00.000Z",
      demoOnly: true,
    },
    {
      id: "ADEO-1-comment-2",
      body: "Other",
      author: DEMO_COMMENT_AUTHOR,
      createdAt: "2026-09-12T00:00:01.000Z",
      demoOnly: true,
    },
  ];
  const unknown = await submitIssueCommentEdit(seed, "ADEO-1-comment-9", "x", async (body) => ({
    ...seed[0]!,
    body,
  }));
  assert.equal(unknown.ok, false);
  assert.deepEqual(unknown.comments, seed);

  const blank = await submitIssueCommentEdit(seed, "ADEO-1-comment-1", "   ", async (body) => ({
    ...seed[0]!,
    body,
  }));
  assert.equal(blank.ok, false);
  assert.deepEqual(blank.comments, seed);

  const replay = await submitIssueCommentEdit(seed, "ADEO-1-comment-1", "  Existing  ", async (body) => ({
    ...seed[0]!,
    body,
  }));
  assert.equal(replay.ok, false);
  assert.deepEqual(replay.comments, seed);

  const failed = await submitIssueCommentEdit(seed, "ADEO-1-comment-1", "kept draft", async () => {
    throw new Error("Demo-only comment edit failure (deterministic test path).");
  });
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.comments, seed);
  assert.equal(failed.draft, "kept draft");

  const saved: DemoComment = {
    id: "ADEO-1-comment-1",
    body: "Edited",
    author: DEMO_COMMENT_AUTHOR,
    createdAt: "2026-09-12T00:00:00.000Z",
    demoOnly: true,
  };
  const succeeded = await submitIssueCommentEdit(
    seed,
    "ADEO-1-comment-1",
    "  Edited  ",
    async (body) => {
      assert.equal(body, "Edited");
      return saved;
    },
  );
  assert.equal(succeeded.ok, true);
  assert.deepEqual(succeeded.comments, [saved, seed[1]]);
  assert.equal(succeeded.draft, "");
});

test("reset clears comments", () => {
  resetIssues();
  assert.equal(addComment("ADEO-1", { body: "Temporary" }).ok, true);
  resetIssues();
  assert.deepEqual(listComments("ADEO-1"), []);
});

test("canonical write URL targets POST /api/rest/api/3/issue/:key/comment", () => {
  assert.equal(
    restCommentWriteUrl("ADEO-1"),
    "/api/rest/api/3/issue/ADEO-1/comment",
  );
  assert.equal(
    restCommentWriteUrl("ADEO 1"),
    "/api/rest/api/3/issue/ADEO%201/comment",
  );
});

test("canonical write posts through the REST route and maps the bean", async () => {
  const bean = {
    id: "ADEO-1-comment-7",
    body: "Canonical write",
    author: { displayName: "Demo Member (member) · demo-only" },
    created: "2026-09-12T00:00:02.000Z",
    demoOnly: true as const,
  };
  const calls: { url: string; body: unknown }[] = [];
  const mapped = await postIssueComment("ADEO-1", "  Canonical write  ", async (url, request) => {
    calls.push({ url, body: request });
    assert.deepEqual(request, { body: "  Canonical write  " });
    const response: RestCommentWriteResponse = { comment: bean, demoOnly: true };
    return response;
  });
  assert.deepEqual(calls.map((call) => call.url), [
    "/api/rest/api/3/issue/ADEO-1/comment",
  ]);
  assert.deepEqual(mapped, {
    id: bean.id,
    body: bean.body,
    author: bean.author.displayName,
    createdAt: bean.created,
    demoOnly: true,
  });
});

test("canonical write never reports false success on a missing bean", async () => {
  await assert.rejects(
    postIssueComment("ADEO-1", "kept", async () => ({})),
    /returned no comment.*draft is kept/,
  );
  await assert.rejects(
    postIssueComment("ADEO-1", "kept", async () => {
      throw new Error("Demo-only REST write failed. Your draft is kept for retry.");
    }),
    /Demo-only REST write failed/,
  );
});

function memoryStore(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

test("per-issue drafts are isolated and survive close/reopen", () => {
  const store = memoryStore();
  assert.equal(commentDraftStorageKey("ADEO-1"), "adeo-demo-comment-draft:ADEO-1");
  assert.notEqual(
    commentDraftStorageKey("ADEO-1"),
    commentDraftStorageKey("ADEO-2"),
  );
  assert.equal(readCommentDraft("ADEO-1", store), "");
  writeCommentDraft("ADEO-1", "first draft", store);
  writeCommentDraft("ADEO-2", "second draft", store);
  // Reopen each dialog: the stored draft is restored per key.
  assert.equal(readCommentDraft("ADEO-1", store), "first draft");
  assert.equal(readCommentDraft("ADEO-2", store), "second draft");
  // Posting clears only the posted issue.
  clearCommentDraft("ADEO-1", store);
  assert.equal(readCommentDraft("ADEO-1", store), "");
  assert.equal(readCommentDraft("ADEO-2", store), "second draft");
  // Blank drafts never accumulate storage entries.
  writeCommentDraft("ADEO-2", "   ", store);
  assert.equal(readCommentDraft("ADEO-2", store), "");
});

test("late comment saves clear only the originating draft", async () => {
  const store = memoryStore();
  writeCommentDraft("ADEO-1", "originating draft", store);
  writeCommentDraft("ADEO-2", "untouched draft", store);

  // The POST resolves after the user typed a newer draft on the same issue:
  // only the submitted text is cleared and the newer draft is preserved.
  writeCommentDraft("ADEO-1", "newer draft typed while saving", store);
  let deferredResolve: (value: string) => void = () => {};
  const deferred = new Promise<string>((resolve) => {
    deferredResolve = resolve;
  });
  const pending = submitIssueComment(
    [],
    "originating draft",
    (body) => deferred.then(() => ({ id: "late-1", body, author: DEMO_COMMENT_AUTHOR, createdAt: "2026-09-12T00:00:03.000Z", demoOnly: true as const })),
  );
  deferredResolve("saved");
  const result = await pending;
  assert.equal(result.ok, true);
  const cleared = clearCommentDraftAfterSave("ADEO-1", "originating draft", store);
  assert.equal(cleared, false);
  assert.equal(readCommentDraft("ADEO-1", store), "newer draft typed while saving");
  assert.equal(readCommentDraft("ADEO-2", store), "untouched draft");

  // When the stored text still matches the submitted one, the draft clears.
  writeCommentDraft("ADEO-1", "originating draft", store);
  assert.equal(clearCommentDraftAfterSave("ADEO-1", "originating draft", store), true);
  assert.equal(readCommentDraft("ADEO-1", store), "");
  assert.equal(readCommentDraft("ADEO-2", store), "untouched draft");

  // Dialog closed mid-save: the stored-origin snapshot still clears cleanly.
  writeCommentDraft("ADEO-1", "closing draft", store);
  assert.equal(clearCommentDraftAfterSave("ADEO-1", "closing draft", store), true);
  assert.equal(readCommentDraft("ADEO-1", store), "");
});

test("draft storage failures keep the in-memory draft", () => {
  const failing: Storage = memoryStore();
  failing.setItem = () => {
    throw new Error("storage unavailable");
  };
  failing.getItem = () => {
    throw new Error("storage unavailable");
  };
  failing.removeItem = () => {
    throw new Error("storage unavailable");
  };
  assert.equal(readCommentDraft("ADEO-1", failing), "");
  assert.equal(isCommentDraftStorageAvailable(failing), false);
  writeCommentDraft("ADEO-1", "kept in memory", failing);
  clearCommentDraft("ADEO-1", failing);
});

test("unavailable default storage falls back to an honest per-issue session draft", () => {
  const failing = memoryStore();
  failing.setItem = () => {
    throw new Error("storage unavailable");
  };
  failing.getItem = () => {
    throw new Error("storage unavailable");
  };
  failing.removeItem = () => {
    throw new Error("storage unavailable");
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    value: failing,
    configurable: true,
    writable: true,
  });
  try {
    assert.equal(isCommentDraftStorageAvailable(), false);
    writeCommentDraft("ADEO-1", "session draft one");
    writeCommentDraft("ADEO-2", "session draft two");
    // Session-only mirrors survive dialog close/reopen per issue key.
    assert.equal(readCommentDraft("ADEO-1"), "session draft one");
    assert.equal(readCommentDraft("ADEO-2"), "session draft two");
    // A late save on another issue never clears the wrong session draft.
    assert.equal(clearCommentDraftAfterSave("ADEO-2", "session draft two"), true);
    assert.equal(readCommentDraft("ADEO-1"), "session draft one");
    assert.equal(readCommentDraft("ADEO-2"), "");
    // Blank mirrors never accumulate entries.
    writeCommentDraft("ADEO-1", "   ");
    assert.equal(readCommentDraft("ADEO-1"), "");
    assert.equal(isCommentDraftStorageAvailable(), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete (globalThis as Record<string, unknown>)["localStorage"];
  }
});

test("submit helper keeps the draft on failure and clears it on success", async () => {
  const seed: DemoComment[] = [
    {
      id: "ADEO-1-comment-1",
      body: "Existing",
      author: DEMO_COMMENT_AUTHOR,
      createdAt: "2026-09-12T00:00:00.000Z",
      demoOnly: true,
    },
  ];
  const failed = await submitIssueComment(seed, "  kept draft  ", async () => {
    throw new Error(
      "Demo-only comment save failure (deterministic test path).",
    );
  });
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.comments, seed);
  assert.equal(failed.draft, "  kept draft  ");
  assert.match(failed.error, /Demo-only comment save failure/);

  const blank = await submitIssueComment(seed, "   ", async () => seed[0]!);
  assert.equal(blank.ok, false);
  assert.deepEqual(blank.comments, seed);
  assert.equal(blank.draft, "   ");

  const saved: DemoComment = {
    id: "ADEO-1-comment-2",
    body: "kept draft",
    author: DEMO_COMMENT_AUTHOR,
    createdAt: "2026-09-12T00:00:01.000Z",
    demoOnly: true,
  };
  const succeeded = await submitIssueComment(
    seed,
    "  kept draft  ",
    async (body) => {
      assert.equal(body, "kept draft");
      return saved;
    },
  );
  assert.equal(succeeded.ok, true);
  assert.deepEqual(succeeded.comments, [...seed, saved]);
  assert.equal(succeeded.draft, "");
});
