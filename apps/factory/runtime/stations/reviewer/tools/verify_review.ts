import { verificationCommands } from "../../../lib/jira-policy";
import { defineTool } from "eve/tools";
import { useLogger } from "evlog/eve";
import { z } from "zod";
import { requireStation } from "../../../lib/station-access";
import { workState } from "../../../lib/work-state";
import { collectChanges } from "../../../lib/work-changes";
import { commandEvidence, testCountFromOutput } from "../../../lib/command-evidence";
import type { VerificationFinding } from "../../../lib/work-state";
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
  workState.update(s=>({...s,reviewVerified:false,verificationFindings:[]}));
  let baseTestCount:number|undefined;
  for(const [index,check] of verificationCommands(!!pull.files.some(f=>f.filename.startsWith("apps/jira/"))).entries()){
   if(check==="pnpm test"&&state.basePrepared){
    const baseCommand='export PATH="$HOME/.local/bin:$PATH"; cd /workspace/base; pnpm test';
    yield{phase:"Checking pristine base",command:baseCommand};
    const baseGuarded=await runGuardedFactoryOperation({
     operationId:`${ctx.session.id}:base-check:${index}`,
     principal,
     action:"run_check",
     input:{checkId:`base-${checkIds[index]}`,command:check},
     resource:repositoryResource(),
     context:{expectedRevision:pull.baseSha,candidateSha:pull.headSha,baseSha:pull.baseSha,verifiedSha:pull.headSha,branch,lane:"reviewer",budget:0,riskClass:"low",evidence:preparedEvidence},
     execute:()=>sandbox.run({command:baseCommand}),
     isSuccess:result=>result.exitCode===0,
    });
    const baseResult=baseGuarded.output;const baseEvidence=commandEvidence(baseCommand,baseResult);
    baseTestCount=testCountFromOutput(`${baseResult.stdout}\n${baseResult.stderr}`);
    workState.update(s=>({...s,commands:[...s.commands,baseEvidence],contextGaps:baseResult.exitCode===0?s.contextGaps:[...s.contextGaps,`Pristine base pnpm test exited ${baseResult.exitCode}; the baseline count is informational.`]}));
    yield{phase:baseResult.exitCode===0?"Base check passed":"Base check failed",evidence:baseEvidence,testCount:baseTestCount};
   }
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
   const candidateTestCount=check==="pnpm test"?testCountFromOutput(`${result.stdout}\n${result.stderr}`):undefined;
   if(check==="pnpm test"&&state.basePrepared&&(baseTestCount===undefined||candidateTestCount===undefined)){
    const gap=baseTestCount===undefined?"Pristine base pnpm test did not emit a parseable total; test-count comparison is unavailable.":"Candidate pnpm test did not emit a parseable total; test-count comparison is unavailable.";
    workState.update(s=>({...s,contextGaps:s.contextGaps.includes(gap)?s.contextGaps:[...s.contextGaps,gap]}));
    yield{phase:"Test-count comparison unavailable",evidence,baseTestCount,candidateTestCount,limitation:gap};
    return;
   }
   if(check==="pnpm test"&&baseTestCount!==undefined&&candidateTestCount!==undefined&&candidateTestCount<baseTestCount){
    const finding:VerificationFinding={severity:"blocking",path:"pnpm test",message:`Candidate test count (${candidateTestCount}) is lower than the pristine base count (${baseTestCount}).`,evidence:`Base pnpm test reported ${baseTestCount}; candidate pnpm test reported ${candidateTestCount}.`};
    workState.update(s=>({...s,reviewVerified:false,verificationFindings:[...(s.verificationFindings??[]),finding]}));
    log.set({factory:{station:"reviewer",stage:"verify_review",outcome:"failed",check,reason:"test_count_decreased",baseTestCount,candidateTestCount}});
    yield{phase:"Blocking finding",evidence,baseTestCount,candidateTestCount,finding};
    return;
   }
   yield{phase:result.exitCode===0?"Check passed":"Check failed",evidence,testCount:candidateTestCount};if(result.exitCode!==0){log.set({factory:{station:"reviewer",stage:"verify_review",outcome:"failed",check,exitCode:result.exitCode}});return;}
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
