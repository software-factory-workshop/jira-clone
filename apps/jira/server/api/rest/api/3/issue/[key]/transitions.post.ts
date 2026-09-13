import { appActorLabel, authorizeAppWrite } from "../../../../../../utils/appAccounts";
import { DEMO_ROLE_MATRIX_LABEL } from "../../../../../../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../../../../../../utils/passportIdentity";
import { REST_BOUNDARY, restTransitionIssue, restBearerIdentity, authorizeBearerWrite } from "../../../../../../utils/jiraRest";

/**
 * Demo-only Jira-style POST /api/rest/api/3/issue/:key/transitions.
 *
 * Performs one status move along the existing demo-only `DEMO_TRANSITIONS`
 * matrix using the deterministic demo transition ids from
 * GET /api/rest/api/3/issue/:key/transitions (`transition.id`, also accepted
 * as a bare string or `{name}`/`{to.name}`). Unknown keys, unknown
 * transition ids, off-matrix moves (409 with `allowedFrom`) and the
 * deterministic `{fail:true}` path all fail closed and write nothing.
 * Authority runs first through the shared resolver/`authorizeAppWrite`, so
 * viewer writes stay 403 (and malformed Passport identities stay 401)
 * without touching state; responses carry `actor` and `identitySource`.
 * This is the same matrix that guards PATCH /api/issues/:key.
 */
export default defineEventHandler(async (event) => {
  const identity = {
    passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
    demoUser: getHeader(event, "x-demo-user"),
    devUser: process.env.PASSPORT_DEV_USER,
    nodeEnv: process.env.NODE_ENV,
  };
  // A present `Authorization: Bearer` demo OAuth token is enforced instead
  // of the Passport/demo gate (writes additionally require the `write`
  // scope) and never falls through to the demo fallback.
  const bearer = restBearerIdentity(getHeader(event, "authorization"));
  const gate = bearer ? authorizeBearerWrite(bearer) : authorizeAppWrite(identity, "update");
  if (!gate.ok) {
    throw createError({
      statusCode: gate.statusCode,
      message: gate.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        boundary: REST_BOUNDARY,
        ...("account" in gate && gate.account
          ? { actor: appActorLabel(gate.account) }
          : {}),
      },
    });
  }
  const key = getRouterParam(event, "key") ?? "";
  const body = await readBody<{
    transition?: unknown;
    fail?: unknown;
  }>(event);
  const result = restTransitionIssue(
    identity,
    key,
    {
      transition: body?.transition,
      fail: body?.fail,
    },
    { bearer },
  );
  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      message: result.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        boundary: REST_BOUNDARY,
        actor: appActorLabel("data" in gate ? gate.data : gate.account),
        ...(result.statusCode === 409 && result.allowedFrom
          ? { allowedFrom: [...result.allowedFrom] }
          : {}),
      },
    });
  }
  return {
    ...result.data,
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    boundary: REST_BOUNDARY,
  };
});
