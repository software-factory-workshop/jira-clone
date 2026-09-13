import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import root from "../agents/task-miner/agent/agent.ts";
import worker from "../agents/worker/agent/agent.ts";
import reviewer from "../agents/reviewer/agent/agent.ts";

const agentRoots = ["task-miner", "worker", "reviewer"] as const;

test("each built root includes its stop-after-turn hook entrypoint", () => {
 for (const name of agentRoots) {
  const path = fileURLToPath(new URL(`../agents/${name}/agent/hooks/stop-after-turn.ts`, import.meta.url));
  assert.equal(existsSync(path), true, `${name} root is missing hooks/stop-after-turn.ts`);
 }
});

test("All three root agents model usage are uncapped",()=>{
 for(const definition of [root,worker,reviewer]){
  assert.deepEqual(definition.limits,{maxInputTokensPerSession:false,maxOutputTokensPerSession:false,maxTokenCostUsdPerSession:false});
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
