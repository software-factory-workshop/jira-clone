import { defineTool } from "eve/tools";
import { z } from "zod";
import { requireStation } from "../../../lib/station-access";
import { workState } from "../../../lib/work-state";
import { collectChanges } from "../../../lib/work-changes";
import { commandEvidence } from "../../../lib/command-evidence";
export default defineTool({description:"Independently run mandatory typecheck, tests and build on the unchanged pinned PR candidate. Required before an approve verdict.",inputSchema:z.object({}),
 async *execute(_,ctx){
  requireStation(ctx,"reviewer");const state=workState.get();if(!state.prepared)throw new Error("Prepare review first.");
  const sandbox=await ctx.getSandbox();
  if((await collectChanges(sandbox,state.baseline,true)).length)throw new Error("Review candidate was edited; start a fresh independent review.");
  workState.update(s=>({...s,reviewVerified:false}));
  for(const check of ["pnpm typecheck","pnpm test","pnpm build"]){
   yield{phase:"Checking candidate",command:check};
   const command='export PATH="$HOME/.local/bin:$PATH"; cd /workspace/repo; '+check;
   const result=await sandbox.run({command});const evidence=commandEvidence(command,result);
   workState.update(s=>({...s,commands:[...s.commands,evidence]}));
   yield{phase:result.exitCode===0?"Check passed":"Check failed",evidence};if(result.exitCode!==0)return;
  }
  if((await collectChanges(sandbox,state.baseline,true)).length)throw new Error("Candidate changed during verification; review cannot approve modified source.");
  workState.update(s=>({...s,reviewVerified:true}));yield{phase:"Candidate verified",headSha:state.pull?.headSha};
 }});
