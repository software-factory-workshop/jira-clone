import { defineTool } from "eve/tools";
import { useLogger } from "evlog/eve";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { requireStation,stationRequest,workerRequest,currentRevision } from "../../../lib/station-access";
import { workState } from "../../../lib/work-state";
import { collectChanges,changesDigest } from "../../../lib/work-changes";
import { publicationBody } from "../../../lib/publication-body";
import { verificationCommands } from "../../../lib/jira-policy";
import { publishWork,workBranch } from "../../../lib/work-github";
import { changeResource } from "../../../lib/cedar/model.ts";
import { factoryPrincipalFromStation,runGuardedFactoryOperation } from "../../../lib/cedar/guard.ts";
export default defineTool({description:"Publish verified source changes as one draft pull request on a host-chosen feature branch. No merge. Protected policy/agent/workflow files cannot be published.",inputSchema:z.object({summary:z.string().min(10).max(3000).describe("Explain the final diff and why it matters to a reviewer. Use short paragraphs; omit task prompts, revision history, commands and session metadata."),limitations:z.array(z.string()).max(10)}).strict(),
 async execute(input,ctx){
  requireStation(ctx,"worker");const log=useLogger(ctx);const state=workState.get();const request=workerRequest.parse(stationRequest(ctx));
  if(!state.prepared)throw new Error("Prepare worker workspace first.");
  const operationId=currentRevision(ctx)?.operationId||request.operationId;
  if(state.completedOperations?.[operationId]){log.set({factory:{station:"worker",stage:"publish_work",outcome:"already_published",operationId}});return state.completedOperations[operationId];}
  if(operationId!==state.operationId)throw new Error("Prepare this authenticated operation before publishing.");
  const changes=await collectChanges(await ctx.getSandbox(),state.baseline,false,state.jiraManifest,state.jiraNuxtConfig,state.jiraLockfile);
  const candidateDigest=changesDigest(changes);
  if(!state.verifiedDigest||candidateDigest!==state.verifiedDigest)throw new Error("Current source changes must pass verify_work before publication.");
  const branch=workBranch(ctx.session.id);
  const principal=factoryPrincipalFromStation(ctx,"worker");
  const evidenceId=`verify:${state.operationId}:${candidateDigest}`;
  const authorized=await runGuardedFactoryOperation({
   operationId:`${state.operationId}:publish`,
   principal,
   action:"publish_change",
   input:{branch,candidateSha:candidateDigest,baseSha:state.revision,draft:true},
   resource:changeResource({id:state.operationId,taskId:state.operationId,candidateSha:candidateDigest,baseSha:state.revision,branch,expectedRevision:state.revision}),
   context:{expectedRevision:state.revision,candidateSha:candidateDigest,baseSha:state.revision,verifiedSha:candidateDigest,branch,lane:"worker",budget:0,riskClass:"low",evidence:{id:evidenceId,source:"factory.verify_work",complete:true,candidateSha:candidateDigest}},
   execute:async()=>{
    const token=await getToken("github/jira-clone",{subject:{type:"app"}});
    const publication=await publishWork(token,{sessionId:ctx.session.id,baseSha:state.revision,operationId:state.operationId,targetBranch:state.targetBranch,targetHeadSha:state.targetHeadSha,parentPrNumber:state.parentPrNumber,previous:state.publication?{number:state.publication.number,headSha:state.publication.headSha}:undefined,mergeTarget:state.mergeTarget,title:request.title,body:publicationBody(input.summary,input.limitations,state.commands.slice(-verificationCommands(changes.some(c=>c.path.startsWith("apps/jira/"))).length)),changes},ctx.abortSignal);
    const result={revisionProtocol:1,operationId:state.operationId,station:"worker" as const,sessionId:ctx.session.id,revision:state.revision,publication,summary:input.summary,limitations:input.limitations,commands:state.commands,capturedAt:new Date().toISOString()};
    workState.update(s=>({...s,publication,recorded:true,completedOperations:{...s.completedOperations,[state.operationId]:result}}));
    return {publication,result};
   },
   isSuccess:result=>!!result.publication,
  });
  const {publication}=authorized.output;
  log.set({factory:{station:"worker",stage:"publish_work",outcome:"draft_pr_created",operationId:state.operationId,prNumber:publication.number,headSha:publication.headSha,targetHeadSha:publication.targetHeadSha,targetBranch:publication.targetBranch}});
  return {...authorized.output.result,authorization:authorized.audit};
 }});
