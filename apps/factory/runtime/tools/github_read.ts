import { defineDynamic } from "eve";
import { stationOf } from "../lib/station-access";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { readGithub } from "../lib/github.mjs";
import { miningState } from "../lib/mining-state";
const tool = defineTool({
 description:"Read all issues, pull requests or comments in the fixed ADEO repository. Inventories include closed work; failures never count as empty.",
 inputSchema:z.object({resource:z.enum(["issues","pulls","issue_comments"]),number:z.number().int().positive().nullable().optional()}),
 async execute(input,ctx){
   const token=await getToken("github/jira-clone",{subject:{type:"app"}});
   const receipt=await readGithub(input,token,ctx.abortSignal);
   miningState.update(s=>({...s,githubReads:[...s.githubReads,receipt]}));
   return receipt;
 }
});

export default defineDynamic({events:{"session.started":(_,ctx)=>stationOf(ctx) ? null : tool}});
