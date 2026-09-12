import { defineTool } from "eve/tools";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { getVercelOidcToken } from "@vercel/oidc";
import { verifyScope } from "../lib/github.mjs";
import { prepareRepository } from "../lib/prepare-context";
import { miningState } from "../lib/mining-state";
export default defineTool({
  description:"Prepare the pinned repository and dependency-complete native Eve sandbox. Call this first, once per investigation.",
  inputSchema:z.object({}),
  async *execute(_,ctx) {
    const prior=miningState.get();
    if(prior.revision) { yield {phase:"Context prepared",...prior}; return; }
    verifyScope(await getVercelOidcToken());
    yield {phase:"Preparing repository context and dependencies"};
    const token=await getToken("github/jira-clone",{subject:{type:"app"}});
    miningState.update(s=>({...s,sandboxStarted:true}));
    const result=await prepareRepository(await ctx.getSandbox(),token,ctx.abortSignal);
    miningState.update(s=>({...s,...result}));
    yield {phase:result.prepared?"Context prepared":"Context incomplete",...result};
  },
  toModelOutput(output) {
    return {type:"text",value:JSON.stringify("files" in output ? {phase:output.phase,revision:output.revision,fileCount:output.files.length,prepared:output.prepared,contextGaps:output.contextGaps,setup:output.commands.map(c=>({exitCode:c.exitCode,stdout:c.stdout.slice(-1800),stderr:c.stderr.slice(-1800)})),workspace:"/workspace/repo",manifest:"/workspace/repo/.mining-snapshot.json"} : output)};
  },
});
