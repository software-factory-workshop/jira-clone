import { defineHook } from "eve/hooks";
import type { HookContext } from "eve/hooks";
import { getToken } from "@vercel/connect";
import { log } from "evlog";
import { changeRecord } from "../../../../shared/cockpit";
import { updateCockpit } from "../../../lib/cockpit-store";
import { githubConnectorName } from "../../../lib/factory-config.ts";
import { createIncompleteReviewFeedback } from "../../../lib/review-feedback";
import { stationOf, stationRequest } from "../../../lib/station-access";
import { workState } from "../../../lib/work-state";

function bounded(value: unknown, limit = 500) {
  return (value instanceof Error ? value.message : String(value || "unknown reviewer failure")).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

async function recordUnavailable(ctx: HookContext, request: { prNumber: number }, state: ReturnType<typeof workState.get>, reason: unknown) {
  const knownPull = state.pull?.number === request.prNumber ? state.pull : undefined;
  await updateCockpit(doc => {
    const previous = doc.runs[ctx.session.id];
    return changeRecord(doc, "runs", ctx.session.id, {
      ...(previous?.value || {}),
      station: "reviewer",
      rootAgent: "reviewer",
      label: typeof previous?.value.label === "string" ? previous.value.label : `Review PR #${request.prNumber}`,
      reviewUnavailable: {
        station: "reviewer",
        sessionId: ctx.session.id,
        prNumber: request.prNumber,
        ...(knownPull?.headSha ? { headSha: knownPull.headSha } : {}),
        ...(knownPull?.baseSha ? { baseSha: knownPull.baseSha } : {}),
        ...(knownPull?.targetBranch ? { targetBranch: knownPull.targetBranch } : {}),
        summary: "The reviewer ended before it could publish trusted visual feedback to the PR.",
        limitations: [bounded(reason), "No visual packet or GitHub review was published for this attempt. Start a fresh review after the provider recovers."].slice(0, 20),
        capturedAt: new Date().toISOString(),
      },
    }, previous?.version || 0);
  });
}

async function publishFallback(ctx: HookContext) {
  if (stationOf(ctx) !== "reviewer") return;
  const state = workState.get();
  if (state.recorded) return;

  let request: { prNumber: number } | undefined;
  try {
    const requested = stationRequest(ctx);
    if (!("prNumber" in requested)) return;
    request = { prNumber: requested.prNumber };
    const prNumber = requested.prNumber;
    const knownPull = state.pull?.number === prNumber ? state.pull : undefined;
    if (state.prepareFailure && !knownPull) {
      await recordUnavailable(ctx, { prNumber }, state, state.prepareFailure.message);
      return;
    }
    const feedback = await createIncompleteReviewFeedback({
      token: await getToken(githubConnectorName, { subject: { type: "app" } }),
      prNumber,
      reviewerSessionId: ctx.session.id,
      headSha: knownPull?.headSha,
      baseSha: knownPull?.baseSha,
      targetBranch: knownPull?.targetBranch,
      files: knownPull?.files,
      reason: "Reviewer session ended before a trusted record_review result was observed.",
    });
    await updateCockpit(doc => {
      const previous = doc.runs[ctx.session.id];
      return changeRecord(doc, "runs", ctx.session.id, {
        ...(previous?.value || {}),
        station: "reviewer",
        rootAgent: "reviewer",
        label: typeof previous?.value.label === "string" ? previous.value.label : `Review PR #${prNumber}`,
        reviewFallback: feedback.review,
      }, previous?.version || 0);
    });
  } catch (error) {
    if (request) {
      try { await recordUnavailable(ctx, request, state, error); }
      catch (recordError) { log.warn({ factory: { station: "reviewer", stage: "incomplete_feedback", outcome: "unavailable", reason: bounded(recordError) } }); }
    } else {
      log.warn({ factory: { station: "reviewer", stage: "incomplete_feedback", outcome: "unavailable", reason: bounded(error) } });
    }
  }
}

export default defineHook({ events: {
  "session.completed": (_event, ctx) => publishFallback(ctx),
  "session.failed": (_event, ctx) => publishFallback(ctx),
  "turn.completed": (_event, ctx) => publishFallback(ctx),
  "turn.failed": (_event, ctx) => publishFallback(ctx),
  "turn.cancelled": (_event, ctx) => publishFallback(ctx),
} });
