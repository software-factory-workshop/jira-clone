import { z } from "zod";
import { repository } from "./github.mjs";

// IDs and provenance belong to the host. Reject attempts to supply either as
// model output instead of silently accepting or trusting invented references.
export const proposalInputSchema = z.object({
  title: z.string().min(1).max(200),
  outcome: z.string().min(1),
  whyNow: z.string().min(1),
  evidence: z.array(z.string()).min(1),
  existingWork: z.string(),
  scope: z.array(z.string()).min(1),
  acceptanceCriteria: z.array(z.string()).min(1),
  uncertainties: z.array(z.string()),
}).strict();

export type ProposalInput = z.infer<typeof proposalInputSchema>;
export interface ProposalProvenance {
  sessionId: string;
  repository: string;
  revision: string;
  capturedAt: string;
  executionSurface: "native-eve";
  source: "git-revision";
}
export interface RecordedProposal extends ProposalInput {
  id: string;
  rank: number;
  provenance: ProposalProvenance;
}

export function recordProposals(
  proposals: readonly ProposalInput[],
  context: Pick<ProposalProvenance, "sessionId" | "revision" | "capturedAt">,
): RecordedProposal[] {
  return proposals.map((value, index) => {
    const proposal = proposalInputSchema.parse(value);
    const rank = index + 1;
    return {
      ...proposal,
      id: `${context.sessionId}:proposal:${rank}`,
      rank,
      provenance: { ...context, repository, executionSurface: "native-eve", source: "git-revision" },
    };
  });
}

export function renderProposal(proposal: ProposalInput, rank: number): string {
  const list = (items: string[]) => items.map(item => `- ${item}`).join("\n");
  return `## ${rank}. ${proposal.title}\n\n${proposal.outcome}\n\n**Why now:** ${proposal.whyNow}\n\n**Evidence**\n${list(proposal.evidence)}\n\n**Existing work:** ${proposal.existingWork}\n\n**Scope**\n${list(proposal.scope)}\n\n**Acceptance criteria**\n${list(proposal.acceptanceCriteria)}\n\n**Uncertainties**\n${list(proposal.uncertainties) || "None identified."}`;
}
