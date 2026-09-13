import { verificationCommands } from "../../../lib/jira-policy";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { requireStation } from "../../../lib/station-access";
import { workState } from "../../../lib/work-state";
import { collectChanges,changesDigest } from "../../../lib/work-changes";
import { commandEvidence } from "../../../lib/command-evidence";
export default defineTool({description:"Run the required typecheck, tests and build against the current source changes; records evidence required before publication. Call after edits are finished.",inputSchema:z.object({}),
 async *execute(_,ctx){
  requireStation(ctx,"worker");const state=workState.get();if(!state.prepared)throw new Error("Prepare workspace first.");
  const sandbox=await ctx.getSandbox();const changes=await collectChanges(sandbox,state.baseline,false,state.jiraManifest,state.jiraNuxtConfig,state.jiraLockfile);const digest=changesDigest(changes);
  workState.update(s=>({...s,verifiedDigest:null}));
  for(const check of verificationCommands(changes.some(c=>c.path.startsWith("apps/jira/")))){
   yield{phase:"Checking work",command:check};
   const command='export PATH="$HOME/.local/bin:$PATH"; cd /workspace/repo; '+check;
   const result=await sandbox.run({command});const evidence=commandEvidence(command,result);
   workState.update(s=>({...s,commands:[...s.commands,evidence]}));
   yield{phase:result.exitCode===0?"Check passed":"Check failed",evidence};
   if(result.exitCode!==0)return;
  }
  if(changesDigest(await collectChanges(sandbox,state.baseline,false,state.jiraManifest,state.jiraNuxtConfig,state.jiraLockfile))!==digest)throw new Error("Source changed during verification; inspect generated changes and verify again.");
  workState.update(s=>({...s,verifiedDigest:digest}));yield{phase:"Work verified",files:changes.map(c=>c.path)};
 }});
