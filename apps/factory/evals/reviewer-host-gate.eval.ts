import { randomUUID } from "node:crypto";
import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";
import {
  eventTypes,
  isRecord,
  isSessionTerminal,
  lastToolResultIndex,
  property,
  readNdjsonUntilSessionTerminal,
  stringProperty,
  toolResultError,
  toolResultEvents,
  toolResultNames,
  toolResultOutput,
} from "./support.ts";

const optIn = "FACTORY_RUN_REVIEWER_GATE_EVAL";
const reviewPrVariable = "FACTORY_REVIEW_GATE_PR";

function isRecordedReview(value: unknown, expectedPrNumber: number, expectedVerdict: string): boolean {
  if (!isRecord(value)) return false;
  const verdict = property(value, "verdict");
  const findings = property(value, "findings");
  const limitations = property(value, "limitations");
  const baseSha = property(value, "baseSha");
  const headSha = property(value, "headSha");
  return property(value, "station") === "reviewer"
    && verdict === expectedVerdict
    && property(value, "prNumber") === expectedPrNumber
    && Array.isArray(findings)
    && Array.isArray(limitations)
    && typeof baseSha === "string"
    && /^[a-f0-9]{40}$/.test(baseSha)
    && typeof headSha === "string"
    && /^[a-f0-9]{40}$/.test(headSha);
}

function hasPublishedFeedback(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const publication = property(value, "publication");
  if (!isRecord(publication)) return false;
  const errors = property(publication, "errors");
  const review = property(publication, "review");
  const packet = property(value, "visualReview");
  const requiredApps = isRecord(packet) ? property(packet, "requiredApps") : [];
  return ["published", "already_published"].includes(String(property(publication, "githubReview")))
    && isRecord(review)
    && typeof property(review, "id") === "number"
    && Array.isArray(errors)
    && errors.length === 0
    && (!Array.isArray(requiredApps) || requiredApps.length === 0 || property(publication, "body") === "published");
}

export default defineEval({
  description: "Reviewer host gates bound evidence and stop after the final verdict",
  tags: ["paid", "reviewer", "host-gate", "bounded"],
  metadata: { optIn, reviewPrVariable },
  timeoutMs: 240_000,
  async test(t) {
    if (process.env[optIn] !== "1") {
      t.skip(`Set ${optIn}=1 to run the independent reviewer against a real PR.`);
      return;
    }

    const prText = process.env[reviewPrVariable]?.trim();
    const prNumber = Number(prText);
    if (!prText || !Number.isInteger(prNumber) || prNumber < 1) {
      throw new Error(`${reviewPrVariable} must name an open pull request for this opt-in eval.`);
    }
    const expectedVerdict = process.env.FACTORY_REVIEW_GATE_EXPECTED_VERDICT?.trim() || "changes_requested";

    const start = await t.target.fetch("/factory/stations/reviewer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operationId: randomUUID(), prNumber }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!start.ok) throw new Error(`Reviewer station start failed with HTTP ${start.status}.`);
    const started: unknown = await start.json();
    const sessionId = stringProperty(started, "sessionId");
    if (!sessionId) throw new Error("Reviewer station returned no session.");

    const stream = await t.target.fetch(`/reviewer/eve/v1/session/${encodeURIComponent(sessionId)}/stream?startIndex=0`, {
      headers: { accept: "application/x-ndjson" },
      signal: AbortSignal.timeout(180_000),
    });
    const events = await readNdjsonUntilSessionTerminal(stream, 400);
    const reviewResults = toolResultEvents(events, "record_review");
    const successfulReview = reviewResults.find(event => isRecordedReview(toolResultOutput(event), prNumber, expectedVerdict));
    const publishedFeedback = reviewResults.find(event => hasPublishedFeedback(toolResultOutput(event)));
    const lastReview = lastToolResultIndex(events, "record_review");
    const trailingToolNames = lastReview < 0 ? [] : toolResultNames(events.slice(lastReview + 1));
    const trailingWork = trailingToolNames.filter(name => name.startsWith("browser") || name === "prepare_browser" || name === "verify_review");

    t.check(eventTypes(events).some(isSessionTerminal), equals(true));
    t.check(toolResultEvents(events, "prepare_review").length, equals(1));
    t.check(reviewResults.length >= 1 && reviewResults.length <= 3, equals(true));
    t.check(successfulReview !== undefined, equals(true));
    t.check(publishedFeedback !== undefined, equals(true));
    t.check(trailingWork.length, equals(0));
    t.check(
      reviewResults.some(event => toolResultError(event) !== undefined) || successfulReview !== undefined,
      satisfies(value => value === true, "host rejection is surfaced or a review is recorded"),
    );
    t.log(`Reviewed PR #${prNumber}; the stream contained ${reviewResults.length} record_review result(s), published GitHub feedback, and ${trailingWork.length} prohibited post-verdict tool action(s).`);
  },
});
