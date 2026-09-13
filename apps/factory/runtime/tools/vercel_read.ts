import { defineDynamic } from "eve";
import { useLogger } from "evlog/eve";
import { stationOf } from "../lib/station-access";
import { defineTool } from "eve/tools";
import { getToken } from "@vercel/connect";
import { miningState } from "../lib/mining-state";
import { vercelInput, vercelProjects, vercelMachineConnector, readVercel, vercelCredentialExpiryGap } from "../lib/vercel-context";

const tool = defineTool({
  description: "Read Vercel project, deployment or build evidence for the ADEO cockpit or Jira project in demo-software-factory. Uses the factory machine credential. Missing configuration or unavailable logs are context gaps. No deployment or configuration writes are available.",
  inputSchema: vercelInput,
  async execute(input, ctx) {
    let receipt;
    try {
      const token = await getToken(vercelMachineConnector, { subject: { type: "app" } });
      receipt = await readVercel(input, token, ctx.abortSignal);
    } catch (error) {
      if (ctx.abortSignal.aborted) throw ctx.abortSignal.reason;
      receipt = { resource: input.resource, projectId: vercelProjects[input.project], capturedAt: new Date().toISOString(), complete: false, items: [],
        gap: error instanceof Error && error.name === "TimeoutError"
          ? `Vercel ${input.resource} did not finish within the 20-second read deadline; its evidence is unavailable for this attempt.`
          : "Vercel machine access was not configured, expired, denied or returned invalid evidence. Configure the app-scoped factory/jira-clone-machine connector; no user sign-in or empty successful result is inferred." };
    }
    const expiry = vercelCredentialExpiryGap();
    if (expiry) receipt = { ...receipt, gap: receipt.gap ? `${receipt.gap} ${expiry}` : expiry };
    miningState.update(state => ({ ...state, vercelReads: [...state.vercelReads, receipt] }));
    useLogger(ctx).set({vercel:{project:input.project,resource:input.resource,complete:receipt.complete,count:receipt.items.length,...(input.deploymentId?{deploymentId:input.deploymentId}:{})}});
    return receipt;
  },
});

export default defineDynamic({events:{"session.started":(_,ctx)=>stationOf(ctx) ? null : tool}});
