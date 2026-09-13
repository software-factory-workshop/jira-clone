import { isDeepStrictEqual } from "node:util";

// Why this is an exact string splice: the worker may author Jira code but not
// dependencies, scripts or configuration. The one integration slice it needs
// (MCP toolkit plus zod, one config registration, the Jira test script) is
// therefore granted as an exact semantic delta validated here, before candidate
// commands run and again before publication. Widening it is a reviewed change
// by the development session, never something a worker can do from inside a run.

export const jiraTestCommand = "node --test tests/*.test.ts";
export const mcpToolkitVersion = "0.21.0";
export const mcpZodVersion = "4.6.1";
const mcpToolkit = "@nuxtjs/mcp-toolkit";
const mcpConfigMarker = '  extends: ["@software-factory-workshop/nuxt-adeo-ds"],\n';
const mcpConfigInsertion = `${mcpConfigMarker}  modules: ["@nuxtjs/mcp-toolkit"],\n  mcp: { name: "ADEO Jira Demo", version: "0.1.0" },\n`;

function parsedManifest(value: string, label: string): Record<string, any> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

function mcpManifestEnabled(manifest: string, label = "Jira manifest") {
  const parsed = parsedManifest(manifest, label);
  return parsed.dependencies?.[mcpToolkit] === mcpToolkitVersion && parsed.dependencies?.zod === mcpZodVersion;
}

export function jiraMcpEnabled(manifest: string, label = "Jira manifest") {
  return mcpManifestEnabled(manifest, label);
}

export function validateJiraMcpChangeSet(paths: Iterable<string>, baselineManifest: string, candidateManifest: string) {
  const changed = new Set(paths);
  const wasEnabled = mcpManifestEnabled(baselineManifest, "Jira manifest baseline");
  const isEnabled = mcpManifestEnabled(candidateManifest, "Jira manifest candidate");
  if (isEnabled && !wasEnabled) {
    for (const required of ["apps/jira/package.json", "apps/jira/nuxt.config.ts", "pnpm-lock.yaml"]) {
      if (!changed.has(required)) throw new Error(`The first MCP integration publication must include ${required}.`);
    }
  }
  if (changed.has("apps/jira/nuxt.config.ts") && !isEnabled) throw new Error("MCP Nuxt registration requires the approved Jira MCP dependencies.");
}

export function validateJiraManifest(baseline: string, candidate: string | null) {
  if (candidate === null) throw new Error("Jira manifest cannot be removed.");
  const before = parsedManifest(baseline, "Jira manifest baseline");
  const after = parsedManifest(candidate, "Jira manifest candidate");
  if (!after.scripts || after.scripts.test !== jiraTestCommand) throw new Error("Only the exact Jira test script is allowed.");

  const beforeDeps = before.dependencies && typeof before.dependencies === "object" ? before.dependencies : {};
  const beforeMcp = beforeDeps[mcpToolkit];
  const beforeZod = beforeDeps.zod;
  if ((beforeMcp === undefined) !== (beforeZod === undefined) || (beforeMcp !== undefined && (beforeMcp !== mcpToolkitVersion || beforeZod !== mcpZodVersion))) {
    throw new Error("Jira manifest baseline has an unsupported MCP dependency state.");
  }

  const expected = structuredClone(before);
  expected.scripts = { ...expected.scripts, test: jiraTestCommand };
  expected.dependencies = { ...beforeDeps };
  if (isDeepStrictEqual(expected, after)) return;
  if (beforeMcp === undefined) {
    expected.dependencies[mcpToolkit] = mcpToolkitVersion;
    expected.dependencies.zod = mcpZodVersion;
    if (isDeepStrictEqual(expected, after)) return;
  }
  throw new Error("Protected Jira manifest fields changed.");
}

export function validateJiraNuxtConfig(baseline: string, candidate: string | null) {
  if (candidate === null) throw new Error("Jira Nuxt config cannot be removed.");
  if (candidate === baseline) return;
  const expected = baseline.includes(mcpConfigInsertion)
    ? baseline
    : baseline.includes(mcpConfigMarker)
      ? baseline.replace(mcpConfigMarker, mcpConfigInsertion)
      : null;
  if (!expected || candidate !== expected) throw new Error("Only the exact read-only MCP Nuxt registration is allowed.");
}

interface TextBlock { key: string; text: string }

function sectionMap(text: string) {
  const matches = [...text.matchAll(/^([A-Za-z][A-Za-z0-9_-]*):\s*\n/gm)];
  return matches.map((match, index) => ({
    name: match[1]!,
    start: match.index!,
    end: matches[index + 1]?.index ?? text.length,
    text: text.slice(match.index! + match[0].length, matches[index + 1]?.index ?? text.length),
  }));
}

function section(text: string, name: string) {
  const found = sectionMap(text).find(entry => entry.name === name);
  if (!found) throw new Error(`Lockfile is missing the ${name} section.`);
  return found;
}

function blocks(text: string, indent = "  "): TextBlock[] {
  const lines = text.split(/(?<=\n)/);
  const starts = lines.flatMap((line, index) => line.startsWith(indent) && !line.startsWith(`${indent} `) && /:\s*(?:\{\})?\s*$/.test(line.trim()) ? [index] : []);
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? lines.length;
    const line = lines[start]!.trim();
    return { key: line.replace(/:\s*(?:\{\})?\s*$/, ""), text: lines.slice(start, end).join("") };
  });
}

function blockMap(text: string, label: string, indent = "  ") {
  const map = new Map<string, string>();
  for (const block of blocks(text, indent)) {
    if (map.has(block.key)) throw new Error(`${label} contains duplicate key ${block.key}.`);
    map.set(block.key, block.text);
  }
  return map;
}

function dependencyBlocks(importer: string) {
  const lines = importer.split(/(?<=\n)/);
  const start = lines.findIndex(line => /^    dependencies:\s*$/.test(line));
  if (start < 0) return new Map<string, string>();
  const end = lines.slice(start + 1).findIndex(line => /^    \S/.test(line));
  const dependencyLines = lines.slice(start + 1, end < 0 ? lines.length : start + 1 + end);
  return blockMap(dependencyLines.join(""), "Jira dependency importer", "      ");
}

function withoutMcpDependencyBlocks(importer: string, allow: Set<string>) {
  const lines = importer.split(/(?<=\n)/);
  const result: string[] = [];
  let inDependencies = false;
  for (let index = 0; index < lines.length;) {
    const line = lines[index]!;
    if (/^    dependencies:\s*$/.test(line)) inDependencies = true;
    else if (inDependencies && /^    \S/.test(line)) inDependencies = false;
    const match = inDependencies ? line.match(/^      (.+):\s*\n?$/) : null;
    const key = match?.[1];
    if (key && allow.has(key)) {
      index++;
      while (index < lines.length && /^        \S/.test(lines[index]!)) index++;
      continue;
    }
    result.push(line);
    index++;
  }
  return result.join("");
}

function validateMcpDependencyBlock(block: string | undefined, key: string) {
  if (!block) throw new Error(`Lockfile is missing Jira dependency ${key}.`);
  const lines = block.trim().split("\n").map(line => line.trim());
  if (key === `'${mcpToolkit}'`) {
    if (lines.length !== 3 || lines[0] !== `'${mcpToolkit}':` || lines[1] !== `specifier: ${mcpToolkitVersion}` || !lines[2]!.startsWith("version: 0.21.0(")) throw new Error("Jira MCP lockfile entry is not pinned to the approved toolkit.");
    return;
  }
  if (lines.length !== 3 || lines[0] !== "zod:" || lines[1] !== `specifier: ${mcpZodVersion}` || lines[2] !== `version: ${mcpZodVersion}`) throw new Error("Jira MCP lockfile entry is not pinned to the approved zod version.");
}

function validateAdditiveSection(baseline: string, candidate: string, label: string, allowAdditions: boolean) {
  const before = blockMap(baseline, `${label} baseline`);
  const after = blockMap(candidate, `${label} candidate`);
  const additions: string[] = [];
  for (const [key, text] of before) {
    if (after.get(key) !== text) throw new Error(`${label} existing block changed: ${key}.`);
  }
  for (const key of after.keys()) {
    if (!before.has(key)) additions.push(key);
  }
  if (!allowAdditions && additions.length) throw new Error(`${label} contains additions without the approved MCP dependency change.`);
  if (additions.length > 64) throw new Error(`${label} contains too many new blocks.`);
  return additions;
}

export function validateJiraLockfile(baseline: string, candidate: string | null, baselineManifest: string, candidateManifest: string) {
  if (candidate === null) throw new Error("Jira lockfile cannot be removed.");
  const baseSections = sectionMap(baseline);
  const candidateSections = sectionMap(candidate);
  if (baseSections.map(entry => entry.name).join("/") !== candidateSections.map(entry => entry.name).join("/")) throw new Error("Lockfile section structure changed.");
  if (baseline.slice(0, baseSections[0]?.start ?? baseline.length) !== candidate.slice(0, candidateSections[0]?.start ?? candidate.length)) throw new Error("Lockfile header changed.");

  const baseImporters = section(baseline, "importers");
  const candidateImporters = section(candidate, "importers");
  const baseImporterBlocks = blockMap(baseImporters.text, "Importer baseline");
  const candidateImporterBlocks = blockMap(candidateImporters.text, "Importer candidate");
  for (const [key, text] of baseImporterBlocks) {
    if (key !== "apps/jira" && candidateImporterBlocks.get(key) !== text) throw new Error(`Protected importer changed: ${key}.`);
  }
  for (const key of candidateImporterBlocks.keys()) {
    if (!baseImporterBlocks.has(key)) throw new Error(`Unexpected importer added: ${key}.`);
  }
  const baseApp = baseImporterBlocks.get("apps/jira");
  const candidateApp = candidateImporterBlocks.get("apps/jira");
  if (!baseApp || !candidateApp) throw new Error("Lockfile is missing the apps/jira importer.");
  const baselineEnabled = mcpManifestEnabled(baselineManifest, "Jira manifest baseline");
  const candidateEnabled = mcpManifestEnabled(candidateManifest, "Jira manifest candidate");
  const additionsAllowed = !baselineEnabled && candidateEnabled;
  const allowedImporterEntries = additionsAllowed ? new Set([`'${mcpToolkit}'`, "zod"]) : new Set<string>();
  if (withoutMcpDependencyBlocks(candidateApp, allowedImporterEntries) !== withoutMcpDependencyBlocks(baseApp, new Set())) throw new Error("Protected apps/jira lockfile importer fields changed.");
  const baseDeps = dependencyBlocks(baseApp);
  const candidateDeps = dependencyBlocks(candidateApp);
  if (additionsAllowed) {
    validateMcpDependencyBlock(candidateDeps.get(`'${mcpToolkit}'`), `'${mcpToolkit}'`);
    validateMcpDependencyBlock(candidateDeps.get("zod"), "zod");
    if (baseDeps.has(`'${mcpToolkit}'`) || baseDeps.has("zod")) throw new Error("MCP importer entries already exist in the lockfile baseline.");
  } else if (candidateDeps.get(`'${mcpToolkit}'`) !== baseDeps.get(`'${mcpToolkit}'`) || candidateDeps.get("zod") !== baseDeps.get("zod")) {
    throw new Error("MCP importer entries changed without the approved manifest transition.");
  }

  const packageAdditions = validateAdditiveSection(section(baseline, "packages").text, section(candidate, "packages").text, "Package lockfile", additionsAllowed);
  const snapshotAdditions = validateAdditiveSection(section(baseline, "snapshots").text, section(candidate, "snapshots").text, "Snapshot lockfile", additionsAllowed);
  if (additionsAllowed && (!packageAdditions.some(key => key.includes("@nuxtjs/mcp-toolkit@0.21.0")) || !snapshotAdditions.some(key => key.includes("@nuxtjs/mcp-toolkit@0.21.0")))) throw new Error("MCP lockfile additions are incomplete.");

  for (const entry of baseSections) {
    if (["importers", "packages", "snapshots"].includes(entry.name)) continue;
    const candidateEntry = candidateSections.find(other => other.name === entry.name);
    if (!candidateEntry || candidate.slice(candidateEntry.start, candidateEntry.end) !== baseline.slice(entry.start, entry.end)) throw new Error(`Protected lockfile section changed: ${entry.name}.`);
  }
}

export function jiraManifest(entries: Array<{ file: string; content: Buffer }>) {
  return entries.find(entry => entry.file === "apps/jira/package.json")?.content.toString() || "";
}

export function jiraNuxtConfig(entries: Array<{ file: string; content: Buffer }>) {
  return entries.find(entry => entry.file === "apps/jira/nuxt.config.ts")?.content.toString() || "";
}

export function jiraLockfile(entries: Array<{ file: string; content: Buffer }>) {
  return entries.find(entry => entry.file === "pnpm-lock.yaml")?.content.toString() || "";
}

export function verificationCommands(jiraChanged: boolean) {
  return ["pnpm typecheck", "pnpm test", ...(jiraChanged ? ["pnpm --filter @jira-clone/jira test"] : []), "pnpm build"];
}
