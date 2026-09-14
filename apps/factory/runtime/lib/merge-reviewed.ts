import { getToken } from '@vercel/connect';
import { z } from 'zod';
import { githubConnectorName } from './factory-config.ts';
import { inspectMergeCandidate, readGithubPullSnapshot, snapshotIsMergedCandidate, type PullPublicationBinding } from './pr-lifecycle.ts';
import { githubRequest } from './work-github.ts';
import { changeResource } from './cedar/model.ts';
import { factoryDeliveryDriverPrincipal } from './cedar/guard.ts';
import { runFactoryOperation, type FactoryDecisionAudit } from './cedar/operation-runner.ts';
import type { MergeDecision, MergeReview } from './merge-policy.ts';

export interface MergeInput {
  publication: PullPublicationBinding & { ownerSessionId: string };
  review: MergeReview;
  reviewerSessionId: string;
}

const mergeResponseSchema = z.object({
  merged: z.boolean(),
  sha: z.string().regex(/^[a-f0-9]{40}$/).optional(),
}).passthrough();

// GitHub remains the final authority: the candidate is re-read immediately
// before mutation and the mutation is accepted only after an exact merged
// readback. Draft -> ready is deliberately a separate operator action.
export async function mergeReviewed(input: MergeInput, token?: string): Promise<MergeDecision> {
  token ||= await getToken(githubConnectorName, { subject: { type: 'app' } });
  let authorization: FactoryDecisionAudit | undefined;
  try {
    const initial = await inspectMergeCandidate(token, input.publication, input.review, input.reviewerSessionId);
    if (initial.decision.status !== 'eligible') return initial.decision;

    const candidate = changeResource({
      id: String(input.publication.number),
      taskId: input.publication.ownerSessionId,
      candidateSha: input.publication.headSha,
      baseSha: input.publication.targetHeadSha,
      branch: input.publication.targetBranch,
      expectedRevision: input.publication.targetHeadSha,
    });
    const evidence = {
      id: `merge:${input.publication.number}:${input.publication.headSha}:${input.publication.targetHeadSha}`,
      source: 'factory.merge-policy',
      complete: true,
      candidateSha: input.publication.headSha,
    };
    const authorized = await runFactoryOperation({
      operationId: `merge:${input.publication.number}:${input.publication.headSha}:${input.publication.targetHeadSha}`,
      principal: factoryDeliveryDriverPrincipal(),
      action: 'merge_change',
      input: { pullRequest: String(input.publication.number), targetBranch: input.publication.targetBranch },
      resource: candidate,
      context: {
        expectedRevision: input.publication.targetHeadSha,
        candidateSha: input.publication.headSha,
        baseSha: input.publication.targetHeadSha,
        verifiedSha: input.publication.headSha,
        reviewedSha: input.review.headSha,
        branch: input.publication.targetBranch,
        lane: 'merge',
        budget: 0,
        riskClass: 'low',
        evidence,
      },
      onAudit: audit => { authorization = audit; },
      execute: async () => {
        const latest = await inspectMergeCandidate(token!, input.publication, input.review, input.reviewerSessionId);
        if (latest.decision.status === 'merged') return latest.decision;
        if (latest.decision.status !== 'eligible') return latest.decision;

        // GitHub atomically binds this mutation to the requested head SHA. The
        // target branch was re-read immediately before it, so this narrow
        // low-risk driver can reject stale candidates; broader merges remain
        // human-controlled or require stronger queue-level serialization.
        const response = await githubRequest(token!, `pulls/${input.publication.number}/merge`, undefined, {
          sha: input.publication.headSha,
          merge_method: 'merge',
        }, 'PUT');
        const result = mergeResponseSchema.safeParse(response.data);
        if (!result.success || !result.data.merged) return { status: 'manual' as const, reason: 'GitHub refused to merge the candidate.' };

        const confirmed = await readGithubPullSnapshot(token!, input.publication);
        if (!snapshotIsMergedCandidate(confirmed, input.publication)) {
          return { status: 'manual' as const, reason: 'GitHub did not confirm that the exact reviewed candidate was merged.' };
        }
        return {
          status: 'merged' as const,
          reason: 'Low-risk candidate merged after independent verification and green GitHub checks.',
          ...(confirmed.mergeCommitSha || result.data.sha ? { commitSha: confirmed.mergeCommitSha || result.data.sha } : {}),
        };
      },
      isSuccess: result => result.status === 'merged',
    });
    return { ...authorized.output, authorization: authorized.audit };
  } catch (error) {
    return {
      status: 'manual',
      reason: error instanceof Error ? error.message : 'Merge could not be verified.',
      ...(authorization ? { authorization } : {}),
    };
  }
}
