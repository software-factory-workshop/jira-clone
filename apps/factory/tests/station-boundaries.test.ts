import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp,mkdir,writeFile,rm,symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { MIN_WORK_REQUEST_LENGTH, stationOf,requireStation,stationRequest,workerRequest } from "../runtime/lib/station-access.ts";
import { collectChangesCommand,validateCollectedChanges,changesDigest } from "../runtime/lib/work-changes.ts";
import { approvalBlockers, hostReviewLimitations } from "../runtime/lib/review-policy.ts";
const op="22222222-2222-4222-8222-222222222222";
test("station privileges come only from immutable initiator auth, not current delivery",()=>{
 const spoof={session:{auth:{initiator:{attributes:{}},current:{attributes:{factoryStation:"worker"}}}}};
 assert.equal(stationOf(spoof),null);assert.throws(()=>requireStation(spoof,"worker"));
 const review={session:{auth:{initiator:{attributes:{factoryStation:"reviewer",factoryRequest:JSON.stringify({operationId:op,prNumber:3})}}}}};
 assert.throws(()=>requireStation(review,"worker"));assert.deepEqual(stationRequest(review),{operationId:op,prNumber:3});
 assert.throws(()=>workerRequest.parse({operationId:op,title:"Task",brief:"A bounded requested task",factoryStation:"worker"}));
 assert.throws(()=>workerRequest.parse({operationId:op,title:"Task",brief:"x".repeat(MIN_WORK_REQUEST_LENGTH - 1)}));
});
test("change collector finds edits additions deletions and ignores unchanged binary files",async()=>{
 const root=await mkdtemp(join(tmpdir(),"station-diff-"));
 try{
  await mkdir(join(root,"apps/factory/app"),{recursive:true});
  await writeFile(join(root,"apps/factory/app/edit.ts"),"after");await writeFile(join(root,"apps/factory/app/new.ts"),"new");await writeFile(join(root,"apps/factory/app/same.png"),Buffer.from([0,1,2]));
  const hash=(x:string|Buffer)=>createHash("sha256").update(x).digest("hex");
  const baseline=[{file:"apps/factory/app/edit.ts",sha256:hash("before")},{file:"apps/factory/app/deleted.ts",sha256:hash("gone")},{file:"apps/factory/app/same.png",sha256:hash(Buffer.from([0,1,2]))}];
  const values=JSON.parse(execFileSync("sh",["-c",collectChangesCommand(baseline,root)],{encoding:"utf8"}));
  const changes=validateCollectedChanges(values);assert.deepEqual(changes,[{path:"apps/factory/app/deleted.ts",content:null},{path:"apps/factory/app/edit.ts",content:"after"},{path:"apps/factory/app/new.ts",content:"new"}]);
  assert.notEqual(changesDigest(changes),changesDigest([{path:"apps/factory/app/edit.ts",content:"different"}]));
  await symlink("/etc/passwd",join(root,"escape"));assert.throws(()=>execFileSync("sh",["-c",collectChangesCommand(baseline,root)],{stdio:"pipe"}));
 }finally{await rm(root,{recursive:true,force:true});}
});
test("change collector ignores generated SWC output created by a reviewer build",async()=>{
 const root=await mkdtemp(join(tmpdir(),"station-diff-swc-"));
 try{
  await mkdir(join(root,".swc","plugins"),{recursive:true});
  await writeFile(join(root,".swc","plugins","generated.wasm"),Buffer.from([0,1,2,3]));
  await writeFile(join(root,"README.md"),"baseline");
  const hash=createHash("sha256").update("baseline").digest("hex");
  const values=JSON.parse(execFileSync("sh",["-c",collectChangesCommand([{file:"README.md",sha256:hash}],root)],{encoding:"utf8"}));
  assert.deepEqual(values,[]);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("protected policy or validation edits cannot reach verification/publication",()=>{
 for(const path of ["AGENTS.md","apps/factory/agent/instructions.ts","package.json","apps/factory/package.json",".github/workflows/ci.yml","factory/context/goal.md","../escape"]){assert.throws(()=>validateCollectedChanges([{path,content:"changed"}]),path);}
 assert.throws(()=>validateCollectedChanges([{path:"apps/factory/app/x.ts",content:"a"},{path:"apps/factory/app/x.ts",content:"b"}]));
});
test("model cannot reclassify required UI evidence to obtain approval",()=>{
 const files=[{filename:"apps/factory/app/components/ProposalFeedback.vue"}];
 assert.deepEqual(hostReviewLimitations(files),[
  "Required host evidence missing: exercise the changed UI in a real browser.",
  "Required host evidence missing: verify keyboard accessibility for the changed UI.",
 ]);
 const blockers=approvalBlockers({prepared:true,repositoryChecksPassed:true,hasBlockingFinding:false,contextGaps:[],modelLimitations:[],files});
 assert.deepEqual(blockers,hostReviewLimitations(files));
 assert.equal(hostReviewLimitations([{filename:"docs/removed-component.md",previous_filename:"apps/jira/app/components/Board.vue"}]).length,2);
 assert.deepEqual(approvalBlockers({prepared:true,repositoryChecksPassed:true,hasBlockingFinding:false,contextGaps:[],modelLimitations:[],files:[{filename:"docs/review.md"}]}),[]);
});
