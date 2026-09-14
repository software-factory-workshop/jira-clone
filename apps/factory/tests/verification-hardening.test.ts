import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { prepareRepository } from "../runtime/lib/prepare-context.ts";

const root = new URL("../", import.meta.url);
async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("review verification compares a pristine base test total and keeps decreases host-enforced", async () => {
  const context = await source("runtime/lib/prepare-context.ts");
  const prepare = await source("runtime/stations/reviewer/tools/prepare_review.ts");
  const verify = await source("runtime/stations/reviewer/tools/verify_review.ts");
  const record = await source("runtime/stations/reviewer/tools/record_review.ts");

  assert.match(context, /path:`base\/\$\{entry\.file\}`/);
  assert.match(context, /cd \/workspace\/base; node --version; pnpm --version; pnpm install --frozen-lockfile/);
  assert.match(verify, /cd \/workspace\/base; pnpm test/);
  assert.match(verify, /testCountFromOutput\(\`\$\{baseResult\.stdout\}/);
  assert.match(verify, /testCountFromOutput\(\`\$\{result\.stdout\}/);
  assert.match(verify, /severity:"blocking"/);
  assert.match(record, /state\.verificationFindings/);
});

test("worker verification records one fixed base reproduction in command evidence", async () => {
  const context = await source("runtime/lib/prepare-context.ts");
  const prepare = await source("runtime/stations/worker/tools/prepare_work.ts");
  const verify = await source("runtime/stations/worker/tools/verify_work.ts");
  const instructions = await source("agents/worker/agent/instructions.ts");

  assert.match(context, /baseSnapshot/);
  assert.match(prepare, /loadWorkSnapshot\(token,target\.targetHeadSha/);
  assert.match(prepare, /basePrepared:setup\.basePrepared/);
  assert.match(verify, /baseCommand:z\.enum\(namedVerificationCommands\)\.default\("pnpm test"\)/);
  assert.match(verify, /cd \/workspace\/base; '\+baseCommand/);
  assert.match(verify, /commandEvidence\(baseCommandLine,baseResult\)/);
  assert.match(instructions, /one named required check on the pristine/);
});

test("worker publication carries reviewer-configured browser and model evidence", async () => {
  const reviewerAgent = await source("runtime/stations/reviewer/agent.ts");
  const workerPrepare = await source("runtime/stations/worker/tools/prepare_work.ts");
  const workerHook = await source("agents/worker/agent/hooks/browser-evidence.ts");
  const publish = await source("runtime/stations/worker/tools/publish_work.ts");
  const body = await source("runtime/lib/publication-body.ts");

  assert.match(reviewerAgent, /factoryModelIds\.reviewer/);
  assert.match(reviewerAgent, /return factoryModelIds\.reviewer/);
  assert.match(workerPrepare, /reviewBrowser\.update/);
  assert.match(workerHook, /reviewer\/agent\/hooks\/browser-evidence/);
  assert.match(publish, /const browser=reviewBrowser\.get\(\)/);
  assert.match(publish, /const browserEvidence=/);
  assert.match(publish, /browserEvidence/);
  assert.match(body, /## Browser evidence/);
});

test("base preparation records its locked setup in the existing command evidence", async () => {
  const writes: string[] = [];
  const commands: string[] = [];
  const sandbox = {
    writeBinaryFile: async ({ path }: { path: string }) => { writes.push(path); },
    writeTextFile: async ({ path }: { path: string }) => { writes.push(path); },
    run: async ({ command }: { command: string }) => {
      commands.push(command);
      return { exitCode: 0, stdout: "ok", stderr: "" };
    },
  };
  const snapshot = { revision: "a".repeat(40), entries: [{ file: "pnpm-lock.yaml", content: Buffer.from("lock"), mode: "100644" as const }] };
  const result = await prepareRepository(sandbox, "unused", undefined, snapshot, undefined, { ...snapshot, revision: "b".repeat(40) });

  assert.equal(result.basePrepared, true);
  assert.equal(result.commands.length, 2);
  assert.ok(writes.includes("base/pnpm-lock.yaml"));
  assert.match(result.commands[1]!.command, /cd \/workspace\/base; node --version; pnpm --version; pnpm install --frozen-lockfile/);
  assert.ok(commands.some(command => command.includes("cd /workspace/base")));
});

test("browser before/after targets use the exact prepared base and reset continuation state", async () => {
  const browser = await source("runtime/stations/reviewer/tools/prepare_browser.ts");
  const prepare = await source("runtime/stations/reviewer/tools/prepare_review.ts");

  assert.match(browser, /test -d \/workspace\/base; test -f \/workspace\/base\/pnpm-workspace\.yaml/);
  assert.match(browser, /source==='base'\?'\/workspace\/base':'\/workspace\/repo'/);
  assert.doesNotMatch(browser, /review-base/);
  assert.match(prepare, /if\(prior\.prepared\)/);
  assert.match(prepare, /reviewBrowser\.update\(\(\)=>\(\{targets:\{\},sources:\{\},observations:\{\}\}\)\)/);
  assert.match(prepare, /prepareFailure/);
  assert.match(prepare, /do not retry this tool again/);
  assert.match(await source("agents/reviewer/agent/instructions.ts"), /do not call it again in this session/);
});

test("reviewer failure records an explicit cockpit unavailable state", async () => {
  const hook = await source("runtime/stations/reviewer/hooks/incomplete-feedback.ts");
  const cockpit = await source("shared/cockpit.ts");
  const run = await source("app/components/WorkRun.vue");

  assert.match(hook, /reviewUnavailable/);
  assert.match(hook, /No visual packet or GitHub review was published/);
  assert.match(hook, /"turn\.completed"/);
  assert.match(cockpit, /export const reviewUnavailable/);
  assert.match(run, /Visual review unavailable/);
  assert.match(run, /unavailableResult\.limitations/);
});

test("reviewer webhook is restricted to factory-owned pull requests and review actions", async () => {
  const channel = await source("agents/reviewer/agent/channels/github.ts");

  assert.match(channel, /githubChannel/);
  assert.match(channel, /connectGitHubCredentials\(githubConnectorName\)/);
  assert.match(channel, /\["opened", "reopened", "ready_for_review", "synchronize"\]/);
  assert.match(channel, /Factory-Owner:/);
  assert.match(channel, /factory\/work-/);
});
