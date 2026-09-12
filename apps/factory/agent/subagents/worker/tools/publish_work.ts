import { defineTool } from "eve/tools";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { requireStation,stationRequest,workerRequest,currentRevision } from "../../../lib/station-access";
import { workState } from "../../../lib/work-state";
import { collectChanges,changesDigest } from "../../../lib/work-changes";
import { publishWork } from "../../../lib/work-github";
export default defineTool({description:"Publish verified source changes as one draft pull request on a host-chosen feature branch. No merge. Protected policy/agent/workflow files cannot be published.",inputSchema:z.object({summary:z.string().min(10).max(3000),limitations:z.array(z.string()).max(10)}).strict(),
 async execute(input,ctx){
  requireStation(ctx,"worker");const state=workState.get();const request=workerRequest.parse(stationRequest(ctx));
  if(!state.prepared)throw new Error("Prepare worker workspace first.");
  const operationId=currentRevision(ctx)?.operationId||request.operationId;
  if(state.completedOperations?.[operationId])return state.completedOperations[operationId];
  if(operationId!==state.operationId)throw new Error("Prepare this authenticated operation before publishing.");
  let publication;
  {
   const changes=await collectChanges(await ctx.getSandbox(),state.baseline,false,state.jiraManifest);
   if(!state.verifiedDigest||changesDigest(changes)!==state.verifiedDigest)throw new Error("Current source changes must pass verify_work before publication.");
   const token=await getToken("github/jira-clone",{subject:{type:"app"}});
   publication=await publishWork(token,{sessionId:ctx.session.id,baseSha:state.revision,operationId:state.operationId,targetBranch:state.targetBranch,targetHeadSha:state.targetHeadSha,parentPrNumber:state.parentPrNumber,previous:state.publication?{number:state.publication.number,headSha:state.publication.headSha}:undefined,mergeTarget:state.mergeTarget,title:request.title,body:`${input.summary}\n\n## Original task\n${request.brief}\n\n## Requested revision\n${state.activeBrief}\n\n## Validation\n${state.commands.slice(-3).map(c=>`- ${c.command}: exit ${c.exitCode}`).join("\n")}\n\n## Limitations\n${input.limitations.join("\n")||"None reported."}\n\nNative Eve session: ${ctx.session.id}\nSource: ${state.revision}`,changes},ctx.abortSignal);

  }
  const result={revisionProtocol:1,operationId:state.operationId,station:"worker" as const,sessionId:ctx.session.id,revision:state.revision,publication,summary:input.summary,limitations:input.limitations,commands:state.commands,capturedAt:new Date().toISOString()};
  workState.update(s=>({...s,publication,recorded:true,completedOperations:{...s.completedOperations,[state.operationId]:result}}));return result;
 }});
