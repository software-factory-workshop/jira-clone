import assert from "node:assert/strict";
import { test } from "node:test";
import { readVercel, latestVercelReads, latestVercelGaps, vercelInput, vercelProjects, vercelTeamId } from "../agent/lib/vercel-context.ts";

test("Vercel inputs cannot supply another team, project ID or URL", () => {
  for (const input of [{project:"other",resource:"project"},{project:"jira",resource:"project",teamId:"other"},{project:"jira",resource:"build_logs",deploymentId:"https://other.vercel.app"}]) assert.equal(vercelInput.safeParse(input).success,false);
});
test("REST queries inject fixed scope, GET, no redirects and explicit recent-page coverage", async () => {
  const fetcher:typeof fetch=async(url,init)=>{
    const target=new URL(String(url));
    assert.equal(target.origin,"https://api.vercel.com");assert.equal(target.pathname,"/v6/deployments");
    assert.equal(target.searchParams.get("projectId"),vercelProjects.jira);assert.equal(target.searchParams.get("teamId"),vercelTeamId);
    assert.equal(init?.method,"GET");assert.equal(init?.redirect,"error");
    return Response.json({deployments:[{uid:"dpl_abc",projectId:vercelProjects.jira}],pagination:{next:10}});
  };
  const receipt=await readVercel({project:"jira",resource:"deployments"},"test-token",undefined,fetcher);
  assert.equal(receipt.complete,true);assert.match(receipt.coverage!,/older deployment history/);
});
test("build logs require deployment ownership before calling log endpoint",async()=>{
  const calls:string[]=[];
  const fetcher:typeof fetch=async(url)=>{calls.push(new URL(String(url)).pathname);return Response.json({id:"dpl_abc",projectId:vercelProjects.cockpit});};
  await assert.rejects(readVercel({project:"jira",resource:"build_logs",deploymentId:"dpl_abc"},"test-token",undefined,fetcher),/does not belong/);
  assert.deepEqual(calls,["/v13/deployments/dpl_abc"]);
});
test("build log requests are bounded and never followed as an infinite stream",async()=>{
  const fetcher:typeof fetch=async(url)=>{
    const target=new URL(String(url));
    if(target.pathname.endsWith("/events")) {assert.equal(target.searchParams.get("follow"),"0");assert.equal(target.searchParams.get("limit"),"100");return Response.json([{type:"stdout",text:"build succeeded"}]);}
    return Response.json({id:"dpl_abc",projectId:vercelProjects.jira});
  };
  const receipt=await readVercel({project:"jira",resource:"build_logs",deploymentId:"dpl_abc"},"test-token",undefined,fetcher);
  assert.equal(receipt.complete,true);assert.equal(receipt.items.length,1);
});
test("runtime logs use verified project path and preserve split stream records",async()=>{
  const fetcher:typeof fetch=async(url,init)=>{
    const target=new URL(String(url));
    if(!target.pathname.endsWith("runtime-logs"))return Response.json({id:"dpl_abc",projectId:vercelProjects.jira});
    assert.equal(target.pathname,`/v1/projects/${vercelProjects.jira}/deployments/dpl_abc/runtime-logs`);
    assert.equal(new Headers(init?.headers).get("Accept"),"application/stream+json");
    return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"level":"in'));c.enqueue(new TextEncoder().encode('fo"}\n{"level":"error"}'));c.close();}}));
  };
  const receipt=await readVercel({project:"jira",resource:"runtime_logs",deploymentId:"dpl_abc"},"test-token",undefined,fetcher);
  assert.equal(receipt.complete,true);assert.deepEqual(receipt.items,[{level:"info"},{level:"error"}]);assert.match(receipt.coverage!,/sample/);
});
test("denied REST access never becomes a successful empty inventory",async()=>{
  await assert.rejects(readVercel({project:"cockpit",resource:"deployments"},"test-token",undefined,async()=>new Response("denied",{status:403})),/HTTP 403/);
});
test("successful retry clears only that resource gap and preserves all evidence", () => {
  const failed={resource:"project",projectId:vercelProjects.jira,complete:false,gap:"Project unavailable"};
  const unrelated={resource:"runtime_logs",projectId:vercelProjects.jira,complete:false,gap:"Logs unavailable"};
  const recovered={resource:"project",projectId:vercelProjects.jira,complete:true};
  const history=[failed,unrelated,recovered];
  assert.deepEqual(latestVercelGaps(history),["Logs unavailable"]);assert.equal(history.length,3);
  assert.equal(latestVercelReads(history).find(r=>r.resource==="project"),recovered);
  assert.deepEqual(latestVercelGaps([...history,failed]),["Project unavailable","Logs unavailable"]);
});
