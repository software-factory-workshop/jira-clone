import { appActorLabel, authorizeAppWrite } from "../../../../../utils/appAccounts";
import { DEMO_ROLE_MATRIX_LABEL } from "../../../../../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../../../../../utils/passportIdentity";
import { REST_BOUNDARY, restDeleteIssue, restBearerIdentity, authorizeBearerWrite } from "../../../../../utils/jiraRest";
import { getIssuePersistenceInfo } from "../../../../../utils/issuePersistence";

/**
 * Demo-only Jira-style DELETE /api/rest/api/3/issue/:key.
 *
 * Deletes one demo issue (and its comments) over the configured persistence
 * boundary. Authority runs first through the shared resolver /
 * `authorizeAppWrite` (viewers stay 403, malformed Passport identities 401)
 * or, when an `Authorization: Bearer` demo OAuth token is present, the
 * bearer write gate, never falling through to the demo fallback. Unknown
 * keys are 404 and write nothing.
 */
export default defineEventHandler(async (event) => {
  const identity = {
    passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
    demoUser: getHeader(event, "x-demo-user"),
    devUser: process.env.PASSPORT_DEV_USER,
    nodeEnv: process.env.NODE_ENV,
  };
  const bearer = restBearerIdentity(getHeader(event, "authorization"));
  const gate = bearer ? authorizeBearerWrite(bearer) : authorizeAppWrite(identity, "delete");
  if (!gate.ok) {
    throw createError({
      statusCode: gate.statusCode,
      message: gate.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        boundary: REST_BOUNDARY,
        persistence: getIssuePersistenceInfo(),
        ...("account" in gate && gate.account ? { actor: appActorLabel(gate.account) } : {}),
      },
    });
  }
  const key = getRouterParam(event, "key") ?? "";
  const fail = getQuery(event)["fail"] === "true";
  const result = await restDeleteIssue(identity, key, { fail }, { bearer });
  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      message: result.error,
      data: { demoOnly: true, roleMatrix: DEMO_ROLE_MATRIX_LABEL, boundary: REST_BOUNDARY, persistence: getIssuePersistenceInfo() },
    });
  }
  return { ...result.data, demoOnly: true, roleMatrix: DEMO_ROLE_MATRIX_LABEL, boundary: REST_BOUNDARY, persistence: getIssuePersistenceInfo() };
});
