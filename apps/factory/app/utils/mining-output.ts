import { z } from "zod";

const githubReadSchema = z.object({
  resource: z.string(), complete: z.boolean(), capturedAt: z.string(),
  count: z.number().int().nonnegative().optional(), items: z.array(z.unknown()).optional(),
}).transform(read => ({ ...read, count: read.count ?? read.items?.length }));

export const miningProposalSchema = z.object({
  id: z.string().min(1).optional(),
  rank: z.number().int().positive().optional(),
  provenance: z.object({ sessionId: z.string(), repository: z.string(), revision: z.string(), capturedAt: z.string(), executionSurface: z.literal("native-eve"), source: z.literal("git-revision") }).optional(),
  title: z.string(), outcome: z.string(), whyNow: z.string(),
  evidence: z.array(z.string()), existingWork: z.string(),
  scope: z.array(z.string()), acceptanceCriteria: z.array(z.string()), uncertainties: z.array(z.string()),
});
export type MiningProposal = z.infer<typeof miningProposalSchema>;
const reflectionSchema = z.object({
  helpfulContext: z.array(z.string()), missingContext: z.array(z.string()),
  contradictions: z.array(z.string()), suggestedImprovements: z.array(z.string()),
});

// This is a display boundary for durable records, including earlier fx sessions.
// It deliberately ignores model-only fields; trusted evidence comes from tool output.
const outputSchema = z.object({
  phase: z.string(),
  error: z.string().optional(),
  report: z.string().optional(),
  proposals: z.array(miningProposalSchema).optional(),
  noProposalReason: z.string().optional(),
  reflection: reflectionSchema.optional(),
  revision: z.union([z.string().regex(/^[a-f0-9]{40}$/), z.literal("")]).optional().transform(value => value || undefined),
  capturedAt: z.string().optional(),
  executionSurface: z.string().optional(),
  files: z.array(z.object({ file: z.string(), bytes: z.number(), sha256: z.string() })).optional(),
  githubReads: z.array(githubReadSchema).optional(),
  commands: z.array(z.object({ command: z.string(), exitCode: z.number().nullable(), stdout: z.string(), stderr: z.string(), capturedAt: z.string(), truncated: z.boolean().optional() })).optional(),
  contextGaps: z.array(z.string()).optional(),
  vercelReads: z.array(z.object({ resource: z.string(), projectId: z.string(), capturedAt: z.string(), complete: z.boolean(), coverage: z.string().optional(), summary: z.string().optional() })).optional(),
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

export function proposalDraft(input: {
  proposal: MiningProposal; index: number; sessionId: string;
  revision?: string; capturedAt?: string; phase: string; contextGaps?: string[];
}) {
  const { proposal, index, sessionId, revision, capturedAt, phase, contextGaps } = input;
  const list = (values: string[]) => values.map(value => `- ${value}`).join("\n");
  const id = proposal.id || `${sessionId}:proposal:${index + 1}`;
  const sections = [proposal.outcome, `## Why now\n\n${proposal.whyNow}`, `## Evidence\n\n${list(proposal.evidence)}`,
    `## Existing work\n\n${proposal.existingWork}`, `## Scope\n\n${list(proposal.scope)}`,
    `## Acceptance criteria\n\n${list(proposal.acceptanceCriteria)}`];
  if (proposal.uncertainties.length) sections.push(`## Uncertainties\n\n${list(proposal.uncertainties)}`);
  if (contextGaps?.length) sections.push(`## Investigation context gaps\n\n${list(contextGaps)}`);
  const provenance = proposal.provenance;
  sections.push(`---\nProposal: ${id}\nProposal identity: ${proposal.id && provenance ? "Recorded by the investigation" : "Derived from the legacy session and proposal position"}\nInvestigation: ${provenance?.sessionId || sessionId}\nRepository: ${provenance?.repository || "software-factory-workshop/jira-clone"}\nSource revision: ${provenance?.revision || revision || "Unavailable"}\nCaptured: ${provenance?.capturedAt || capturedAt || "Unavailable"}\nInvestigation status: ${phase}\n\nSelected for review as an editable draft. Implementation has not started.`);
  return { title: proposal.title, body: sections.join("\n\n") };
}
