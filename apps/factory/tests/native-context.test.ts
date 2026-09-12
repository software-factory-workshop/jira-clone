import test from "node:test";
import assert from "node:assert/strict";
import { includeSource, manifestFor } from "../agent/lib/github.mjs";
import { commandEvidence } from "../agent/lib/command-evidence.ts";
test("runnable snapshot includes locked and vendored inputs but excludes calibration answers and secrets",()=>{
 for(const path of ["pnpm-lock.yaml","vendor/design-system.tgz","apps/factory/agent/agent.ts","factory/context/goal.md"]) assert.equal(includeSource(path),true,path);
 for(const path of ["factory/mining/evals/answer.md","packages/fx-sandbox-experiment/history/run.json","apps/factory/.env.local",".git/objects/abc"]) assert.equal(includeSource(path),false,path);
});
test("binary source provenance hashes exact bytes",()=>{
 const content=Buffer.from([0,255,12]); const [entry]=manifestFor([{file:"vendor/test.tgz",content}]);
 assert.equal(entry.bytes,3); assert.match(entry.sha256,/^[a-f0-9]{64}$/); assert.notEqual(entry.sha256,manifestFor([{file:"vendor/test.tgz",content:Buffer.from([0,255,13])}])[0].sha256);
});
test("command evidence preserves failure exit code and flags bounded output",()=>{
 const result=commandEvidence("pnpm test",{exitCode:1,stdout:"a".repeat(13000),stderr:"failed"});
 assert.equal(result.exitCode,1);assert.equal(result.truncated,true);assert.equal(result.stdout.length,12000);assert.equal(result.stderr,"failed");
});
