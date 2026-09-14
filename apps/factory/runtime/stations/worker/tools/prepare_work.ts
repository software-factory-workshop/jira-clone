import { jiraLockfile, jiraManifest, jiraNuxtConfig } from "../../../lib/jira-policy";
import { defineTool } from "eve/tools";
import { useLogger } from "evlog/eve";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { getVercelOidcToken } from "@vercel/oidc";
import { verifyScope } from "../../../lib/github.mjs";
import { loadWorkSnapshot,targetFor,readPull,verifyOwnerCommit,isDescendant,WorkError } from "../../../lib/work-github";
import { prepareRepository } from "../../../lib/prepare-context";
import { workState } from "../../../lib/work-state";
import { requireStation,stationRequest,workerRequest,currentRevision } from "../../../lib/station-access";
import { githubConnectorName } from "../../../lib/factory-config.ts";
import { browserOrigin,reviewBrowser } from "../../../lib/review-browser.ts";
export default defineTool({description:"Prepare a clean pinned main snapshot, frozen dependencies and the authenticated task brief. Call first.",inputSchema:z.object({}),
 async *execute(_,ctx){
  requireStation(ctx,"worker");
  const log=useLogger(ctx);
  const original=workerRequest.parse(stationRequest(ctx));const revision=currentRevision(ctx);
  const operationId=revision?.operationId||original.operationId;const prior=workState.get();
  if(prior.completedOperations?.[operationId]){log.set({factory:{station:"worker",stage:"prepare_work",outcome:"already_published",operationId}});yield{phase:"Already published",result:prior.completedOperations[operationId]};return;}
  if(prior.prepared&&prior.basePrepared&&prior.operationId===operationId){log.set({factory:{station:"worker",stage:"prepare_work",outcome:"already_prepared",revision:prior.revision,operationId}});yield{phase:"Prepared",revision:prior.revision,request:{...original,brief:prior.activeBrief},targetBranch:prior.targetBranch};return;}
  if(prior.operationId&&!prior.recorded&&prior.operationId!==operationId)throw new WorkError("unfinished_operation",`Owner still has unpublished operation ${prior.operationId}. Its source is preserved; this revision has not replaced it.`);
  if(revision&&(!prior.publication||prior.publication.number!==revision.prNumber||prior.publication.ownerSessionId!==ctx.session.id))throw new WorkError("ownership_unverified","Durable owner state does not authorize this PR.");
  verifyScope(await getVercelOidcToken());
  yield{phase:"Preparing worker workspace"};
  const token=await getToken(githubConnectorName,{subject:{type:"app"}});
  let target=await targetFor(token,original.parentPrNumber,ctx.abortSignal);
  let source=target.targetHeadSha;
  if(revision){
   const owned=prior.publication!;const pr=await readPull(token,owned.number,ctx.abortSignal);
   if(pr.state!=="open"||pr.head.ref!==owned.branch||pr.base.ref!==owned.targetBranch)throw new WorkError("stale_head","Owned PR changed externally; source is preserved and this operation is blocked.");
   await verifyOwnerCommit(token,{...owned,headSha:owned.ownershipCommitSha||owned.headSha},ctx.session.id,ctx.abortSignal);
   if(pr.head.sha!==owned.headSha&&!await isDescendant(token,owned.headSha,pr.head.sha,ctx.abortSignal))throw new WorkError("stale_head","Owned branch history was replaced; ownership cannot be transferred implicitly.");
   workState.update(s=>({...s,publication:{...owned,headSha:pr.head.sha,ownershipCommitSha:owned.ownershipCommitSha||owned.headSha}}));
   source=pr.head.sha;target={targetBranch:owned.targetBranch,targetHeadSha:owned.targetHeadSha,...(owned.parentPrNumber?{parentPrNumber:owned.parentPrNumber}:{})};
  }
  const snapshot=await loadWorkSnapshot(token,source,ctx.abortSignal);
  const baseSnapshot=source===target.targetHeadSha?snapshot:await loadWorkSnapshot(token,target.targetHeadSha,ctx.abortSignal);
  const sandbox=await ctx.getSandbox();workState.update(s=>({...s,sandboxStarted:true}));
  // A completed operation may have deleted files: reconstruct source, never overlay stale files.
  const cleared=await sandbox.run({command:"rm -rf /workspace/repo"});if(cleared.exitCode!==0)throw new Error("Cannot reconstruct worker source.");
  const setup=await prepareRepository(sandbox,token,ctx.abortSignal,snapshot,undefined,baseSnapshot);
  const browserTargets=Object.fromEntries((['jira','factory'] as const).map(app=>[browserOrigin(app,'head'),source]));
  reviewBrowser.update(state=>({...state,targets:browserTargets,sources:{[browserOrigin('jira','head')]:'head',[browserOrigin('factory','head')]:'head'},observations:{}}));
  workState.update(s=>({...s,prepared:setup.prepared,basePrepared:setup.basePrepared,revision:setup.revision,operationId,activeBrief:revision?.brief||original.brief,targetBranch:target.targetBranch,targetHeadSha:target.targetHeadSha,parentPrNumber:target.parentPrNumber,mergeTarget:false,recorded:false,verifiedDigest:null,jiraManifest:jiraManifest(snapshot.entries),jiraNuxtConfig:jiraNuxtConfig(snapshot.entries),jiraLockfile:jiraLockfile(snapshot.entries),baseline:setup.files.map(({file,sha256})=>({file,sha256})),commands:setup.commands,contextGaps:[...setup.contextGaps,...setup.baseContextGaps]}));
  log.set({factory:{station:"worker",stage:"prepare_work",outcome:setup.prepared?"prepared":"incomplete",revision:setup.revision,operationId,targetBranch:target.targetBranch,fileCount:setup.files.length,commandCount:setup.commands.length}});
  yield{phase:setup.prepared?"Prepared":"Setup failed",revision:setup.revision,request:{...original,brief:revision?.brief||original.brief,originalBrief:original.brief},operationId,targetBranch:target.targetBranch,targetHeadSha:target.targetHeadSha,baseRevision:baseSnapshot.revision,workspace:"/workspace/repo",fileCount:setup.files.length,commands:setup.commands,limitations:[...setup.contextGaps,...setup.baseContextGaps]};
 },
 toModelOutput(output){
  return {type:"text",value:JSON.stringify("commands" in output ? {...output,commands:output.commands?.map(command=>({command:command.command,exitCode:command.exitCode,stdout:command.stdout.slice(-600),stderr:command.stderr.slice(-1000)}))} : output)};
 }
});
