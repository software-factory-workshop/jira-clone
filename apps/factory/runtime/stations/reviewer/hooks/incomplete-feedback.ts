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

async function publishFallback(ctx: HookContext) {
  if (stationOf(ctx) !== "reviewer") return;
  const state = workState.get();
  if (state.recorded) return;

  try {
    const request = stationRequest(ctx);
    if (!("prNumber" in request)) return;
    const knownPull = state.pull?.number === request.prNumber ? state.pull : undefined;
    const feedback = await createIncompleteReviewFeedback({
      token: await getToken(githubConnectorName, { subject: { type: "app" } }),
      prNumber: request.prNumber,
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
        label: typeof previous?.value.label === "string" ? previous.value.label : `Review PR #${request.prNumber}`,
        reviewFallback: feedback.review,
      }, previous?.version || 0);
    });
  } catch (error) {
    log.warn({ factory: { station: "reviewer", stage: "incomplete_feedback", outcome: "unavailable", reason: error instanceof Error ? error.message : "publication failed" } });
  }
}

export default defineHook({ events: {
  "session.completed": (_event, ctx) => publishFallback(ctx),
  "session.failed": (_event, ctx) => publishFallback(ctx),
  "turn.failed": (_event, ctx) => publishFallback(ctx),
  "turn.cancelled": (_event, ctx) => publishFallback(ctx),
} });
