import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function filesUnder(directory: string): Promise<string[]> {
 const entries = await readdir(directory, { withFileTypes: true });
 const files: string[] = [];
 for (const entry of entries) {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) files.push(...await filesUnder(path));
  else if (entry.isFile()) files.push(path);
 }
 return files;
}

function withoutExternalUrls(value: string) {
 return value.replace(/https?:\/\/\S+/gi, "");
}

test("agent-facing text matches the current factory contract", async () => {
 const instructionFiles = (await filesUnder(join(repositoryRoot, "apps/factory/agents")))
  .filter(path => /^instructions.*\.ts$/i.test(basename(path)));
 const skillFiles = await filesUnder(join(repositoryRoot, ".agents/skills"));
 const paths = [
  join(repositoryRoot, "factory/CONTRACT.md"),
  join(repositoryRoot, "apps/factory/shared/agent-quality.ts"),
  ...instructionFiles,
  ...skillFiles,
 ];
 const forbidden = [
  ["AGENTS.md", /AGENTS\.md/i],
  ["factory/context", /factory\/context/i],
  ["docs/", /docs\//i],
  ["frog", /\bfrog\b/i],
  ["gh pr", /\bgh\s+pr\b/i],
  ["git fetch", /\bgit\s+fetch\b/i],
  ["npm install", /\bnpm\s+install\b/i],
  ["force-push", /force-push/i],
 ] as const;

 for (const path of paths) {
  const text = withoutExternalUrls(await readFile(path, "utf8"));
  for (const [label, pattern] of forbidden) {
   assert.doesNotMatch(text, pattern, `${relative(repositoryRoot, path)} contains stale ${label} guidance`);
  }
 }

 const workerInstructions = await readFile(join(repositoryRoot, "apps/factory/agents/worker/agent/instructions.ts"), "utf8");
 assert.doesNotMatch(workerInstructions, /MiningRun\.vue/);
 assert.match(workerInstructions, /ProposalFeedback\.vue/);

 const readme = await readFile(join(repositoryRoot, "README.md"), "utf8");
 assert.doesNotMatch(readme, /browser-local|Draft storage is local to a browser|\|\s*`docs`\s*\|/i);
 assert.match(readme, /shared, versioned cockpit storage/i);
});
