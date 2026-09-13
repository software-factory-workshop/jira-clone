import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import taskMinerInstructions from "../agents/task-miner/agent/instructions.ts";
import workerInstructions from "../agents/worker/agent/instructions.ts";
import reviewerInstructions from "../agents/reviewer/agent/instructions.ts";
import { agentQualityInstructions } from "../shared/agent-quality.ts";

const repositoryRoot = new URL("../../../", import.meta.url);
const paths = {
  policy: new URL("factory/policies/agent-quality.md", repositoryRoot),
  shared: new URL("apps/factory/shared/agent-quality.ts", repositoryRoot),
  agents: [
    new URL("apps/factory/agents/task-miner/agent/instructions.ts", repositoryRoot),
    new URL("apps/factory/agents/worker/agent/instructions.ts", repositoryRoot),
    new URL("apps/factory/agents/reviewer/agent/instructions.ts", repositoryRoot),
  ],
};

const stationDefinitions = [taskMinerInstructions, workerInstructions, reviewerInstructions];

test("the importable contract mirrors the trusted policy", async () => {
  const policy = (await readFile(paths.policy, "utf8")).trim();
  const shared = await readFile(paths.shared, "utf8");

  assert.equal(agentQualityInstructions, policy);
  assert.match(shared, /composeAgentInstructions/);
  for (const requiredSection of [
    "Trigger and input",
    "Owned outcome",
    "Available capabilities",
    "Missing-capability fallback",
    "Done criteria",
    "Final receipt",
    "Evidence language",
    "Completion criteria",
    "Worked example",
    "$show-me",
  ]) {
    assert.ok(agentQualityInstructions.includes(requiredSection), requiredSection);
  }
});

test("every station composes the shared contract in a TypeScript instruction module", async () => {
  const sources = await Promise.all(paths.agents.map((path) => readFile(path, "utf8")));

  for (const source of sources) {
    assert.match(source, /defineInstructions/);
    assert.match(source, /composeAgentInstructions/);
    assert.doesNotMatch(source, /factory\/policies\/agent-quality\.md/);
    assert.doesNotMatch(source, /instructions\.md/);
  }

  for (const definition of stationDefinitions) {
    assert.match(definition.content, /# Agent quality contract/);
    assert.match(definition.content, /\$show-me/);
    assert.match(definition.content, /The station instructions embed this contract at build time/);
  }
});
