import { verificationCommands } from "../../../lib/jira-policy";
import { defineTool } from "eve/tools";
import { useLogger } from "evlog/eve";
import { z } from "zod";
import { requireStation } from "../../../lib/station-access";
import { workState } from "../../../lib/work-state";
import { collectChanges,changesDigest } from "../../../lib/work-changes";
import { commandEvidence } from "../../../lib/command-evidence";
import { changeResource, repositoryResource } from "../../../lib/cedar/model.ts";
import { factoryPrincipalFromStation, runGuardedFactoryOperation } from "../../../lib/cedar/guard.ts";
import { workBranch } from "../../../lib/work-github";
const namedVerificationCommands=["pnpm typecheck","pnpm test","pnpm --filter @jira-clone/jira test","pnpm build"] as const;
export default defineTool({description:"Run the required typecheck, tests and build against the current source changes, plus one named check on the pristine base; records evidence required before publication. Call after edits are finished.",inputSchema:z.object({baseCommand:z.enum(namedVerificationCommands).default("pnpm test").describe("Run this one named verification command on the pristine /workspace/base copy before checking the candidate.")}).strict(),
 async *execute({baseCommand},ctx){
  requireStation(ctx,"worker");const log=useLogger(ctx);const state=workState.get();if(!state.prepared)throw new Error("Prepare workspace first.");
  if(!state.basePrepared)throw new Error("Pristine base workspace is unavailable; prepare_work again.");
  const sandbox=await ctx.getSandbox();const changes=await collectChanges(sandbox,state.baseline,false,state.jiraManifest,state.jiraNuxtConfig,state.jiraLockfile);const digest=changesDigest(changes);
  const principal=factoryPrincipalFromStation(ctx,"worker");
  const branch=workBranch(ctx.session.id);
  const preparedEvidence={id:`prepare:${state.operationId}`,source:"factory.prepare_work",complete:true,candidateSha:digest};
  const checks=verificationCommands(changes.some(c=>c.path.startsWith("apps/jira/")));
  if(!checks.includes(baseCommand))throw new Error(`Base reproduction must use one of the required checks for this change: ${checks.join(", ")}.`);
  const checkIds=checks.map(check=>check.replace(/[^A-Za-z0-9_.-]+/g,"_").slice(0,160));
  workState.update(s=>({...s,verifiedDigest:null}));
  const baseCommandLine='export PATH="$HOME/.local/bin:$PATH"; cd /workspace/base; '+baseCommand;
  yield{phase:"Reproducing on pristine base",command:baseCommand};
  const baseGuarded=await runGuardedFactoryOperation({
   operationId:`${state.operationId}:base-reproduction`,
   principal,
   action:"run_check",
   input:{checkId:`base-${baseCommand.replace(/[^A-Za-z0-9_.-]+/g,"_").slice(0,160)}`,command:baseCommand},
   resource:repositoryResource(),
   context:{expectedRevision:state.revision,candidateSha:digest,baseSha:state.targetHeadSha,verifiedSha:digest,branch,lane:"worker",budget:0,riskClass:"low",evidence:preparedEvidence},
   execute:()=>sandbox.run({command:baseCommandLine}),
   isSuccess:result=>result.exitCode===0,
  });
  const baseResult=baseGuarded.output;const baseEvidence=commandEvidence(baseCommandLine,baseResult);
  workState.update(s=>({...s,commands:[...s.commands,baseEvidence]}));
  yield{phase:baseResult.exitCode===0?"Base reproduction passed":"Base reproduction failed",command:baseCommand,evidence:baseEvidence};
  for(const [index,check] of checks.entries()){
   yield{phase:"Checking work",command:check};
   const command='export PATH="$HOME/.local/bin:$PATH"; cd /workspace/repo; '+check;
   const guarded=await runGuardedFactoryOperation({
    operationId:`${state.operationId}:check:${index}`,
    principal,
    action:"run_check",
    input:{checkId:checkIds[index],command:check},
    resource:repositoryResource(),
    context:{expectedRevision:state.revision,candidateSha:digest,baseSha:state.revision,verifiedSha:digest,branch,lane:"worker",budget:0,riskClass:"low",evidence:preparedEvidence},
    execute:()=>sandbox.run({command}),
    isSuccess:result=>result.exitCode===0,
   });
   const result=guarded.output;const evidence=commandEvidence(command,result);
   workState.update(s=>({...s,commands:[...s.commands,evidence]}));
   yield{phase:result.exitCode===0?"Check passed":"Check failed",evidence};
   if(result.exitCode!==0){log.set({factory:{station:"worker",stage:"verify_work",outcome:"failed",check,exitCode:result.exitCode}});return;}
  }
  if(changesDigest(await collectChanges(sandbox,state.baseline,false,state.jiraManifest,state.jiraNuxtConfig,state.jiraLockfile))!==digest)throw new Error("Source changed during verification; inspect generated changes and verify again.");
  const verification=await runGuardedFactoryOperation({
   operationId:`${state.operationId}:record-verification`,
   principal,
   action:"record_verification",
   input:{checkIds,outcome:"passed",evidenceId:`verify:${state.operationId}:${digest}`},
   resource:changeResource({id:state.operationId,taskId:state.operationId,candidateSha:digest,baseSha:state.revision,branch,expectedRevision:state.revision}),
   context:{expectedRevision:state.revision,candidateSha:digest,baseSha:state.revision,verifiedSha:digest,branch,lane:"worker",budget:0,riskClass:"low",evidence:{id:`verify:${state.operationId}:${digest}`,source:"factory.verify_work",complete:true,candidateSha:digest}},
   execute:async()=>{workState.update(s=>({...s,verifiedDigest:digest}));return true;},
   isSuccess:result=>result===true,
  });
  log.set({factory:{station:"worker",stage:"verify_work",outcome:"passed",checkCount:verificationCommands(changes.some(c=>c.path.startsWith("apps/jira/"))).length,changedFileCount:changes.length}});
  yield{phase:"Work verified",files:changes.map(c=>c.path),authorization:verification.audit};
 }});
