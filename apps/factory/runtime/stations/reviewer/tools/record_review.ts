import {reviewBrowser,browserRequirements,browserComplete} from '../../../lib/review-browser';
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { requireStation } from "../../../lib/station-access";
import { workState } from "../../../lib/work-state";
import { collectChanges } from "../../../lib/work-changes";
import { verifyPullRequestHead } from "../../../lib/work-github";
import { approvalBlockers, hostReviewLimitations } from "../../../lib/review-policy";
export const reviewSchema=z.object({verdict:z.enum(["approve","changes_requested","incomplete"]),summary:z.string().min(10).max(3000),findings:z.array(z.object({severity:z.enum(["blocking","nonblocking"]),path:z.string(),line:z.number().int().positive().optional(),message:z.string(),evidence:z.string()})).max(15),limitations:z.array(z.string()).max(10)}).strict();
export default defineTool({description:"Record an independent structured review of the exact fetched PR head. Rechecks remote head before recording; does not submit a GitHub review or merge.",inputSchema:reviewSchema,
 async execute(input,ctx){
  requireStation(ctx,"reviewer");const state=workState.get();if(state.recorded)throw new Error("This exact-head review is already recorded.");if(!state.pull)throw new Error("Prepare the exact PR first.");
  const browser=reviewBrowser.get();const browserEvidenceComplete=browserRequirements(state.pull.files).every(app=>browserComplete(browser.observations[`http://127.0.0.1:${app==='jira'?3001:3000}`],state.pull!.headSha,ctx.session.id));
  const hostLimitations=hostReviewLimitations(state.pull.files,browserEvidenceComplete);
  const blockers=approvalBlockers({prepared:state.prepared,repositoryChecksPassed:state.reviewVerified,hasBlockingFinding:input.findings.some(f=>f.severity==="blocking"),contextGaps:state.contextGaps,modelLimitations:input.limitations,files:state.pull.files,browserEvidenceComplete});
  if(input.verdict==="approve"&&blockers.length)throw new Error(`Approval refused by host policy: ${blockers.join(" ")}`);
  const candidateUnchanged=!(await collectChanges(await ctx.getSandbox(),state.baseline,true,state.jiraManifest,state.jiraNuxtConfig,state.jiraLockfile)).length;
  if(input.verdict==="approve"&&!candidateUnchanged)throw new Error("Candidate changed after verification; approval refused.");
  const token=await getToken("github/jira-clone",{subject:{type:"app"}});
  await verifyPullRequestHead(token,state.pull.number,state.pull.headSha,ctx.abortSignal,state.pull.baseSha,state.pull.targetBranch);
  workState.update(s=>({...s,recorded:true}));
  return{station:"reviewer" as const,sessionId:ctx.session.id,prNumber:state.pull.number,url:state.pull.url,baseSha:state.pull.baseSha,targetBranch:state.pull.targetBranch,headSha:state.pull.headSha,...input,limitations:[...state.contextGaps,...hostLimitations,...input.limitations],browserEvidence:{complete:browserEvidenceComplete,observations:Object.values(browser.observations)},verification:{prepared:state.prepared,repositoryChecksPassed:state.reviewVerified,candidateUnchanged},commands:state.commands,capturedAt:new Date().toISOString()};
 }});
