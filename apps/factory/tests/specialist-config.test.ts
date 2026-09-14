import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import root from "../agents/task-miner/agent/agent.ts";
import worker from "../agents/worker/agent/agent.ts";
import reviewer from "../agents/reviewer/agent/agent.ts";
import { factoryModelLimits } from "../runtime/lib/factory-config.ts";

const agentRoots = ["task-miner", "worker", "reviewer"] as const;

test("each built root includes its stop-after-turn hook entrypoint", () => {
 for (const name of agentRoots) {
  const path = fileURLToPath(new URL(`../agents/${name}/agent/hooks/stop-after-turn.ts`, import.meta.url));
  assert.equal(existsSync(path), true, `${name} root is missing hooks/stop-after-turn.ts`);
 }
});

test("worker root mounts the host browser-evidence hook", () => {
 const path = fileURLToPath(new URL("../agents/worker/agent/hooks/browser-evidence.ts", import.meta.url));
 assert.equal(existsSync(path), true);
});

test("all three root agents use the shared model ceilings",()=>{
 for(const definition of [root,worker,reviewer]){
  assert.deepEqual(definition.limits,factoryModelLimits);
  assert.ok(definition.limits?.maxInputTokensPerSession);
  assert.ok(definition.limits?.maxOutputTokensPerSession);
  assert.ok(definition.limits?.maxTokenCostUsdPerSession);
  assert.equal(definition.limits?.maxInputTokensPerSession,3_000_000);
  assert.equal(definition.limits?.sessionTimeoutMs,20*60*1000);
 }
});
test("Worker and reviewer configure tool policy statically and deny wrong station before model selection",async()=>{
 for(const [name,definition] of [["worker",worker],["reviewer",reviewer]] as const){
  assert.equal(definition.defaultTools,false);
  assert.equal(definition.model.kind,"eve:dynamic");
  const select=definition.model.events["session.started"];
  assert.ok(select);
  for(const attributes of [{},{factoryStation:name==="worker"?"reviewer":"worker"}]){
   await assert.rejects(()=>select({}, {session:{id:"test",auth:{current:null,initiator:{authenticator:"fixture",principalType:"user",principalId:"test",attributes}}},channel:{},messages:[]}),/requires an authenticated/);
  }
 }
});
