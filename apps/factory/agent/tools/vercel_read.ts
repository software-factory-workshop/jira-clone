import { defineTool } from "eve/tools";
import { connect } from "@vercel/connect/eve";
import { miningState } from "../lib/mining-state";
import { vercelInput, vercelProjects, readVercel, withVercelClient } from "../lib/vercel-context";

const vercelAuth = connect({ connector: "vercel/jira-clone", principalType: "user" });

export default defineTool({
  description: "Read Vercel project, deployment or build evidence for the ADEO cockpit or Jira project in demo-software-factory. Uses your Vercel authorization. Missing authorization or unsupported logs are context gaps. No deployment or configuration writes are available.",
  inputSchema: vercelInput,
  async execute(input, ctx) {
    // Eve must receive its authorization suspension to drive the durable consent
    // flow. Do not catch it and misreport an interrupted sign-in as a tool result.
    const { token } = await ctx.getToken(vercelAuth);
    let receipt;
    try {
      receipt = await withVercelClient(token, ctx.abortSignal, client => readVercel(input, client));
    } catch {
      if (ctx.abortSignal.aborted) throw ctx.abortSignal.reason;
      receipt = { resource: input.resource, projectId: vercelProjects[input.project], capturedAt: new Date().toISOString(), complete: false, items: [],
        gap: "Vercel evidence was unavailable or did not satisfy the fixed-project read contract. No empty successful result is inferred." };
    }
    miningState.update(state => ({ ...state, vercelReads: [...state.vercelReads, receipt] }));
    return receipt;
  },
});
