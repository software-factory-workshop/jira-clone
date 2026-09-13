import {browserComplete,browserOrigin,browserRequirements,reviewBrowser,visualComparisonComplete} from '../../../lib/review-browser';
import { defineTool } from "eve/tools";
import { useLogger } from "evlog/eve";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { requireStation } from "../../../lib/station-access";
import { workState } from "../../../lib/work-state";
import { collectChanges } from "../../../lib/work-changes";
import { readPull,updatePullRequestBody,verifyPullRequestHead } from "../../../lib/work-github";
import { approvalBlockers, hostReviewLimitations } from "../../../lib/review-policy";
import { buildVisualReviewPacket,withVisualReviewSection,type VisualReviewApp } from '../../../lib/visual-review';
import { storeBrowserComparison } from '../../../lib/visual-review-store';
import { changeResource } from "../../../lib/cedar/model.ts";
import { factoryPrincipalFromStation, runGuardedFactoryOperation } from "../../../lib/cedar/guard.ts";
export const reviewSchema=z.object({verdict:z.enum(["approve","changes_requested","incomplete"]),summary:z.string().min(10).max(3000),findings:z.array(z.object({severity:z.enum(["blocking","nonblocking"]),path:z.string(),line:z.number().int().positive().optional(),message:z.string(),evidence:z.string()})).max(15),limitations:z.array(z.string()).max(10)}).strict();
export default defineTool({description:"Record an independent structured review of the exact fetched PR head. Rechecks remote head before recording; does not submit a GitHub review or merge.",inputSchema:reviewSchema,
 async execute(input,ctx){
  requireStation(ctx,"reviewer");const log=useLogger(ctx);const state=workState.get();if(state.recorded)throw new Error("This exact-head review is already recorded.");if(!state.pull)throw new Error("Prepare the exact PR first.");const targetBranch=state.pull.targetBranch||'main';
  const browser=reviewBrowser.get();const browserEvidenceComplete=browserRequirements(state.pull.files).every(app=>browserComplete(browser.observations[browserOrigin(app,'head')],state.pull!.headSha,ctx.session.id));
  const hostLimitations=hostReviewLimitations(state.pull.files,browserEvidenceComplete);
  const blockers=approvalBlockers({prepared:state.prepared,repositoryChecksPassed:state.reviewVerified,hasBlockingFinding:input.findings.some(f=>f.severity==="blocking"),contextGaps:state.contextGaps,modelLimitations:input.limitations,files:state.pull.files,browserEvidenceComplete});
  if(input.verdict==="approve"&&blockers.length)throw new Error(`Approval refused by host policy: ${blockers.join(" ")}`);
 const candidateUnchanged=!(await collectChanges(await ctx.getSandbox(),state.baseline,true,state.jiraManifest,state.jiraNuxtConfig,state.jiraLockfile)).length;
 if(input.verdict==="approve"&&!candidateUnchanged)throw new Error("Candidate changed after verification; approval refused.");
  const token=await getToken("github/jira-clone",{subject:{type:"app"}});
  await verifyPullRequestHead(token,state.pull.number,state.pull.headSha,ctx.abortSignal,state.pull.baseSha,state.pull.targetBranch);
  const principal=factoryPrincipalFromStation(ctx,"reviewer");
  const evidenceId=`review:${ctx.session.id}:${state.pull.headSha}`;
  const authorized=await runGuardedFactoryOperation({
   operationId:`${ctx.session.id}:record-review`,
   principal,
   action:"record_review",
   input:{reviewId:ctx.session.id,verdict:input.verdict==="approve"?"approved":input.verdict,reviewedSha:state.pull.headSha},
   resource:changeResource({id:String(state.pull.number),taskId:ctx.session.id,candidateSha:state.pull.headSha,baseSha:state.pull.baseSha,branch:targetBranch,expectedRevision:state.pull.headSha}),
   context:{expectedRevision:state.pull.headSha,candidateSha:state.pull.headSha,baseSha:state.pull.baseSha,verifiedSha:state.pull.headSha,reviewedSha:state.pull.headSha,branch:targetBranch,lane:"reviewer",budget:0,riskClass:"low",evidence:{id:evidenceId,source:"factory.review_gate",complete:candidateUnchanged,candidateSha:state.pull.headSha}},
   log,
   execute:async()=>{
    const requiredApps=browserRequirements(state.pull!.files).filter((app):app is VisualReviewApp=>app==='jira'||app==='factory');
    const visualLimitations:string[]=[];const artifacts=[];
    for(const app of requiredApps){
     const beforeObservation=browser.observations[browserOrigin(app,'base')];const afterObservation=browser.observations[browserOrigin(app,'head')];
     if(!visualComparisonComplete(beforeObservation,afterObservation,state.pull!.baseSha,state.pull!.headSha,ctx.session.id)){
      if(!beforeObservation?.frames?.before)visualLimitations.push(`No base-design frame was captured for the changed ${app} surface.`);
      if(!afterObservation?.frames?.after)visualLimitations.push(`No candidate-design frame was captured for the changed ${app} surface.`);
     }
     if(!beforeObservation?.frames?.before&&!afterObservation?.frames?.after)continue;
     try{const artifact=await storeBrowserComparison({app,beforeObservation,afterObservation,baseSha:state.pull!.baseSha,headSha:state.pull!.headSha,targetBranch});if(artifact)artifacts.push(artifact);else visualLimitations.push(`The ${app} visual comparison did not include a reviewable route.`);}catch(error){visualLimitations.push(`The ${app} visual comparison could not be stored: ${error instanceof Error?error.message:'storage failed'}.`);}
    }
    let visualReview=buildVisualReviewPacket({version:1,requiredApps,baseSha:state.pull!.baseSha,headSha:state.pull!.headSha,targetBranch,reviewerSessionId:ctx.session.id,capturedAt:new Date().toISOString(),artifacts,limitations:visualLimitations});
    if(requiredApps.length){
     try{const currentPull=await readPull(token,state.pull!.number,ctx.abortSignal);if(currentPull.head.sha!==state.pull!.headSha||currentPull.state!=='open')throw new Error('Pull request changed before its visual review section could be published.');await updatePullRequestBody(token,state.pull!.number,state.pull!.headSha,withVisualReviewSection(currentPull.body||'',visualReview,{baseSha:state.pull!.baseSha,headSha:state.pull!.headSha,targetBranch}),ctx.abortSignal);}
     catch(error){visualReview={...visualReview,limitations:[...visualReview.limitations,`The visual packet was stored but its PR section could not be updated: ${error instanceof Error?error.message:'GitHub update failed'}.`]};}
    }
    workState.update(s=>({...s,recorded:true}));
    return {visualReview,observations:Object.values(browser.observations).map(({frames,...observation})=>observation),recorded:true};
   },
   isSuccess:result=>result.recorded,
  });
  const {visualReview,observations}=authorized.output;
  log.set({factory:{station:"reviewer",stage:"record_review",outcome:"recorded",verdict:input.verdict,prNumber:state.pull.number,headSha:state.pull.headSha,blockingFindingCount:input.findings.filter(f=>f.severity==="blocking").length,limitationCount:input.limitations.length,browserEvidenceComplete,visualStatus:visualReview.status,visualArtifactCount:visualReview.artifacts.length}});
  return{station:"reviewer" as const,sessionId:ctx.session.id,prNumber:state.pull.number,url:state.pull.url,baseSha:state.pull.baseSha,targetBranch,headSha:state.pull.headSha,...input,limitations:[...state.contextGaps,...hostLimitations,...input.limitations],browserEvidence:{complete:browserEvidenceComplete,observations},visualReview,verification:{prepared:state.prepared,repositoryChecksPassed:state.reviewVerified,candidateUnchanged},commands:state.commands,authorization:authorized.audit,capturedAt:new Date().toISOString()};
 }});
