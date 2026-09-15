import { browserRequirements, type BrowserReviewApp } from "./review-browser.ts";
import { readPull, readPullFiles, submitPullRequestReview, updatePullRequestBody, type PullRequestFile, type PullRequestReviewReceipt } from "./work-github.ts";
import { buildVisualReviewPacket, visualReviewFeedbackMarker, withVisualReviewSection, type VisualReviewPacket } from "./visual-review.ts";

export type ReviewVerdict = "approve" | "changes_requested" | "incomplete";
export type ReviewFeedbackKind = "recorded" | "incomplete";

export interface ReviewFinding {
  severity: "blocking" | "nonblocking";
  path: string;
  message: string;
  evidence: string;
}

export interface ReviewFeedbackResult {
  station: "reviewer";
  sessionId: string;
  prNumber: number;
  url: string;
  baseSha: string;
  headSha: string;
  targetBranch: string;
  verdict: ReviewVerdict;
  summary: string;
  findings: ReviewFinding[];
  limitations: string[];
  visualReview: VisualReviewPacket;
  commands: [];
  browserEvidence: { complete: false; observations: [] };
  capturedAt: string;
}

export interface ReviewFeedbackPublication {
  body: "published" | "not_required" | "failed";
  githubReview: "published" | "already_published" | "failed";
  review?: PullRequestReviewReceipt;
  errors: string[];
}

function bounded(value: string, limit: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function errorMessage(error: unknown) {
  return bounded(error instanceof Error ? error.message : String(error || "unknown publication error"), 500);
}

function verdictLabel(verdict: ReviewVerdict) {
  switch (verdict) {
    case "approve": return "Approved";
    case "changes_requested": return "Changes requested";
    case "incomplete": return "Incomplete";
  }
}

export function reviewFeedbackCommentBody(input: {
  kind: ReviewFeedbackKind;
  verdict: ReviewVerdict;
  summary: string;
  findings: ReviewFinding[];
  limitations: string[];
  visualReview: VisualReviewPacket;
  baseSha: string;
  headSha: string;
  targetBranch: string;
}) {
  const findings = input.findings.length
    ? input.findings.map(finding => `- **${bounded(finding.severity, 40)}** \`${bounded(finding.path, 240)}\`: ${bounded(finding.message, 500)} — ${bounded(finding.evidence, 500)}`).join("\n")
    : "- None recorded.";
  const limitations = input.limitations.length
    ? input.limitations.map(limitation => `- ${bounded(limitation, 500)}`).join("\n")
    : "- None recorded.";
  return [
    visualReviewFeedbackMarker(input.headSha, input.kind, input.baseSha, input.targetBranch),
    "## Factory visual review",
    "",
    `**Verdict:** ${verdictLabel(input.verdict)} · **Visual packet:** ${input.visualReview.status}`,
    `**Exact candidate:** \`${input.headSha}\` · **Target:** \`${bounded(input.targetBranch, 200)} @ ${input.baseSha}\``,
    "",
    bounded(input.summary, 3000),
    "",
    "### Findings",
    findings,
    "",
    "### Limitations",
    limitations,
    "",
    "The PR description contains the replaceable before/after visual packet when browser frames were captured. This is supplementary evidence; it is not merge permission or a substitute for correctness, accessibility, or deployment checks.",
  ].join("\n");
}

/**
 * Publish both durable PR-body evidence and a visible GitHub COMMENT review.
 * Each destination is attempted independently so one provider failure cannot
 * hide the other; callers decide whether a partial publication is acceptable.
 */
export async function publishReviewFeedback(input: {
  token: string;
  prNumber: number;
  currentBody: string;
  headSha: string;
  baseSha: string;
  targetBranch: string;
  verdict: ReviewVerdict;
  summary: string;
  findings: ReviewFinding[];
  limitations: string[];
  visualReview: VisualReviewPacket;
  includeVisualSection: boolean;
  kind: ReviewFeedbackKind;
  signal?: AbortSignal;
}): Promise<ReviewFeedbackPublication> {
  const errors: string[] = [];
  let body: ReviewFeedbackPublication["body"] = input.includeVisualSection ? "failed" : "not_required";
  let githubReview: ReviewFeedbackPublication["githubReview"] = "failed";
  let review: PullRequestReviewReceipt | undefined;

  if (input.includeVisualSection) {
    try {
      const section = withVisualReviewSection(input.currentBody, input.visualReview, {
        baseSha: input.baseSha,
        headSha: input.headSha,
        targetBranch: input.targetBranch,
      });
      await updatePullRequestBody(input.token, input.prNumber, input.headSha, section, input.signal);
      body = "published";
    } catch (error) {
      errors.push(`PR visual section publication failed: ${errorMessage(error)}`);
    }
  }

  try {
    review = await submitPullRequestReview(
      input.token,
      input.prNumber,
      input.headSha,
      reviewFeedbackCommentBody(input),
      input.signal,
      input.baseSha,
      input.targetBranch,
      visualReviewFeedbackMarker(input.headSha, input.kind, input.baseSha, input.targetBranch),
    );
    githubReview = review.deduplicated ? "already_published" : "published";
  } catch (error) {
    errors.push(`GitHub review publication failed: ${errorMessage(error)}`);
  }

  return { body, githubReview, ...(review ? { review } : {}), errors };
}

/** Build and publish a safe host-owned fallback when a reviewer stops early. */
export async function createIncompleteReviewFeedback(input: {
  token: string;
  prNumber: number;
  reviewerSessionId: string;
  reason: string;
  headSha?: string;
  baseSha?: string;
  targetBranch?: string;
  files?: PullRequestFile[];
  signal?: AbortSignal;
}): Promise<{ review: ReviewFeedbackResult; publication: ReviewFeedbackPublication }> {
  const pull = await readPull(input.token, input.prNumber, input.signal);
  const headSha = input.headSha || pull.head.sha;
  if (pull.state !== "open" || pull.head.sha !== headSha) throw new Error("Pull request changed or closed before incomplete review feedback could be published.");

  let files = input.files;
  let inventoryLimitation: string | undefined;
  if (!files) {
    try {
      files = await readPullFiles(input.token, input.prNumber, input.signal);
    } catch (error) {
      inventoryLimitation = `Changed-file inventory was unavailable while creating the incomplete visual packet: ${errorMessage(error)}`;
      files = [];
    }
  }
  const requiredApps: BrowserReviewApp[] = inventoryLimitation ? ["jira", "factory"] : browserRequirements(files);
  const baseSha = input.baseSha || pull.base.sha;
  const targetBranch = input.targetBranch || pull.base.ref;
  const limitations = [bounded(input.reason, 500), ...(inventoryLimitation ? [inventoryLimitation] : [])];
  const visualReview = buildVisualReviewPacket({
    version: 1,
    requiredApps,
    baseSha,
    headSha,
    targetBranch,
    reviewerSessionId: input.reviewerSessionId,
    capturedAt: new Date().toISOString(),
    artifacts: [],
    limitations,
  });
  const summary = "The reviewer stopped before recording a trusted verdict. This host-owned incomplete result keeps the exact candidate visible and blocks approval.";
  const publication = await publishReviewFeedback({
    token: input.token,
    prNumber: input.prNumber,
    currentBody: pull.body || "",
    headSha,
    baseSha,
    targetBranch,
    verdict: "incomplete",
    summary,
    findings: [],
    limitations,
    visualReview,
    includeVisualSection: requiredApps.length > 0,
    kind: "incomplete",
    signal: input.signal,
  });
  const finalLimitations = [...limitations, ...publication.errors.map(error => bounded(error, 500))].slice(0, 10);
  return {
    review: {
      station: "reviewer",
      sessionId: input.reviewerSessionId,
      prNumber: pull.number,
      url: pull.html_url,
      baseSha,
      headSha,
      targetBranch,
      verdict: "incomplete",
      summary,
      findings: [],
      limitations: finalLimitations,
      visualReview,
      commands: [],
      browserEvidence: { complete: false, observations: [] },
      capturedAt: new Date().toISOString(),
    },
    publication,
  };
}
