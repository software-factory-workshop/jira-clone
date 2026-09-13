import { appActorLabel, authorizeAppWrite } from "../../utils/appAccounts";
import { DEMO_ROLE_MATRIX_LABEL } from "../../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../../utils/passportIdentity";
import {
  getIssuePersistenceInfo,
  updatePersistentIssue,
} from "../../utils/issuePersistence";

/**
 * Demo-only PATCH save path for one issue. Authorization runs first through
 * the shared request-to-application-account resolver, so viewer writes stay
 * 403 (and malformed Passport identities stay 401) without touching state. Status moves are then
 * guarded by the explicit demo-only `DEMO_TRANSITIONS` matrix: illegal
 * moves return a structured demoOnly 409 with `actor` and `allowedFrom`
 * and write nothing. Unknown keys stay 404, unknown statuses stay 400.
 * This guard is a teaching default, not verified Jira workflow parity or
 * production authorization.
 */
export default defineEventHandler(async (event) => {
  const actor = authorizeAppWrite(
    {
      passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
      demoUser: getHeader(event, "x-demo-user"),
      devUser: process.env.PASSPORT_DEV_USER,
      nodeEnv: process.env.NODE_ENV,
    },
    "update",
  );
  if (!actor.ok) {
    throw createError({
      statusCode: actor.statusCode,
      message: actor.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        ...(actor.account ? { actor: appActorLabel(actor.account) } : {}),
      },
    });
  }
  const key = getRouterParam(event, "key") ?? "";
  const body = await readBody<{
    status?: unknown;
    priority?: unknown;
    fail?: unknown;
  }>(event);
  const result = await updatePersistentIssue(
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
        actor: appActorLabel(actor.account),
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
    persistence: getIssuePersistenceInfo(),
    actor: appActorLabel(actor.account),
  };
});
