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
  items: unknown[]; gap?: string; coverage?: string;
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

export const vercelMachineConnector = "factory/jira-clone-machine";
const object = z.record(z.string(), z.unknown());

// Paths and request parameters follow the official vercel/sdk operation sources.
// The only transport capability exposed here is fixed-host HTTP GET.
export async function readVercel(inputValue: VercelInput, token: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<VercelReceipt> {
  const input = vercelInput.parse(inputValue);
  const projectId = vercelProjects[input.project];
  const receipt: VercelReceipt = { resource: input.resource, projectId, capturedAt: new Date().toISOString(), complete: false, items: [] };
  const abortSignal = AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(20000)]);
  async function request(path: string, query: Record<string, string> = {}, accept = "application/json") {
    const url = new URL(path, "https://api.vercel.com");
    url.search = new URLSearchParams({ ...query, teamId: vercelTeamId }).toString();
    const response = await fetcher(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: accept }, redirect: "error", signal: abortSignal });
    if (!response.ok) throw new Error(`Vercel ${input.resource} read failed: HTTP ${response.status}.`);
    return response;
  }
  if (input.resource === "project") {
    const project = object.parse(await (await request(`/v9/projects/${projectId}`)).json());
    if (project.id !== projectId || (project.accountId && project.accountId !== vercelTeamId)) throw new Error("Vercel returned a different project or team.");
    const { id, name, framework, link, updatedAt } = project;
    return { ...receipt, complete: true, items: [{ id, name, framework, link, updatedAt }] };
  }
  if (input.resource === "deployments") {
    const result = object.parse(await (await request("/v6/deployments", { projectId, limit: "20" })).json());
    const deployments = z.array(object).parse(result.deployments);
    if (deployments.some(item => item.projectId && item.projectId !== projectId)) throw new Error("Vercel returned an out-of-scope deployment.");
    const pagination = result.pagination ? object.parse(result.pagination) : undefined;
    // The requested evidence is a recent page, not a claim about all history.
    return { ...receipt, complete: true, items: deployments.map(({uid,id,url,state,readyState,created,createdAt,meta,target,projectId}) => ({uid,id,url,state,readyState,created,createdAt,meta,target,projectId})),
      coverage: pagination?.next ? "Most recent 20 deployments; older deployment history exists and was not requested." : "All deployments returned by the project listing." };
  }
  if (!input.deploymentId) return { ...receipt, gap: "Choose a deployment ID from this project's deployment evidence before reading logs." };
  const deployment = object.parse(await (await request(`/v13/deployments/${input.deploymentId}`)).json());
  if (deployment.projectId !== projectId || (deployment.id || deployment.uid) !== input.deploymentId) throw new Error("Deployment does not belong to the selected project.");
  if (input.resource === "build_logs") {
    const logs = z.array(object).parse(await (await request(`/v3/deployments/${input.deploymentId}/events`, { limit: "100", direction: "backward", follow: "0", builds: "1" })).json());
    return { ...receipt, complete: true, items: logs, coverage: "Most recent 100 build events; this is a bounded log sample." };
  }
  // Official runtime endpoint returns application/stream+json. Bound this read
  // to ten seconds and 100 records; do not confuse a sample with full history.
  const response = await request(`/v1/projects/${projectId}/deployments/${input.deploymentId}/runtime-logs`, {}, "application/stream+json");
  if (!response.body) throw new Error("Vercel runtime-log response had no body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const items: unknown[] = [];
  let pending = "";
  let bytes = 0;
  let ended = false;
  const deadline = Date.now() + 10000;
  try {
    while (items.length < 100 && Date.now() < deadline) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const chunk = await Promise.race([reader.read(), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), Math.max(1, deadline - Date.now())); })]).finally(() => { if (timer) clearTimeout(timer); });
      if (!chunk) break;
      if (chunk.done) { ended = true; break; }
      bytes += chunk.value.byteLength;
      if (bytes > 512000) throw new Error("Vercel runtime-log sample exceeded the byte limit.");
      pending += decoder.decode(chunk.value, { stream: true });
      const lines = pending.split("\n"); pending = lines.pop() || "";
      for (const line of lines) if (line.trim() && items.length < 100) items.push(object.parse(JSON.parse(line)));
    }
    if (ended && pending.trim() && items.length < 100) items.push(object.parse(JSON.parse(pending)));
  } finally { await reader.cancel(); }
  return { ...receipt, complete: true, items, coverage: "Runtime stream sample, up to 10 seconds or 100 records; no claim of complete retained history." };
}
