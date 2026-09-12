import { z } from "zod";

export const vercelTeamId = "team_Ljrc7ENgQWsCySwCwijvA0zy";
export const vercelProjects = {
  cockpit: "prj_ZXLHFUJhgo5EdvSf1IstOMn0ft0A",
  jira: "prj_C3sDKTOQIOqpIpNO9w7bqcWYkwp4",
} as const;
export const vercelInput = z.object({
  project: z.enum(["cockpit", "jira"]),
  resource: z.enum(["project", "deployments", "build_logs", "runtime_logs"]),
  deploymentId: z.string().regex(/^dpl_[A-Za-z0-9]+$/).optional(),
}).strict();
export type VercelInput = z.infer<typeof vercelInput>;
export interface VercelReceipt {
  resource: string; projectId: string; capturedAt: string; complete: boolean;
  items: unknown[]; gap?: string;
}
// Preserve receipt history but judge availability from the last attempt at each
// resource. A recovered read must not permanently poison the investigation.
export function latestVercelReads<T extends { resource: string; projectId?: string }>(reads: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const receipt of reads) latest.set(`${receipt.projectId || "unknown"}/${receipt.resource}`, receipt);
  return [...latest.values()];
}
export function latestVercelGaps(reads: readonly { resource: string; projectId?: string; complete: boolean; gap?: string }[]): string[] {
  return latestVercelReads(reads).filter(receipt => !receipt.complete)
    .map(receipt => receipt.gap || `Vercel ${receipt.resource} evidence is incomplete for ${receipt.projectId || "unknown project"}.`);
}

export interface EvidenceClient {
  tools: Set<string>;
  call(name: string, args: Record<string, unknown>): Promise<unknown>;
}
const object = z.record(z.string(), z.unknown());
function data(result: unknown): unknown {
  const envelope = object.parse(result);
  if (envelope.isError) throw new Error("Vercel MCP returned an error.");
  if (envelope.structuredContent) return envelope.structuredContent;
  const text = z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()).parse(envelope.content)
    .filter(part => part.type === "text").map(part => part.text || "").join("\n");
  try { return JSON.parse(text); } catch { return { text }; }
}

// Only these operations are callable, even if the MCP server advertises writes.
export async function readVercel(inputValue: VercelInput, client: EvidenceClient): Promise<VercelReceipt> {
  const input = vercelInput.parse(inputValue);
  const projectId = vercelProjects[input.project];
  const receipt: VercelReceipt = { resource: input.resource, projectId, capturedAt: new Date().toISOString(), complete: false, items: [] };
  const unavailable = (gap: string) => ({ ...receipt, gap });
  async function call(name: string, args: Record<string, unknown>) {
    if (!client.tools.has(name)) throw new Error(`Vercel MCP does not expose ${name}.`);
    return data(await client.call(name, { ...args, teamId: vercelTeamId }));
  }
  // Runtime log tools are not part of the verified contract yet. Never invent
  // a tool name or replace unavailable logs with an empty successful read.
  if (input.resource === "runtime_logs") return unavailable("Runtime-log access is not verified for this Vercel MCP connection.");
  if (input.resource === "project") {
    const result = object.parse(await call("get_project", { projectId }));
    const project = object.parse(result.project || result);
    if (project.id !== projectId) throw new Error("Vercel returned a different project.");
    const { id, name, framework, link, updatedAt } = project;
    return { ...receipt, complete: true, items: [{ id, name, framework, link, updatedAt }] };
  }
  if (input.resource === "deployments") {
    const result = object.parse(await call("list_deployments", { projectId }));
    const deployments = z.array(object).parse(result.deployments);
    if (deployments.some(item => item.projectId && item.projectId !== projectId)) throw new Error("Vercel returned an out-of-scope deployment.");
    const pagination = result.pagination ? object.parse(result.pagination) : undefined;
    return { ...receipt, complete: !pagination || !pagination.next, items: deployments,
      ...(pagination && pagination.next ? { gap: "Only the returned deployment page is included; older deployments remain uninspected." } : {}) };
  }
  if (!input.deploymentId) return unavailable("Choose a deployment ID from this project's deployment evidence before reading build logs.");
  const deploymentData = object.parse(await call("get_deployment", { idOrUrl: input.deploymentId }));
  const deployment = object.parse(deploymentData.deployment || deploymentData);
  if (deployment.projectId !== projectId || (deployment.id || deployment.uid) !== input.deploymentId) {
    throw new Error("Deployment does not belong to the selected project.");
  }
  const logs = await call("get_deployment_build_logs", { idOrUrl: input.deploymentId });
  return { ...receipt, complete: true, items: [logs] };
}

export async function withVercelClient<T>(token: string, signal: AbortSignal, action: (client: EvidenceClient) => Promise<T>): Promise<T> {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const client = new Client({ name: "adeo-task-mining", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("https://mcp.vercel.com"), {
    requestInit: { headers: { Authorization: `Bearer ${token}` }, signal },
  });
  try {
    await client.connect(transport, { signal, timeout: 20000 });
    const catalog = await client.listTools(undefined, { signal, timeout: 20000 });
    return await action({ tools: new Set(catalog.tools.map(tool => tool.name)),
      call: (name, args) => client.callTool({ name, arguments: args }, undefined, { signal, timeout: 20000 }),
    });
  } finally { await client.close(); }
}
