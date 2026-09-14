import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("miner records admission before findings and exposes the host tool at the built root", async () => {
  const instructions = await source("runtime/lib/mining-instructions.ts");
  const tool = await source("runtime/tools/record_work_order.ts");
  const reexport = await source("agents/task-miner/agent/tools/record_work_order.ts");
  assert.ok(instructions.indexOf("record_work_order") < instructions.indexOf("record_findings"));
  assert.match(tool, /workOrderAdmissionSchema/);
  assert.match(tool, /return input/);
  assert.match(reexport, /runtime\/tools\/record_work_order/);
});

test("delivery accepts explicit ideas while preserving mined admission and all outcomes", async () => {
  const delivery = await source("runtime/channels/delivery.ts");
  const miningRun = await source("app/components/MiningRun.vue");
  assert.match(delivery, /if\(!input\.draftId\)/);
  assert.match(delivery, /deliveryEntryPoint/);
  assert.match(delivery, /saved operator idea/);
  assert.match(delivery, /draft\.value\.title!==input\.title\|\|draft\.value\.request!==input\.brief/);
  for (const kind of ["work_order", "clarification", "unsupported"]) {
    assert.match(miningRun, new RegExp(`output\\.admission\\.kind === ['"]${kind}['"]`));
  }
});
