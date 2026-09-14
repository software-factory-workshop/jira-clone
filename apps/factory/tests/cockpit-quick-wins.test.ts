import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

async function source(path: string) {
  return readFile(join(repositoryRoot, path), "utf8");
}

test("cockpit quick wins keep delivery evidence and operator actions visible", async () => {
  const delivery = await source("apps/factory/app/components/DeliveryLoop.vue");
  const history = await source("apps/factory/app/components/WorkHistory.vue");
  const newDraft = await source("apps/factory/app/components/NewDraftEditor.vue");
  const run = await source("apps/factory/app/components/WorkRun.vue");
  const app = await source("apps/factory/app/app.vue");
  const config = await source("apps/factory/nuxt.config.ts");

  assert.match(delivery, /@select="selectFlowNode"/);
  assert.match(delivery, /entry\.to/);
  assert.match(delivery, /entry\.actor/);
  assert.match(delivery, /entry\.reason/);
  assert.match(delivery, /entry\.receiptId/);
  assert.match(delivery, /Review evidence/);
  assert.match(delivery, /DeliveryStatusSummary/);
  assert.match(delivery, /Limitations/);
  assert.match(delivery, /repositoryChecksPassed/);
  assert.match(delivery, /parentPrNumber/);
  assert.match(delivery, /ownerSessionId/);
  assert.match(delivery, /principalId/);
  assert.match(delivery, /title="Stop this delivery\?"/);
  assert.doesNotMatch(delivery, /window\.confirm/);

  assert.match(history, /need attention/);
  assert.match(history, /orderedRuns/);
  assert.match(history, />Resume</);
  assert.match(history, />Revise</);
  assert.match(history, />Open</);
  assert.match(history, /refreshes automatically/);

  assert.match(newDraft, /title="Start with an idea"/);
  assert.match(newDraft, /origin: origin\.value/);
  assert.match(newDraft, /task mining is optional/);
  assert.match(newDraft, /Retry shared drafts/);

  assert.match(run, /eventToolId/);
  assert.match(run, /Recent event tail/);
  assert.match(run, /tool id/);
  assert.match(run, /:title="`Stop this/);
  assert.doesNotMatch(run, /window\.confirm/);

  assert.match(config, /factorySha: process\.env\.VERCEL_GIT_COMMIT_SHA/);
  assert.match(app, /config\.public\.factorySha/);
});
