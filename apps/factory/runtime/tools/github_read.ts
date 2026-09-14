import { defineDynamic } from "eve";
import { useLogger } from "evlog/eve";
import { stationOf } from "../lib/station-access";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getToken } from "@vercel/connect";
import { readGithub } from "../lib/github.mjs";
import { miningState } from "../lib/mining-state";
import { githubConnectorName } from "../lib/factory-config.ts";
const tool = defineTool({
 description:"Read all issues, pull requests or comments in the fixed ADEO repository. Inventories include closed work; failures never count as empty. This tool does not return commit history, branches, check runs or CI logs; name those as unavailable evidence when a claim needs them.",
 inputSchema:z.object({resource:z.enum(["issues","pulls","issue_comments"]),number:z.number().int().positive().nullable().optional()}),
 async execute(input,ctx){
   const token=await getToken(githubConnectorName,{subject:{type:"app"}});
   const receipt=await readGithub(input,token,ctx.abortSignal);
   miningState.update(s=>({...s,githubReads:[...s.githubReads,receipt]}));
   useLogger(ctx).set({github:{resource:input.resource,complete:receipt.complete,count:receipt.items.length,...(input.number?{number:input.number}:{})}});
   return receipt;
 }
});

export default defineDynamic({events:{"session.started":(_,ctx)=>stationOf(ctx) ? null : tool}});
