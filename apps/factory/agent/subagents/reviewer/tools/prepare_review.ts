import { defineTool } from "eve/tools";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { getVercelOidcToken } from "@vercel/oidc";
import { verifyScope } from "../../../lib/github.mjs";
import { loadPullRequest } from "../../../lib/work-github";
import { prepareRepository } from "../../../lib/prepare-context";
import { workState } from "../../../lib/work-state";
import { requireStation,stationRequest,reviewerRequest } from "../../../lib/station-access";
import { hostReviewLimitations } from "../../../lib/review-policy";
export default defineTool({description:"Fetch the authenticated PR's exact base/head, independent candidate workspace, frozen dependencies, and baseline policy. Call first.",inputSchema:z.object({}),
 async *execute(_,ctx){
  requireStation(ctx,"reviewer");
  if(workState.get().prepared){yield{phase:"Prepared",pull:workState.get().pull};return;}
  verifyScope(await getVercelOidcToken());yield{phase:"Preparing independent review"};
  const token=await getToken("github/jira-clone",{subject:{type:"app"}});
  const pull=await loadPullRequest(token,reviewerRequest.parse(stationRequest(ctx)).prNumber,ctx.abortSignal);
  const sandbox=await ctx.getSandbox();workState.update(s=>({...s,sandboxStarted:true}));
  const setup=await prepareRepository(sandbox,token,ctx.abortSignal,pull.snapshot);
  // Baseline policy is taken from the exact PR base, not candidate-modified files.
  const changed=new Set(pull.files.flatMap(file=>[file.filename,...(file.previous_filename?[file.previous_filename]:[])]));
  for(const entry of pull.baseSnapshot.entries.filter(entry=>changed.has(entry.file)))await sandbox.writeBinaryFile({path:`base/${entry.file}`,content:entry.content});
  const rules=pull.baseSnapshot.entries.filter(e=>e.file==="AGENTS.md"||e.file.startsWith("factory/context/")||e.file.startsWith("factory/policies/"));
  for(const rule of rules)await sandbox.writeBinaryFile({path:`review-policy/${rule.file}`,content:rule.content});
  await sandbox.writeTextFile({path:"review-policy/pull-request.json",content:JSON.stringify({number:pull.number,title:pull.title,body:pull.body,baseSha:pull.baseSha,headSha:pull.headSha,files:pull.files},null,2)});
  const metadata={number:pull.number,url:pull.url,title:pull.title,body:pull.body,baseSha:pull.baseSha,headSha:pull.headSha,files:pull.files};
  workState.update(s=>({...s,prepared:setup.prepared,revision:setup.revision,baseline:setup.files.map(({file,sha256})=>({file,sha256})),commands:setup.commands,pull:metadata,contextGaps:[...setup.contextGaps,...pull.contextGaps]}));
  yield{phase:setup.prepared?"Prepared":"Setup failed",pull:metadata,policy:"/workspace/review-policy",originalChangedFiles:"/workspace/base",workspace:"/workspace/repo",commands:setup.commands,limitations:[...setup.contextGaps,...pull.contextGaps,...hostReviewLimitations(pull.files)]};
 },
 toModelOutput(output){
  return {type:"text",value:JSON.stringify("commands" in output ? {...output,commands:output.commands?.map(command=>({command:command.command,exitCode:command.exitCode,stdout:command.stdout.slice(-600),stderr:command.stderr.slice(-1000)}))} : output)};
 }
});
