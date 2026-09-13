import { verificationCommands } from "../../../lib/jira-policy";
import { defineTool } from "eve/tools";
import { useLogger } from "evlog/eve";
import { z } from "zod";
import { requireStation } from "../../../lib/station-access";
import { workState } from "../../../lib/work-state";
import { collectChanges } from "../../../lib/work-changes";
import { commandEvidence } from "../../../lib/command-evidence";
import { changeResource, repositoryResource } from "../../../lib/cedar/model.ts";
import { factoryPrincipalFromStation, runGuardedFactoryOperation } from "../../../lib/cedar/guard.ts";
export default defineTool({description:"Independently run mandatory typecheck, tests and build on the unchanged pinned PR candidate. Required before an approve verdict.",inputSchema:z.object({}),
 async *execute(_,ctx){
  requireStation(ctx,"reviewer");const log=useLogger(ctx);const state=workState.get();if(!state.prepared)throw new Error("Prepare review first.");
  const sandbox=await ctx.getSandbox();
  if((await collectChanges(sandbox,state.baseline,true,state.jiraManifest,state.jiraNuxtConfig,state.jiraLockfile)).length)throw new Error("Review candidate was edited; start a fresh independent review.");
  const pull=state.pull;if(!pull)throw new Error("Prepare review first.");
  const principal=factoryPrincipalFromStation(ctx,"reviewer");
  const branch=pull.targetBranch||"main";
  const preparedEvidence={id:`prepare:${ctx.session.id}:${pull.headSha}`,source:"factory.prepare_review",complete:true,candidateSha:pull.headSha};
  const checkIds=verificationCommands(!!pull.files.some(f=>f.filename.startsWith("apps/jira/"))).map(check=>check.replace(/[^A-Za-z0-9_.-]+/g,"_").slice(0,160));
  workState.update(s=>({...s,reviewVerified:false}));
  for(const [index,check] of verificationCommands(!!pull.files.some(f=>f.filename.startsWith("apps/jira/"))).entries()){
   yield{phase:"Checking candidate",command:check};
   const command='export PATH="$HOME/.local/bin:$PATH"; cd /workspace/repo; '+check;
   const guarded=await runGuardedFactoryOperation({
    operationId:`${ctx.session.id}:check:${index}`,
    principal,
    action:"run_check",
    input:{checkId:checkIds[index],command:check},
    resource:repositoryResource(),
    context:{expectedRevision:pull.headSha,candidateSha:pull.headSha,baseSha:pull.baseSha,verifiedSha:pull.headSha,branch,lane:"reviewer",budget:0,riskClass:"low",evidence:preparedEvidence},
    execute:()=>sandbox.run({command}),
    isSuccess:result=>result.exitCode===0,
   });
   const result=guarded.output;const evidence=commandEvidence(command,result);
   workState.update(s=>({...s,commands:[...s.commands,evidence]}));
   yield{phase:result.exitCode===0?"Check passed":"Check failed",evidence};if(result.exitCode!==0){log.set({factory:{station:"reviewer",stage:"verify_review",outcome:"failed",check,exitCode:result.exitCode}});return;}
  }
  if((await collectChanges(sandbox,state.baseline,true,state.jiraManifest,state.jiraNuxtConfig,state.jiraLockfile)).length)throw new Error("Candidate changed during verification; review cannot approve modified source.");
  const verification=await runGuardedFactoryOperation({
   operationId:`${ctx.session.id}:record-verification`,
   principal,
   action:"record_verification",
   input:{checkIds,outcome:"passed",evidenceId:`verify:${ctx.session.id}:${pull.headSha}`},
   resource:changeResource({id:String(pull.number),taskId:ctx.session.id,candidateSha:pull.headSha,baseSha:pull.baseSha,branch,expectedRevision:pull.headSha}),
   context:{expectedRevision:pull.headSha,candidateSha:pull.headSha,baseSha:pull.baseSha,verifiedSha:pull.headSha,branch,lane:"reviewer",budget:0,riskClass:"low",evidence:{id:`verify:${ctx.session.id}:${pull.headSha}`,source:"factory.verify_review",complete:true,candidateSha:pull.headSha}},
   execute:async()=>{workState.update(s=>({...s,reviewVerified:true}));return true;},
   isSuccess:result=>result===true,
  });
  log.set({factory:{station:"reviewer",stage:"verify_review",outcome:"passed",checkCount:verificationCommands(!!pull.files.some(f=>f.filename.startsWith("apps/jira/"))).length,headSha:pull.headSha}});
  yield{phase:"Candidate verified",headSha:pull.headSha,authorization:verification.audit};
 }});
