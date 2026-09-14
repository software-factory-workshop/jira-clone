import { jiraLockfile, jiraManifest, jiraNuxtConfig, validateJiraLockfile, validateJiraManifest, validateJiraMcpChangeSet, validateJiraNuxtConfig } from "../../../lib/jira-policy";
import { defineTool } from "eve/tools";
import { useLogger } from "evlog/eve";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { getVercelOidcToken } from "@vercel/oidc";
import { verifyScope } from "../../../lib/github.mjs";
import { loadPullRequest } from "../../../lib/work-github";
import { prepareRepository } from "../../../lib/prepare-context";
import { workState } from "../../../lib/work-state";
import { reviewBrowser } from "../../../lib/review-browser";
import { requireStation,stationRequest,reviewerRequest } from "../../../lib/station-access";
import { hostReviewLimitations } from "../../../lib/review-policy";
import { githubConnectorName } from "../../../lib/factory-config.ts";
export default defineTool({description:"Fetch the authenticated PR's exact base/head, independent candidate workspace, frozen dependencies, and baseline policy. Call first.",inputSchema:z.object({}),
 async *execute(_,ctx){
  requireStation(ctx,"reviewer");
  const log=useLogger(ctx);
  verifyScope(await getVercelOidcToken());yield{phase:"Preparing independent review"};
  const token=await getToken(githubConnectorName,{subject:{type:"app"}});
  const prior=workState.get();
  if(prior.prepared){
   const sandbox=await ctx.getSandbox();
   const cleared=await sandbox.run({command:"rm -rf /workspace/repo /workspace/base /workspace/review-policy"});
   if(cleared.exitCode!==0)throw new Error("Could not reset the previous review workspace for the new candidate head.");
   reviewBrowser.update(()=>({targets:{},sources:{},observations:{}}));
   workState.update(s=>({...s,prepared:false,basePrepared:false,revision:"",commands:[],baseline:[],pull:null,contextGaps:[],verificationFindings:[],reviewVerified:false,verifiedDigest:null,recorded:false}));
  }
  const pull=await loadPullRequest(token,reviewerRequest.parse(stationRequest(ctx)).prNumber,ctx.abortSignal);
  const baseManifest=jiraManifest(pull.baseSnapshot.entries);const candidateManifest=jiraManifest(pull.snapshot.entries);
  validateJiraMcpChangeSet(pull.files.map(file=>file.filename),baseManifest,candidateManifest);
  if(pull.files.some(f=>f.filename==="apps/jira/package.json"))validateJiraManifest(baseManifest,candidateManifest);
  if(pull.files.some(f=>f.filename==="apps/jira/nuxt.config.ts"))validateJiraNuxtConfig(jiraNuxtConfig(pull.baseSnapshot.entries),jiraNuxtConfig(pull.snapshot.entries));
  if(pull.files.some(f=>f.filename==="pnpm-lock.yaml"))validateJiraLockfile(jiraLockfile(pull.baseSnapshot.entries),jiraLockfile(pull.snapshot.entries),baseManifest,candidateManifest);
  const sandbox=await ctx.getSandbox();workState.update(s=>({...s,sandboxStarted:true}));
  const setup=await prepareRepository(sandbox,token,ctx.abortSignal,pull.snapshot,undefined,pull.baseSnapshot);
  // Baseline policy is taken from the exact PR base, not candidate-modified files.
  const rules=pull.baseSnapshot.entries.filter(e=>e.file==="factory/CONTRACT.md"||e.file.startsWith("factory/policies/"));
  for(const rule of rules)await sandbox.writeBinaryFile({path:`review-policy/${rule.file}`,content:rule.content});
  await sandbox.writeTextFile({path:"review-policy/pull-request.json",content:JSON.stringify({number:pull.number,title:pull.title,body:pull.body,baseSha:pull.baseSha,headSha:pull.headSha,targetBranch:pull.targetBranch,files:pull.files},null,2)});
  const metadata={number:pull.number,url:pull.url,title:pull.title,body:pull.body,baseSha:pull.baseSha,headSha:pull.headSha,targetBranch:pull.targetBranch,files:pull.files};
  workState.update(s=>({...s,prepared:setup.prepared,basePrepared:setup.basePrepared,revision:setup.revision,jiraManifest:candidateManifest,jiraNuxtConfig:jiraNuxtConfig(pull.snapshot.entries),jiraLockfile:jiraLockfile(pull.snapshot.entries),baseline:setup.files.map(({file,sha256})=>({file,sha256})),commands:setup.commands,pull:metadata,contextGaps:[...setup.contextGaps,...pull.contextGaps,...setup.baseContextGaps]}));
  log.set({factory:{station:"reviewer",stage:"prepare_review",outcome:setup.prepared?"prepared":"incomplete",prNumber:pull.number,headSha:pull.headSha,baseSha:pull.baseSha,fileCount:pull.files.length,commandCount:setup.commands.length}});
  yield{phase:setup.prepared?"Prepared":"Setup failed",pull:metadata,policy:"/workspace/review-policy",originalChangedFiles:"/workspace/base",workspace:"/workspace/repo",commands:setup.commands,limitations:[...setup.contextGaps,...pull.contextGaps,...setup.baseContextGaps,...hostReviewLimitations(pull.files)]};
 },
 toModelOutput(output){
  return {type:"text",value:JSON.stringify("commands" in output ? {...output,commands:output.commands?.map(command=>({command:command.command,exitCode:command.exitCode,stdout:command.stdout.slice(-600),stderr:command.stderr.slice(-1000)}))} : output)};
 }
});
