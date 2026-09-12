import { defineTool } from "eve/tools";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { requireStation } from "../../../lib/station-access";
import { workState } from "../../../lib/work-state";
import { loadWorkSnapshot,assertRefreshCoverage,readBranch,readPull,WorkError } from "../../../lib/work-github";
import { collectChanges } from "../../../lib/work-changes";
import { mergeSources } from "../../../lib/work-merge";
import { prepareRepository } from "../../../lib/prepare-context";
import { manifestFor } from "../../../lib/github.mjs";
export default defineTool({description:"Refresh your own workspace against its latest target branch with a three-way merge. Preserves your source edits, exposes real conflict markers for resolution, and invalidates previous checks. Never writes the target branch.",inputSchema:z.object({}).strict(),
 async execute(_,ctx){
  requireStation(ctx,"worker");const state=workState.get();if(!state.prepared||state.recorded)throw new Error("Prepare the active unpublished operation first.");
  const token=await getToken("github/jira-clone",{subject:{type:"app"}});
  if(state.publication){const pr=await readPull(token,state.publication.number,ctx.abortSignal);if(pr.head.sha!==state.publication.headSha||pr.base.ref!==state.targetBranch)throw new WorkError("stale_head","Owned PR changed; preserving current workspace.");}
  const targetHead=await readBranch(token,state.targetBranch,ctx.abortSignal);
  if(targetHead===state.targetHeadSha)return{phase:"Target unchanged",targetHeadSha:targetHead};
  const sandbox=await ctx.getSandbox();const changes=await collectChanges(sandbox,state.baseline,true);
  await assertRefreshCoverage(token,state.targetHeadSha,state.revision,targetHead,ctx.abortSignal);
  const [base,ours,theirs]=await Promise.all([loadWorkSnapshot(token,state.targetHeadSha,ctx.abortSignal),loadWorkSnapshot(token,state.revision,ctx.abortSignal),loadWorkSnapshot(token,targetHead,ctx.abortSignal)]);
  const merged=await mergeSources(base,ours,theirs,changes,async(base,own,target)=>{
   await sandbox.writeTextFile({path:"merge/base",content:base});await sandbox.writeTextFile({path:"merge/ours",content:own});await sandbox.writeTextFile({path:"merge/target",content:target});
   const result=await sandbox.run({command:"git merge-file -p -L OWNER -L BASE -L TARGET /workspace/merge/ours /workspace/merge/base /workspace/merge/target"});
   if(("truncated" in result&&result.truncated)||result.exitCode<0||result.exitCode>=127)throw new Error("Three-way merge failed; workspace unchanged.");
   return{content:result.stdout,conflict:result.exitCode!==0};
  });
  // Persist the complete merge before replacing source, so setup failure cannot discard the result.
  const staging=`merge-result-${targetHead}`;
  const clean=await sandbox.run({command:`rm -rf /workspace/${staging}; mkdir -p /workspace/${staging}`});if(clean.exitCode!==0)throw new Error("Cannot stage merged source; original source preserved.");
  for(const entry of merged.entries)await sandbox.writeBinaryFile({path:`${staging}/${entry.file}`,content:entry.content});
  const swapped=await sandbox.run({command:`set -eu; rm -rf /workspace/repo-before-refresh; mv /workspace/repo /workspace/repo-before-refresh; mv /workspace/${staging} /workspace/repo`});if(swapped.exitCode!==0)throw new Error("Source swap failed; original remains in /workspace/repo-before-refresh or /workspace/repo, staged merge retained.");
  workState.update(s=>({...s,prepared:true,revision:targetHead,targetHeadSha:targetHead,mergeTarget:!!s.publication,baseline:manifestFor(theirs.entries).map(({file,sha256})=>({file,sha256})),verifiedDigest:null}));
  let setupComplete=false;
  try{
   const setup=await prepareRepository(sandbox,token,ctx.abortSignal,{revision:targetHead,entries:merged.entries});setupComplete=setup.prepared;
   workState.update(s=>({...s,commands:[...s.commands,...setup.commands],contextGaps:setup.contextGaps}));
  }catch(error){workState.update(s=>({...s,contextGaps:[`Merged source retained; dependency setup interrupted: ${error instanceof Error?error.message:"unknown error"}`]}));}

  return{phase:merged.conflicts.length?"Resolve conflicts":"Target refreshed",targetBranch:state.targetBranch,targetHeadSha:targetHead,conflicts:merged.conflicts,required:"Resolve listed conflicts in your own source, then run verify_work again. No target branch was written.",setupComplete};
 }
});
