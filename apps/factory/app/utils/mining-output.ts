import { z } from "zod";

const githubReadSchema = z.object({
  resource: z.string(), complete: z.boolean(), capturedAt: z.string(),
  count: z.number().int().nonnegative().optional(), items: z.array(z.unknown()).optional(),
}).transform(read => ({ ...read, count: read.count ?? read.items?.length }));

// This is a display boundary for durable records, including earlier fx sessions.
// It deliberately ignores model-only fields; trusted evidence comes from tool output.
const outputSchema = z.object({
  phase: z.string(),
  error: z.string().optional(),
  report: z.string().optional(),
  revision: z.union([z.string().regex(/^[a-f0-9]{40}$/), z.literal("")]).optional().transform(value => value || undefined),
  capturedAt: z.string().optional(),
  executionSurface: z.string().optional(),
  files: z.array(z.object({ file: z.string(), bytes: z.number(), sha256: z.string() })).optional(),
  githubReads: z.array(githubReadSchema).optional(),
  commands: z.array(z.object({ command: z.string(), exitCode: z.number().nullable(), stdout: z.string(), stderr: z.string(), capturedAt: z.string(), truncated: z.boolean().optional() })).optional(),
  contextGaps: z.array(z.string()).optional(),
  vercelReads: z.array(z.object({ resource: z.string(), projectId: z.string(), capturedAt: z.string(), complete: z.boolean(), summary: z.string().optional() })).optional(),
});

export function parseMiningOutput(value: unknown) {
  const parsed = outputSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function miningProgress(toolName: string, output: unknown) {
  const phase = z.object({ phase: z.string() }).safeParse(output);
  if (phase.success) return phase.data.phase;
  const labels: Record<string, string> = {
    prepare_context: "Preparing the repository and reproduction environment",
    github_read: "Inspecting GitHub work and evidence",
    vercel_read: "Inspecting Vercel deployment evidence",
    bash: "Checking behavior in the sandbox",
    read_file: "Reading repository context and code",
    grep: "Searching repository evidence",
    glob: "Finding relevant source files",
    record_findings: "Recording proposals and their evidence",
  };
  return labels[toolName] || "Investigating the goal and available evidence";
}

export function authorizationLink(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch { return undefined; }
}
