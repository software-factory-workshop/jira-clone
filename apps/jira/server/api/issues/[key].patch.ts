import { DEMO_ROLE_MATRIX_LABEL, actorLabel, authorizeDemoWrite } from "../../utils/demoAccounts";
import { updateIssue } from "../../utils/issues";

/**
 * Demo-only PATCH save path for one issue. Authorization runs first, so
 * viewer writes stay 403 without touching state. Status moves are then
 * guarded by the explicit demo-only `DEMO_TRANSITIONS` matrix: illegal
 * moves return a structured demoOnly 409 with `actor` and `allowedFrom`
 * and write nothing. Unknown keys stay 404, unknown statuses stay 400.
 * This guard is a teaching default, not verified Jira workflow parity or
 * production authorization.
 */
export default defineEventHandler(async (event) => {
  const actor = authorizeDemoWrite(getHeader(event, "x-demo-user"), "update");
  if (!actor.ok) {
    throw createError({
      statusCode: actor.statusCode,
      message: actor.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        ...(actor.account ? { actor: actorLabel(actor.account) } : {}),
      },
    });
  }
  const key = getRouterParam(event, "key") ?? "";
  const body = await readBody<{
    status?: unknown;
    priority?: unknown;
    fail?: unknown;
  }>(event);
  const result = updateIssue(
    key,
    { status: body?.status, priority: body?.priority },
    { fail: body?.fail === true },
  );
  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      message: result.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        actor: actorLabel(actor.account),
        ...(result.statusCode === 409 && result.allowedFrom
          ? { allowedFrom: [...result.allowedFrom] }
          : {}),
      },
    });
  }
  return {
    issue: result.issue,
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    actor: actorLabel(actor.account),
  };
});
