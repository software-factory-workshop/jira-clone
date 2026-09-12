import { defineTool } from "eve/tools";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { getVercelOidcToken } from "@vercel/oidc";
import { verifyScope } from "../../../lib/github.mjs";
import { loadWorkSnapshot } from "../../../lib/work-github";
import { prepareRepository } from "../../../lib/prepare-context";
import { workState } from "../../../lib/work-state";
import { requireStation,stationRequest } from "../../../lib/station-access";
export default defineTool({description:"Prepare a clean pinned main snapshot, frozen dependencies and the authenticated task brief. Call first.",inputSchema:z.object({}),
 async *execute(_,ctx){
  requireStation(ctx,"worker");
  if(workState.get().prepared){yield{phase:"Prepared",revision:workState.get().revision};return;}
  verifyScope(await getVercelOidcToken());
  yield{phase:"Preparing worker workspace"};
  const token=await getToken("github/jira-clone",{subject:{type:"app"}});
  const snapshot=await loadWorkSnapshot(token,"main",ctx.abortSignal);
  const sandbox=await ctx.getSandbox();workState.update(s=>({...s,sandboxStarted:true}));
  const setup=await prepareRepository(sandbox,token,ctx.abortSignal,snapshot);
  workState.update(s=>({...s,prepared:setup.prepared,revision:setup.revision,baseline:setup.files.map(({file,sha256})=>({file,sha256})),commands:setup.commands}));
  yield{phase:setup.prepared?"Prepared":"Setup failed",revision:setup.revision,request:stationRequest(ctx),workspace:"/workspace/repo",fileCount:setup.files.length,commands:setup.commands,limitations:setup.contextGaps};
 },
 toModelOutput(output){
  return {type:"text",value:JSON.stringify("commands" in output ? {...output,commands:output.commands?.map(command=>({command:command.command,exitCode:command.exitCode,stdout:command.stdout.slice(-600),stderr:command.stderr.slice(-1000)}))} : output)};
 }
});
