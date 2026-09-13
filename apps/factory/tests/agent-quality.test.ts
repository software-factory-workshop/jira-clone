import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const repositoryRoot = new URL("../../../", import.meta.url);
const paths = {
  policy: new URL("factory/policies/agent-quality.md", repositoryRoot),
  agents: [
    new URL("apps/factory/agents/task-miner/agent/instructions.ts", repositoryRoot),
    new URL("apps/factory/agents/worker/agent/instructions.md", repositoryRoot),
    new URL("apps/factory/agents/reviewer/agent/instructions.md", repositoryRoot),
  ],
};

test("the shared agent contract covers the prompt-quality run shape", async () => {
  const policy = await readFile(paths.policy, "utf8");

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
    assert.match(policy, new RegExp(requiredSection.replace("$", "\\$")), requiredSection);
  }
});

test("every station points to the shared contract and visual communication rule", async () => {
  const instructions = await Promise.all(paths.agents.map((path) => readFile(path, "utf8")));

  for (const content of instructions) {
    assert.match(content, /factory\/policies\/agent-quality\.md/);
    assert.match(content, /\$show-me/);
  }
});
