import { jiraLockfile, jiraManifest, jiraNuxtConfig, validateJiraLockfile, validateJiraManifest, validateJiraMcpChangeSet, validateJiraNuxtConfig } from "../../../lib/jira-policy";
import { defineTool } from "eve/tools";
import { useLogger } from "evlog/eve";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { getVercelOidcToken } from "@vercel/oidc";
import { verifyScope } from "../../../lib/github.mjs";
import { loadPullRequest } from "../../../lib/work-github";
import { prepareRepository } from "../../../lib/prepare-context";
import { commandEvidence } from "../../../lib/command-evidence";
import { workState } from "../../../lib/work-state";
import { requireStation,stationRequest,reviewerRequest } from "../../../lib/station-access";
import { hostReviewLimitations } from "../../../lib/review-policy";
import { githubConnectorName } from "../../../lib/factory-config.ts";
export default defineTool({description:"Fetch the authenticated PR's exact base/head, independent candidate workspace, frozen dependencies, and baseline policy. Call first.",inputSchema:z.object({}),
 async *execute(_,ctx){
  requireStation(ctx,"reviewer");
  const log=useLogger(ctx);
  if(workState.get().prepared){log.set({factory:{station:"reviewer",stage:"prepare_review",outcome:"already_prepared",prNumber:workState.get().pull?.number}});yield{phase:"Prepared",pull:workState.get().pull};return;}
  verifyScope(await getVercelOidcToken());yield{phase:"Preparing independent review"};
  const token=await getToken(githubConnectorName,{subject:{type:"app"}});
  const pull=await loadPullRequest(token,reviewerRequest.parse(stationRequest(ctx)).prNumber,ctx.abortSignal);
  const baseManifest=jiraManifest(pull.baseSnapshot.entries);const candidateManifest=jiraManifest(pull.snapshot.entries);
  validateJiraMcpChangeSet(pull.files.map(file=>file.filename),baseManifest,candidateManifest);
  if(pull.files.some(f=>f.filename==="apps/jira/package.json"))validateJiraManifest(baseManifest,candidateManifest);
  if(pull.files.some(f=>f.filename==="apps/jira/nuxt.config.ts"))validateJiraNuxtConfig(jiraNuxtConfig(pull.baseSnapshot.entries),jiraNuxtConfig(pull.snapshot.entries));
  if(pull.files.some(f=>f.filename==="pnpm-lock.yaml"))validateJiraLockfile(jiraLockfile(pull.baseSnapshot.entries),jiraLockfile(pull.snapshot.entries),baseManifest,candidateManifest);
  const sandbox=await ctx.getSandbox();workState.update(s=>({...s,sandboxStarted:true}));
  const setup=await prepareRepository(sandbox,token,ctx.abortSignal,pull.snapshot);
  // Baseline policy is taken from the exact PR base, not candidate-modified files.
  for(let i=0;i<pull.baseSnapshot.entries.length;i+=8)await Promise.all(pull.baseSnapshot.entries.slice(i,i+8).map(entry=>sandbox.writeBinaryFile({path:`base/${entry.file}`,content:entry.content})));
  const executable=pull.baseSnapshot.entries.filter(entry=>entry.mode==="100755");
  if(executable.length){const paths=executable.map(entry=>`'/workspace/base/${entry.file.replaceAll("'","'\\''")}'`).join(" ");const permissions=await sandbox.run({command:`chmod 755 -- ${paths}`});if(permissions.exitCode!==0)throw new Error("Could not restore base source executable modes.");}
  const baseSetupCommand='export PATH="$HOME/.local/bin:$PATH"; cd /workspace/base; node --version; pnpm --version; pnpm install --frozen-lockfile';
  const baseSetup=setup.prepared?await sandbox.run({command:baseSetupCommand}):undefined;
  const baseSetupEvidence=baseSetup?commandEvidence(baseSetupCommand,baseSetup):undefined;
  const basePrepared=baseSetup?.exitCode===0;
  const baseContextGaps=setup.prepared&&!basePrepared?[`Pristine base dependency setup failed with exit ${baseSetup?.exitCode}; test-count comparison is unavailable.`]:[];
  const commands=[...setup.commands,...(baseSetupEvidence?[baseSetupEvidence]:[])];
  const rules=pull.baseSnapshot.entries.filter(e=>e.file==="factory/CONTRACT.md"||e.file.startsWith("factory/policies/"));
  for(const rule of rules)await sandbox.writeBinaryFile({path:`review-policy/${rule.file}`,content:rule.content});
  await sandbox.writeTextFile({path:"review-policy/pull-request.json",content:JSON.stringify({number:pull.number,title:pull.title,body:pull.body,baseSha:pull.baseSha,headSha:pull.headSha,targetBranch:pull.targetBranch,files:pull.files},null,2)});
  const metadata={number:pull.number,url:pull.url,title:pull.title,body:pull.body,baseSha:pull.baseSha,headSha:pull.headSha,targetBranch:pull.targetBranch,files:pull.files};
  workState.update(s=>({...s,prepared:setup.prepared,basePrepared,revision:setup.revision,jiraManifest:candidateManifest,jiraNuxtConfig:jiraNuxtConfig(pull.snapshot.entries),jiraLockfile:jiraLockfile(pull.snapshot.entries),baseline:setup.files.map(({file,sha256})=>({file,sha256})),commands,pull:metadata,contextGaps:[...setup.contextGaps,...pull.contextGaps,...baseContextGaps]}));
  log.set({factory:{station:"reviewer",stage:"prepare_review",outcome:setup.prepared?"prepared":"incomplete",prNumber:pull.number,headSha:pull.headSha,baseSha:pull.baseSha,fileCount:pull.files.length,commandCount:commands.length}});
  yield{phase:setup.prepared?"Prepared":"Setup failed",pull:metadata,policy:"/workspace/review-policy",originalChangedFiles:"/workspace/base",workspace:"/workspace/repo",commands,limitations:[...setup.contextGaps,...pull.contextGaps,...baseContextGaps,...hostReviewLimitations(pull.files)]};
 },
 toModelOutput(output){
  return {type:"text",value:JSON.stringify("commands" in output ? {...output,commands:output.commands?.map(command=>({command:command.command,exitCode:command.exitCode,stdout:command.stdout.slice(-600),stderr:command.stderr.slice(-1000)}))} : output)};
 }
});
