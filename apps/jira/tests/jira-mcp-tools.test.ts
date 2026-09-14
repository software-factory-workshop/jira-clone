import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REST_BOUNDARY,
  REST_MAX_MAX_RESULTS,
  mcpWriteIdentity,
  restAddComment,
  restComments,
  restCreateIssue,
  restIssue,
  restMyself,
  restProject,
  restProjectStatuses,
  restSearch,
  restTransitionIssue,
  restTransitions,
  restUpdateIssue,
} from "../server/utils/jiraRest.ts";
import {
  getIssue,
  getIssues,
  listComments,
  resetIssues,
} from "../server/utils/issues.ts";

const here = dirname(fileURLToPath(import.meta.url));
const toolsDir = join(here, "..", "server", "mcp", "tools");

/**
 * Demo-only MCP protocol tests: seven read tools plus four bounded write tools.
 *
 * Each file under `server/mcp/tools/*.ts` calls the Nuxt-injected
 * `defineMcpTool`/`createError` globals and imports the real `zod`. The
 * protocol harness stubs the two Nuxt globals, imports the tool files, and
 * drives every handler directly against the same REST contracts the
 * adapter serves (`restMyself`, `restProject`, `restProjectStatuses`,
 * `restIssue`, `restSearch`, `restComments`, `restTransitions` for reads;
 * `restCreateIssue`, `restUpdateIssue`, `restAddComment`,
 * `restTransitionIssue` for bounded writes).
 *
 * Write tools accept the explicit labelled `demoUser` fallback because the
 * raw Passport header only exists on the HTTP request boundary; they never
 * claim Passport auth and always report `demoFallback`.
 */

type CapturedTool = {
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
};

const EXPECTED_FILES = [
  "add-comment.ts",
  "create-issue.ts",
  "delete-issue.ts",
  "get-allowed-transitions.ts",
  "get-issue.ts",
  "get-project-statuses.ts",
  "get-project.ts",
  "list-comments.ts",
  "list-issues.ts",
  "me.ts",
  "transition-issue.ts",
  "update-issue.ts",
];

const READ_NAMES = [
  "getAllowedTransitions",
  "getIssue",
  "getProject",
  "getProjectStatuses",
  "listComments",
  "listIssues",
  "me",
];

const WRITE_NAMES = ["addComment", "createIssue", "deleteIssue", "transitionIssue", "updateIssue"];

const EXPECTED_NAMES = [...READ_NAMES, ...WRITE_NAMES];

let cachedTools: Map<string, CapturedTool> | undefined;

async function loadTools(): Promise<Map<string, CapturedTool>> {
  if (cachedTools) return cachedTools;
  const captured = new Map<string, CapturedTool>();
  (globalThis as Record<string, unknown>)["defineMcpTool"] = (
    definition: CapturedTool,
  ) => {
    if (definition?.name) captured.set(definition.name, definition);
    return definition;
  };
  (globalThis as Record<string, unknown>)["createError"] = (input: {
    statusCode: number;
    message: string;
  }) => {
    const error = new Error(input.message) as Error & { statusCode: number };
    error.statusCode = input.statusCode;
    return error;
  };
  for (const file of EXPECTED_FILES) {
    await import(`../server/mcp/tools/${file}`);
  }
  cachedTools = captured;
  return captured;
}

async function callTool(
  tool: CapturedTool,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    return await tool.handler(args);
  } catch (error) {
    return error;
  }
}

function sourceFor(name: string): string {
  const file = EXPECTED_FILES.find((entry) =>
    readFileSync(join(toolsDir, entry), "utf8").includes(`"${name}"`),
  );
  assert.ok(file, `tool source file for ${name} exists`);
  return readFileSync(join(toolsDir, file!), "utf8");
}

test("mcp tool surface is the seven reads plus five bounded writes", async () => {
  const files = readdirSync(toolsDir)
    .filter((file) => file.endsWith(".ts"))
    .sort();
  assert.deepEqual(files, [...EXPECTED_FILES].sort());
  const tools = await loadTools();
  assert.deepEqual([...tools.keys()].sort(), [...EXPECTED_NAMES].sort());
  for (const name of READ_NAMES) {
    const tool = tools.get(name)!;
    assert.ok(tool, `${name} is registered`);
    assert.equal(tool.annotations?.["readOnlyHint"], true);
    assert.match(String(tool.description), /Demo-only read/i);
    const source = sourceFor(name);
    assert.match(source, /from "zod"/);
    assert.doesNotMatch(source, /restCreateIssue|restUpdateIssue|restAddComment|restTransitionIssue|restDeleteIssue/);
    assert.doesNotMatch(
      source,
      /defineMcpHandler|defineMcpResource|defineMcpPrompt/,
    );
    assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|DELETE)["']/);
  }
  for (const name of WRITE_NAMES) {
    const tool = tools.get(name)!;
    assert.ok(tool, `${name} is registered`);
    assert.equal(tool.annotations?.["readOnlyHint"], false);
    assert.match(String(tool.description), /Demo-only write/i);
    const source = sourceFor(name);
    assert.match(source, /from "zod"/);
    // Write tools share the REST write helpers and the demoUser fallback;
    // they never touch the raw Passport header or claim Passport auth.
    assert.match(source, /rest(CreateIssue|UpdateIssue|AddComment|TransitionIssue|DeleteIssue)/);
    assert.match(source, /mcpWriteIdentity/);
    assert.doesNotMatch(source, /passportToken|PASSPORT_TOKEN_HEADER/);
    assert.match(source, /without Passport auth/);
    assert.match(source, /demoUser/);
    assert.doesNotMatch(
      source,
      /defineMcpHandler|defineMcpResource|defineMcpPrompt/,
    );
  }
});

test("mcp read tools map the REST contracts 1:1 and write nothing", async () => {
  resetIssues();
  const tools = await loadTools();
  const before = getIssues();

  const me = tools.get("me")!;
  assert.deepEqual(
    await callTool(me, {}),
    (restMyself(undefined) as { ok: true; data: unknown }).data,
  );
  assert.deepEqual(
    await callTool(me, { demoUser: "demo-viewer" }),
    (restMyself("demo-viewer") as { ok: true; data: unknown }).data,
  );

  const getProject = tools.get("getProject")!;
  assert.deepEqual(
    await callTool(getProject, {}),
    (restProject("KAN") as { ok: true; data: unknown }).data,
  );

  const getProjectStatuses = tools.get("getProjectStatuses")!;
  assert.deepEqual(
    await callTool(getProjectStatuses, {}),
    (restProjectStatuses("KAN") as { ok: true; data: unknown }).data,
  );

  const getIssue = tools.get("getIssue")!;
  const directIssue = await restIssue("ADEO-1");
  assert.deepEqual(
    await callTool(getIssue, { issueKey: "ADEO-1" }),
    directIssue.ok ? directIssue.data : undefined,
  );

  const listIssues = tools.get("listIssues")!;
  const directSearch = await restSearch({});
  assert.deepEqual(
    await callTool(listIssues, {}),
    directSearch.ok ? directSearch.data : undefined,
  );
  const directPage = await restSearch({ startAt: "1", maxResults: "2" });
  assert.deepEqual(
    await callTool(listIssues, { startAt: 1, maxResults: 2 }),
    directPage.ok ? directPage.data : undefined,
  );

  const listComments = tools.get("listComments")!;
  const directComments = await restComments("ADEO-2", {});
  assert.deepEqual(
    await callTool(listComments, { issueKey: "ADEO-2" }),
    directComments.ok ? directComments.data : undefined,
  );

  const getAllowedTransitions = tools.get("getAllowedTransitions")!;
  const directTransitions = await restTransitions("ADEO-1", {});
  assert.deepEqual(
    await callTool(getAllowedTransitions, { issueKey: "ADEO-1" }),
    directTransitions.ok ? directTransitions.data : undefined,
  );

  // Driving every read tool wrote nothing.
  assert.deepEqual(getIssues(), before);
  assert.match(REST_BOUNDARY, /bounded writes/);
  resetIssues();
});

test("mcp tools fail closed on unknown keys, bad pagination and jql", async () => {
  resetIssues();
  const tools = await loadTools();
  const before = getIssues();

  const getIssue = tools.get("getIssue")!;
  const missing = (await callTool(getIssue, {
    issueKey: "ADEO-9999",
  })) as Error & { statusCode: number };
  assert.equal(missing.statusCode, 404);
  assert.match(missing.message, /Unknown issue key/);

  const getProject = tools.get("getProject")!;
  const noProject = (await callTool(getProject, {
    projectKey: "NOPE",
  })) as Error & { statusCode: number };
  assert.equal(noProject.statusCode, 404);
  assert.match(noProject.message, /Unknown demo project/);

  const listIssues = tools.get("listIssues")!;
  const beyond = await callTool(listIssues, {
    startAt: 999,
    maxResults: 10,
  });
  assert.deepEqual(
    (beyond as { issues: unknown[] }).issues,
    [],
  );
  const tooMany = await callTool(listIssues, {
    maxResults: REST_MAX_MAX_RESULTS + 1,
  });
  assert.ok(tooMany instanceof Error, "maxResults above 50 must fail closed");

  const jqlRejected = (await callTool(listIssues, {
    jql: "project = KAN",
  })) as Error & { statusCode: number };
  assert.equal(jqlRejected.statusCode, 400);
  assert.match(jqlRejected.message, /no JQL engine/i);

  const listComments = tools.get("listComments")!;
  const commentJql = (await callTool(listComments, {
    issueKey: "ADEO-1",
    jql: "x",
  })) as Error & { statusCode: number };
  assert.equal(commentJql.statusCode, 400);

  const getAllowedTransitions = tools.get("getAllowedTransitions")!;
  const transitionJql = (await callTool(getAllowedTransitions, {
    issueKey: "ADEO-1",
    jql: "x",
  })) as Error & { statusCode: number };
  assert.equal(transitionJql.statusCode, 400);

  const me = tools.get("me")!;
  const unknownIdentity = (await callTool(me, {
    demoUser: "mallory",
  })) as Error & { statusCode: number };
  assert.equal(unknownIdentity.statusCode, 401);

  // Failing tool calls change nothing.
  assert.deepEqual(getIssues(), before);
  resetIssues();
});

test("mcp write tools wrap the REST write contracts 1:1", async () => {
  resetIssues();
  const tools = await loadTools();
  const identity = mcpWriteIdentity("demo-member");

  const createIssueTool = tools.get("createIssue")!;
  const created = (await callTool(createIssueTool, {
    fields: { summary: "MCP-created follow-up", priority: "Highest" },
  })) as { issue: { key: string; fields: { summary: string } } };
  assert.equal(created.issue.key, "ADEO-5");
  assert.equal(created.issue.fields.summary, "MCP-created follow-up");
  // Exact contract parity: the tool result equals the helper result for the
  // same arguments (modulo the deterministic next key).
  resetIssues();
  const direct = await restCreateIssue(identity, {
    fields: { summary: "Parity check" },
  });
  assert.equal(direct.ok, true);
  resetIssues();
  const viaTool = (await callTool(createIssueTool, {
    fields: { summary: "Parity check" },
  })) as unknown;
  assert.deepEqual(viaTool, direct.ok ? direct.data : undefined);

  const updateIssueTool = tools.get("updateIssue")!;
  resetIssues();
  const directUpdate = await restUpdateIssue(identity, "ADEO-1", {
    fields: { summary: "Parity rename" },
  });
  assert.equal(directUpdate.ok, true);
  resetIssues();
  const viaUpdate = await callTool(updateIssueTool, {
    issueKey: "ADEO-1",
    fields: { summary: "Parity rename" },
  });
  assert.deepEqual(viaUpdate, directUpdate.ok ? directUpdate.data : undefined);

  const addCommentTool = tools.get("addComment")!;
  resetIssues();
  const directComment = await restAddComment(identity, "ADEO-1", { body: "Parity note" });
  assert.equal(directComment.ok, true);
  const directId = directComment.ok ? directComment.data.comment.id : "";
  resetIssues();
  const viaComment = (await callTool(addCommentTool, {
    issueKey: "ADEO-1",
    body: "Parity note",
  })) as { comment: { id: string } };
  // Comment ids are sequential on the shared store, so ids agree after reset.
  assert.equal(viaComment.comment.id, directId);

  const transitionTool = tools.get("transitionIssue")!;
  resetIssues();
  const directMove = await restTransitionIssue(identity, "ADEO-1", {
    transition: "demo-in-progress",
  });
  assert.equal(directMove.ok, true);
  const directStatus = directMove.ok ? directMove.data.issue.fields.status.name : "";
  resetIssues();
  const viaMove = (await callTool(transitionTool, {
    issueKey: "ADEO-1",
    transitionId: "demo-in-progress",
  })) as { issue: { fields: { status: { name: string } } } };
  assert.equal(viaMove.issue.fields.status.name, directStatus);

  // Every write result reports the demoFallback identity source: MCP inputs
  // never carry the raw Passport header and never claim Passport auth.
  for (const result of [viaTool, viaUpdate, viaComment, viaMove]) {
    assert.equal(
      (result as { identitySource: unknown }).identitySource,
      "demoFallback",
    );
    assert.equal(
      (result as { actor: { identitySource: unknown } }).actor.identitySource,
      "demoFallback",
    );
  }
  resetIssues();
});

test("mcp write tools enforce permissions and fail closed without writing", async () => {
  resetIssues();
  const tools = await loadTools();
  const before = getIssues();
  const beforeComments = listComments("ADEO-1");

  const createIssueTool = tools.get("createIssue")!;
  const updateIssueTool = tools.get("updateIssue")!;
  const addCommentTool = tools.get("addComment")!;
  const transitionTool = tools.get("transitionIssue")!;

  // Viewer writes are denied on every write tool before any mutation.
  for (const attempt of [
    callTool(createIssueTool, {
      fields: { summary: "Denied" },
      demoUser: "demo-viewer",
    }),
    callTool(updateIssueTool, {
      issueKey: "ADEO-1",
      fields: { summary: "Denied" },
      demoUser: "demo-viewer",
    }),
    callTool(addCommentTool, {
      issueKey: "ADEO-1",
      body: "Denied",
      demoUser: "demo-viewer",
    }),
    callTool(transitionTool, {
      issueKey: "ADEO-1",
      transitionId: "demo-in-progress",
      demoUser: "demo-viewer",
    }),
  ]) {
    const denied = (await attempt) as Error & { statusCode: number };
    assert.equal(denied.statusCode, 403);
    assert.match(denied.message, /Demo-only permission denied/);
    assert.match(denied.message, /Nothing was written/);
  }

  // Unknown/malformed identities fail closed per tool.
  for (const demoUser of ["mallory", "", 42]) {
    const denied = (await callTool(createIssueTool, {
      fields: { summary: "Denied" },
      demoUser,
    })) as Error & { statusCode: number };
    assert.ok([400, 401].includes(denied.statusCode), String(demoUser));
  }

  // Unknown keys, unsupported fields, unknown transitions and blank bodies
  // fail closed on the matching tool.
  const unknownKey = (await callTool(updateIssueTool, {
    issueKey: "ADEO-9999",
    fields: { summary: "Never" },
  })) as Error & { statusCode: number };
  assert.equal(unknownKey.statusCode, 404);

  const unsupported = (await callTool(updateIssueTool, {
    issueKey: "ADEO-1",
    fields: { summary: "x", labels: ["a"] },
  })) as Error & { statusCode: number };
  assert.equal(unsupported.statusCode, 400);
  assert.match(unsupported.message, /Unsupported demoOnly field/);

  const badTransition = (await callTool(transitionTool, {
    issueKey: "ADEO-1",
    transitionId: "demo-archived",
  })) as Error & { statusCode: number };
  assert.equal(badTransition.statusCode, 400);

  const offMatrix = (await callTool(transitionTool, {
    issueKey: "ADEO-2",
    transitionId: "Done",
  })) as Error & { statusCode: number };
  assert.equal(offMatrix.statusCode, 409);

  const blankComment = (await callTool(addCommentTool, {
    issueKey: "ADEO-1",
    body: "   ",
  })) as Error & { statusCode: number };
  assert.equal(blankComment.statusCode, 400);

  // Deterministic failed writes change nothing on every write tool.
  const created = (await callTool(createIssueTool, {
    fields: { summary: "Fail-path target" },
  })) as { issue: { key: string } };
  const targetKey = created.issue.key;
  for (const attempt of [
    callTool(createIssueTool, { fields: { summary: "Never" }, fail: true }),
    callTool(updateIssueTool, {
      issueKey: targetKey,
      fields: { summary: "Never" },
      fail: true,
    }),
    callTool(addCommentTool, {
      issueKey: "ADEO-1",
      body: "Never",
      fail: true,
    }),
    callTool(transitionTool, {
      issueKey: "ADEO-1",
      transitionId: "demo-in-progress",
      fail: true,
    }),
  ]) {
    const failed = (await attempt) as Error & { statusCode: number };
    assert.equal(failed.statusCode, 500);
  }

  // Only the one successful creation plus its target wrote; every denial
  // and every fail path left the rest of the store untouched.
  assert.deepEqual(
    getIssues().map((issue) => issue.key),
    [...before.map((issue) => issue.key), targetKey],
  );
  assert.equal(getIssue(targetKey)?.title, "Fail-path target");
  assert.deepEqual(listComments("ADEO-1"), beforeComments);
  assert.equal(getIssue("ADEO-1")?.status, "To Do");
  resetIssues();
});
