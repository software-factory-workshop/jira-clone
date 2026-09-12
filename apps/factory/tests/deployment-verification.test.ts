import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deploymentStatus } from "../scripts/verify-vercel-status.mjs";
import { verifyNativeOutput } from "../scripts/verify-native-output.mjs";
const sha = "a".repeat(40);
const statuses = ["adeo-factory-cockpit", "adeo-jira-clone"].map(project => ({ context: `Vercel – ${project}`, state: "success", target_url: `https://vercel.com/demo-software-factory/${project}/deployment` }));
test("deployment proof requires the exact commit and both fixed team/project statuses", () => {
  assert(deploymentStatus({sha,statuses},sha).every(status=>status.state==="success"));
  assert.equal(deploymentStatus({sha,statuses:statuses.slice(0,1)},sha)[1].state,"pending");
  assert.throws(()=>deploymentStatus({sha:"b".repeat(40),statuses},sha),/different revision/);
  assert.throws(()=>deploymentStatus({sha,statuses:[{...statuses[0],target_url:"https://vercel.com/other-team/project/deployment"}]},sha),/Unexpected/);
  assert.equal(deploymentStatus({sha,statuses:[{...statuses[0],state:"error"},statuses[1]]},sha)[0].state,"error");
});
test("native output check requires a Workflow function and catches hidden fx copies",async()=>{
  const directory=await mkdtemp(join(tmpdir(),"eve-output-check-"));
  try {
    await assert.rejects(verifyNativeOutput(directory));
    const workflow=join(directory,"functions/.well-known/workflow/v1/flow.func");
    await mkdir(workflow,{recursive:true});await writeFile(join(directory,"config.json"),"{}");await writeFile(join(workflow,".vc-config.json"),"{}");
    await verifyNativeOutput(directory);
    await writeFile(join(workflow,"ai-sdk__harness-acp.mjs"),"export {};");
    await assert.rejects(verifyNativeOutput(directory),/Experimental fx/);
  } finally {await rm(directory,{recursive:true,force:true});}
});
