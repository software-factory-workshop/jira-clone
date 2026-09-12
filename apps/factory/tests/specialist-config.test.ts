import test from "node:test";
import assert from "node:assert/strict";
import worker from "../agent/subagents/worker/agent.ts";
import reviewer from "../agent/subagents/reviewer/agent.ts";
test("specialists configure tool policy statically and deny wrong station before model selection",async()=>{
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
