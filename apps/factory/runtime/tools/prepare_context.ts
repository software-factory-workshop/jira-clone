import { defineDynamic } from "eve";
import { useLogger } from "evlog/eve";
import { stationOf } from "../lib/station-access";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { getVercelOidcToken } from "@vercel/oidc";
import { verifyScope } from "../lib/github.mjs";
import { prepareRepository } from "../lib/prepare-context";
import { activeWork } from "../lib/active-work";
import { miningState } from "../lib/mining-state";
const tool = defineTool({
  description:"Prepare the pinned repository and dependency-complete native Eve sandbox. Call this first, once per investigation.",
  inputSchema:z.object({}),
  async *execute(_,ctx) {
    const prior=miningState.get();
    const log=useLogger(ctx);
    if(prior.revision) {
      log.set({factory:{stage:"prepare_context",outcome:"already_prepared",revision:prior.revision,fileCount:prior.files.length}});
      yield {phase:"Context prepared",...prior}; return;
    }
    verifyScope(await getVercelOidcToken());
    yield {phase:"Preparing repository context and dependencies"};
    const token=await getToken("github/jira-clone",{subject:{type:"app"}});
    const sandbox=await ctx.getSandbox();
    miningState.update(s=>({...s,sandboxStarted:true}));
    const result=await prepareRepository(sandbox,token,ctx.abortSignal,undefined,await activeWork(token,ctx.abortSignal));
    miningState.update(s=>({...s,...result}));
    log.set({factory:{stage:"prepare_context",outcome:result.prepared?"prepared":"incomplete",revision:result.revision,fileCount:result.files.length,commandCount:result.commands.length}});
    yield {phase:result.prepared?"Context prepared":"Context incomplete",...result};
  },
  toModelOutput(output) {
    return {type:"text",value:JSON.stringify("files" in output ? {phase:output.phase,revision:output.revision,fileCount:output.files.length,prepared:output.prepared,contextGaps:output.contextGaps,setup:output.commands.map(c=>({exitCode:c.exitCode,stdout:c.stdout.slice(-1800),stderr:c.stderr.slice(-1800)})),workspace:"/workspace/repo",manifest:"/workspace/repo/.mining-snapshot.json"} : output)};
  },
});

export default defineDynamic({events:{"session.started":(_,ctx)=>stationOf(ctx) ? null : tool}});
