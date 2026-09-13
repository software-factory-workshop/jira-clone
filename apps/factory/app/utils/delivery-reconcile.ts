// Reconcile a manually merged delivery against GitHub pull-request evidence.
//
// Factory-only, read-only projection. This helper never mutates the saved
// delivery, never merges code, and never bypasses review. It decides whether
// the exact recorded PR number, target branch and candidate head are
// confirmed merged on GitHub, while preserving review evidence, one-writer
// ownership, stale-head fences, child-PR targets and terminal history.
//
// Marking the saved delivery `merged` still requires a separately reviewed
// factory change; the cockpit surfaces this result without rewriting history.
export interface ReconcilePublication {
  number: number;
  url?: string;
  headSha: string;
  targetHeadSha: string;
  targetBranch: string;
  ownerSessionId: string;
  branch: string;
}

export interface ReconcileReview {
  headSha: string;
  baseSha: string;
  targetBranch: string;
  verdict: string;
  findings: Array<{ severity: string }>;
  limitations: string[];
}

export interface SavedDeliveryForReconcile {
  phase: string;
  publication?: ReconcilePublication | null;
  review?: ReconcileReview | null;
  mergeReview?: ReconcileReview | null;
  reviewerSessionId?: string;
  mergeDecision?: { status: string } | null;
}

export interface GithubPullForReconcile {
  number: number;
  merged: boolean;
  state: string;
  headSha: string;
  targetBranch: string;
  commitSha?: string;
}

export interface ReconcileResult {
  eligible: boolean;
  reason: string;
  commitSha?: string;
}

const shaPattern = /^[a-f0-9]{40}$/;

// Only stopped deliveries that already carry a published candidate and an
// independent review can be reconciled. Active loops keep their driver and
// revision fences; cancelled loops stay cancelled.
const reconcilablePhases = new Set(["human_review", "ready", "blocked"]);

function unchanged(reason: string): ReconcileResult {
  return { eligible: false, reason };
}

function boundTo(review: ReconcileReview, publication: ReconcilePublication): boolean {
  return review.headSha === publication.headSha
    && review.baseSha === publication.targetHeadSha
    && review.targetBranch === publication.targetBranch;
}

export function reconcileManuallyMergedDelivery(
  saved: SavedDeliveryForReconcile | null | undefined,
  pr: GithubPullForReconcile | null | undefined,
): ReconcileResult {
  try {
    if (!saved || typeof saved !== "object") return unchanged("Saved delivery is unavailable.");
    // Idempotent: an already-merged delivery stays merged without re-checking GitHub.
    if (saved.phase === "merged") return { eligible: true, reason: "Delivery is already marked merged." };
    if (!reconcilablePhases.has(saved.phase)) {
      return unchanged(`Only a stopped delivery awaiting review can be reconciled (phase ${saved.phase}).`);
    }
    const publication = saved.publication;
    if (
      !publication || typeof publication.number !== "number" || !Number.isInteger(publication.number)
      || !shaPattern.test(publication.headSha || "") || !publication.targetBranch
    ) {
      return unchanged("No published pull request is recorded for this delivery.");
    }
    if (!publication.ownerSessionId || !publication.branch) {
      return unchanged("Publication ownership is incomplete; the branch owner cannot be verified.");
    }
    // Never bypass review: reconciliation requires the recorded independent
    // review bound to the exact published head and target.
    const review = saved.review;
    if (!review) return unchanged("Independent review evidence is missing; a manual merge cannot be reconciled without it.");
    if (!boundTo(review, publication)) {
      return unchanged("Recorded review is not bound to the published head and target.");
    }
    const blocking = Array.isArray(review.findings) && review.findings.some(finding => finding?.severity === "blocking");
    if (blocking || (review.verdict !== "approve" && review.verdict !== "incomplete")) {
      return unchanged("The recorded review requests changes; it cannot be reconciled as merged.");
    }
    if (!saved.reviewerSessionId || saved.reviewerSessionId === publication.ownerSessionId) {
      return unchanged("An independent reviewer is required.");
    }
    if (saved.mergeReview && !boundTo(saved.mergeReview, publication)) {
      return unchanged("Recorded merge evidence does not match the published candidate.");
    }
    // Fail closed when GitHub evidence is missing or disagrees.
    if (!pr || typeof pr !== "object") {
      return unchanged("GitHub pull-request evidence is unavailable; the saved delivery is unchanged.");
    }
    if (pr.number !== publication.number) {
      return unchanged("GitHub PR does not match the recorded PR number.");
    }
    if (pr.merged !== true || pr.state !== "closed") {
      return unchanged(`PR #${publication.number} is not merged on GitHub; the saved delivery is unchanged.`);
    }
    if (!shaPattern.test(pr.headSha || "") || pr.headSha !== publication.headSha) {
      return unchanged("GitHub head does not match the recorded candidate head; the PR changed after review.");
    }
    if (pr.targetBranch !== publication.targetBranch) {
      return unchanged("GitHub target does not match the recorded target branch; the PR was retargeted.");
    }
    const commitSha = pr.commitSha && shaPattern.test(pr.commitSha) ? pr.commitSha : undefined;
    return {
      eligible: true,
      reason: `PR #${publication.number} candidate ${publication.headSha.slice(0, 12)} is merged into ${publication.targetBranch}. Saved review evidence is preserved.`,
      ...(commitSha ? { commitSha } : {}),
    };
  } catch {
    return unchanged("Reconciliation could not be verified; the saved delivery is unchanged.");
  }
}
