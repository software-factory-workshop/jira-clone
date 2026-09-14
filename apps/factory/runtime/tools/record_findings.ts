import { defineDynamic } from "eve";
import { useLogger } from "evlog/eve";
import { stationOf } from "../lib/station-access";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { miningState } from "../lib/mining-state";
import { latestVercelReads } from "../lib/vercel-context";
import { repository, model, scope } from "../lib/github.mjs";
import { vercelProjects } from "../lib/factory-config.ts";
import { proposalInputSchema, recordProposals, renderProposal } from "../lib/proposals";
const tool = defineTool({
 description:"Record up to three ranked proposals and reflection. Trusted repository, command and integration evidence are attached by the host. Missing setup or inventories make the investigation incomplete. Call once after investigation.",
 inputSchema:z.object({proposals:z.array(proposalInputSchema).max(3),noProposalReason:z.string().optional(),reflection:z.object({helpfulContext:z.array(z.string()),missingContext:z.array(z.string()),contradictions:z.array(z.string()),suggestedImprovements:z.array(z.string())}),contextGaps:z.array(z.string()).describe("Only unavailable evidence needed to answer the user focus. Intentional evaluation/history exclusions and nonexistent comment threads are not blocking gaps by themselves; explain informational limitations in reflection instead.")}),
 async execute(input,ctx){
  const state=miningState.get();
  if(state.recorded) throw new Error("Findings were already recorded; start a new investigation for another run.");
  if(!input.proposals.length&&!input.noProposalReason?.trim()) throw new Error("Explain why no proposal is justified.");
  const vercelEvidence=latestVercelReads(state.vercelReads);
  const gaps=[...state.contextGaps,...vercelEvidence.filter(r=>!r.complete&&r.gap).map(r=>r.gap!),...input.contextGaps];
  if(!state.prepared) gaps.push("Repository dependencies were not successfully prepared.");
  for(const resource of ["issues","pulls"]) if(!state.githubReads.some(r=>r.resource===resource&&r.complete)) gaps.push(`Missing complete GitHub ${resource} inventory.`);
  for(const [label,projectId] of [["cockpit",scope.projectId],["Jira",vercelProjects.jira]]) if(!vercelEvidence.some(r=>r.projectId===projectId&&r.complete&&(r.resource==="project"||r.resource==="deployments"))) gaps.push(`Missing Vercel project or deployment evidence for ${label}.`);
  if(state.commands.length<2) gaps.push("No focused reproduction or inspection command was recorded after setup.");
  const capturedAt = new Date().toISOString();
  const proposals = recordProposals(input.proposals, { sessionId: ctx.session.id, revision: state.revision, capturedAt });
  const sections = proposals.map(proposal => renderProposal(proposal, proposal.rank));
  if(!sections.length) sections.push(input.noProposalReason!);
  sections.push(`## Reflection\n\n${Object.entries(input.reflection).map(([name,values])=>`**${name}**\n${values.map(v=>`- ${v}`).join("\n")||"None recorded."}`).join("\n\n")}`);
  if(gaps.length) sections.push(`## Context gaps\n\n${gaps.map(g=>`- ${g}`).join("\n")}`);
  miningState.update(s=>({...s,recorded:true}));
  const result={phase:gaps.length?"Incomplete":"Complete",report:sections.join("\n\n"),revision:state.revision,repository,model,team:scope.team,capturedAt,elapsedMs:Date.now()-Date.parse(state.startedAt),files:state.files,githubReads:state.githubReads.map(r=>({...r,count:r.items.length,items:undefined})),vercelReads:state.vercelReads,commands:state.commands,contextGaps:gaps,proposals,noProposalReason:input.noProposalReason,reflection:input.reflection,executionSurface:"native-eve",source:"git-revision"};
  useLogger(ctx).set({factory:{stage:"record_findings",outcome:gaps.length?"incomplete":"complete",proposalCount:proposals.length,contextGapCount:gaps.length,githubReadCount:state.githubReads.length,vercelReadCount:state.vercelReads.length}});
  return result;
 },
 toModelOutput(output){return {type:"text",value:`${output.phase}: original findings and trusted evidence recorded in the cockpit. Briefly invite the user to review; do not rewrite the report.`};}
});

export default defineDynamic({events:{"session.started":(_,ctx)=>stationOf(ctx) ? null : tool}});
