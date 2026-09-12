import assert from "node:assert/strict";
import { test } from "node:test";
import { readVercel, latestVercelReads, latestVercelGaps, vercelInput, vercelProjects, vercelTeamId, type EvidenceClient } from "../agent/lib/vercel-context.ts";
const result = (value: unknown) => ({ structuredContent: value });
const tools = new Set(["get_project", "list_deployments", "get_deployment", "get_deployment_build_logs"]);

test("Vercel inputs cannot supply another team, project ID or URL", () => {
  for (const input of [
    {project:"other",resource:"project"},
    {project:"jira",resource:"project",teamId:"other"},
    {project:"jira",resource:"build_logs",deploymentId:"https://other.vercel.app"},
  ]) assert.equal(vercelInput.safeParse(input).success,false);
});
test("Vercel queries inject fixed scope and retain incomplete pagination", async () => {
  const client:EvidenceClient={tools,call:async(name,args)=>{
    assert.equal(name,"list_deployments");
    assert.deepEqual(args,{projectId:vercelProjects.jira,teamId:vercelTeamId});
    return result({deployments:[{id:"dpl_abc",projectId:vercelProjects.jira}],pagination:{next:10}});
  }};
  const receipt=await readVercel({project:"jira",resource:"deployments"},client);
  assert.equal(receipt.complete,false);
  assert.match(receipt.gap!,/older deployments/);
});
test("build logs require deployment ownership before calling log tool",async()=>{
  const calls:string[]=[];
  const client:EvidenceClient={tools,call:async(name)=>{calls.push(name);return result({id:"dpl_abc",projectId:vercelProjects.cockpit});}};
  await assert.rejects(readVercel({project:"jira",resource:"build_logs",deploymentId:"dpl_abc"},client),/does not belong/);
  assert.deepEqual(calls,["get_deployment"]);
});
test("unsupported runtime logs stay a context gap without a remote call",async()=>{
  const receipt=await readVercel({project:"jira",resource:"runtime_logs"},{tools,call:async()=>{throw Error("must not call");}});
  assert.equal(receipt.complete,false);assert.deepEqual(receipt.items,[]);assert.match(receipt.gap!,/not verified/);
});
test("MCP failures are not successful empty inventories",async()=>{
  await assert.rejects(readVercel({project:"cockpit",resource:"deployments"},{tools,call:async()=>({isError:true,content:[]})}),/returned an error/);
});

test("successful retry clears only that resource gap and preserves all evidence", () => {
  const failed={resource:"project",projectId:vercelProjects.jira,complete:false,gap:"Project unavailable"};
  const unrelated={resource:"runtime_logs",projectId:vercelProjects.jira,complete:false,gap:"Logs unavailable"};
  const recovered={resource:"project",projectId:vercelProjects.jira,complete:true};
  const history=[failed,unrelated,recovered];
  assert.deepEqual(latestVercelGaps(history),["Logs unavailable"]);
  assert.equal(history.length,3);
  assert.equal(latestVercelReads(history).find(r=>r.resource==="project"),recovered);
  assert.deepEqual(latestVercelGaps([...history,failed]),["Project unavailable","Logs unavailable"]);
});
