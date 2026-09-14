import test from "node:test";
import assert from "node:assert/strict";
import { includeSource, manifestFor, verifyGatewayScope, scope } from "../runtime/lib/github.mjs";
import { commandEvidence, testCountFromOutput } from "../runtime/lib/command-evidence.ts";
import { agentBrowserVersion } from "../runtime/lib/factory-config.ts";
test("runnable snapshot includes locked and vendored inputs but excludes calibration answers and secrets",()=>{
 for(const path of ["pnpm-lock.yaml","vendor/design-system.tgz","apps/factory/agents/task-miner/agent/agent.ts","apps/factory/agents/worker/agent/agent.ts","apps/factory/agents/reviewer/agent/agent.ts","apps/factory/runtime/lib/github.mjs","apps/factory/server/workflows/delivery.ts",`vendor/agent-browser-eve-${agentBrowserVersion}-eve.0.52.5.tgz`,"factory/CONTRACT.md"]) assert.equal(includeSource(path),true,path);
 for(const path of ["factory/mining/evals/answer.md","factory/evidence/mining/report.md","packages/fx-sandbox-experiment/history/run.json","apps/factory/.env.local",".git/objects/abc"]) assert.equal(includeSource(path),false,path);
});
test("binary source provenance hashes exact bytes",()=>{
 const content=Buffer.from([0,255,12]); const [entry]=manifestFor([{file:"vendor/test.tgz",content}]);
 assert.equal(entry.bytes,3); assert.match(entry.sha256,/^[a-f0-9]{64}$/); assert.notEqual(entry.sha256,manifestFor([{file:"vendor/test.tgz",content:Buffer.from([0,255,13])}])[0].sha256);
});
test("command evidence preserves failure exit code and flags bounded output",()=>{
 const result=commandEvidence("pnpm test",{exitCode:1,stdout:"a".repeat(13000),stderr:"failed"});
 assert.equal(result.exitCode,1);assert.equal(result.truncated,true);assert.equal(result.stdout.length,12000);assert.equal(result.stderr,"failed");
});

test("test output totals sum package summaries and ignore ordinary test lines",()=>{
 const output="✔ test output mentions tests 3 in prose\n@jira:test: ℹ tests 161\n@factory:test: ℹ tests: 210\n";
 assert.equal(testCountFromOutput(output),371);
 assert.equal(testCountFromOutput("no summary was emitted"),undefined);
});

test("Gateway refuses ambient API keys even with a correctly scoped OIDC token",()=>{
 const claims={owner:scope.team,owner_id:scope.teamId,project_id:scope.projectId,exp:Math.floor(Date.now()/1000)+3600};
 const token=`header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
 assert.doesNotThrow(()=>verifyGatewayScope(token));
 assert.throws(()=>verifyGatewayScope(token,"ambient-key"),/Unset AI_GATEWAY_API_KEY/);
});
