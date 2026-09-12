import { defineDynamic } from "eve";
import { stationOf } from "../lib/station-access";
import { defineTool } from "eve/tools";
import { bash } from "eve/tools/bash";
import { miningState, commandEvidence } from "../lib/mining-state";
const tool = defineTool({
 ...bash,
 description:"Run a focused reproduction or inspection in the native sandbox. Repository is /workspace/repo; prefix commands with cd /workspace/repo. No integration credentials are present. Commands and actual exit codes are recorded as evidence.",
 async *execute(input,ctx){
   if(!miningState.get().prepared) throw new Error("Call prepare_context successfully before running probes.");
   const command='export PATH="$HOME/.local/bin:$PATH"; cd /workspace/repo; '+input.command;
   const result=await bash.execute({...input,command},ctx);
   if (Symbol.asyncIterator in result) {
     for await (const item of result) {
       miningState.update(s=>({...s,commands:[...s.commands,commandEvidence(command,item)]}));
       yield item;
     }
   } else {
     miningState.update(s=>({...s,commands:[...s.commands,commandEvidence(command,result)]}));
     yield result;
   }
 }
});

export default defineDynamic({events:{"session.started":(_,ctx)=>stationOf(ctx) ? null : tool}});
