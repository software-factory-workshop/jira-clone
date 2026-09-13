import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REST_BOUNDARY,
  REST_MAX_MAX_RESULTS,
  restComments,
  restIssue,
  restMyself,
  restProject,
  restProjectStatuses,
  restSearch,
  restTransitions,
} from "../server/utils/jiraRest.ts";
import { getIssues, resetIssues } from "../server/utils/issues.ts";

const here = dirname(fileURLToPath(import.meta.url));
const toolsDir = join(here, "..", "server", "mcp", "tools");

/**
 * Demo-only read-only MCP protocol tests.
 *
 * Each file under `server/mcp/tools/*.ts` calls the Nuxt-injected
 * `defineMcpTool`/`createError` globals and imports the real `zod`. The
 * protocol harness stubs the two Nuxt globals, imports the tool files, and
 * drives every handler directly against the same REST contracts the
 * adapter serves (`restMyself`, `restProject`, `restProjectStatuses`,
 * `restIssue`, `restSearch`, `restComments`, `restTransitions`).
 */

type CapturedTool = {
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
};

const EXPECTED_FILES = [
  "get-allowed-transitions.ts",
  "get-issue.ts",
  "get-project-statuses.ts",
  "get-project.ts",
  "list-comments.ts",
  "list-issues.ts",
  "me.ts",
];

const EXPECTED_NAMES = [
  "getAllowedTransitions",
  "getIssue",
  "getProject",
  "getProjectStatuses",
  "listComments",
  "listIssues",
  "me",
];

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

test("mcp tool surface is exactly the seven read-only demo tools", async () => {
  const files = readdirSync(toolsDir)
    .filter((file) => file.endsWith(".ts"))
    .sort();
  assert.deepEqual(files, EXPECTED_FILES);
  const tools = await loadTools();
  assert.deepEqual([...tools.keys()].sort(), [...EXPECTED_NAMES].sort());
  for (const name of EXPECTED_NAMES) {
    const tool = tools.get(name)!;
    assert.ok(tool, `${name} is registered`);
    assert.equal(tool.annotations?.["readOnlyHint"], true);
    assert.match(String(tool.description), /Demo-only read/i);
    const source = sourceFor(name);
    assert.match(source, /from "zod"/);
    assert.doesNotMatch(source, /updateIssue|createIssue|addComment|resetIssues/);
    assert.doesNotMatch(
      source,
      /defineMcpHandler|defineMcpResource|defineMcpPrompt/,
    );
    assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|DELETE)["']/);
  }
});

test("mcp tools map the REST contracts 1:1 and stay read-only", async () => {
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
  assert.deepEqual(
    await callTool(getIssue, { issueKey: "ADEO-1" }),
    (restIssue("ADEO-1") as { ok: true; data: unknown }).data,
  );

  const listIssues = tools.get("listIssues")!;
  assert.deepEqual(
    await callTool(listIssues, {}),
    (restSearch({}) as { ok: true; data: unknown }).data,
  );
  assert.deepEqual(
    await callTool(listIssues, { startAt: 1, maxResults: 2 }),
    (restSearch({ startAt: "1", maxResults: "2" }) as { ok: true; data: unknown })
      .data,
  );

  const listComments = tools.get("listComments")!;
  assert.deepEqual(
    await callTool(listComments, { issueKey: "ADEO-2" }),
    (restComments("ADEO-2", {}) as { ok: true; data: unknown }).data,
  );

  const getAllowedTransitions = tools.get("getAllowedTransitions")!;
  assert.deepEqual(
    await callTool(getAllowedTransitions, { issueKey: "ADEO-1" }),
    (restTransitions("ADEO-1", {}) as { ok: true; data: unknown }).data,
  );

  // Driving every tool wrote nothing.
  assert.deepEqual(getIssues(), before);
  assert.match(REST_BOUNDARY, /GET-only/);
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
