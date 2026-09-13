import { DEMO_ROLE_MATRIX_LABEL } from "../../../../../../utils/demoAccounts";
import { REST_BOUNDARY, authorizeBearerRead, restBearerIdentity, restTransitions } from "../../../../../../utils/jiraRest";

/**
 * Demo-only Jira-style GET /api/rest/api/3/issue/:key/transitions.
 * Allowed targets derived from the same DEMO_TRANSITIONS matrix that guards
 * the PATCH save path, so the adapter and the save path agree. Unknown keys
 * stay 404. A present `Authorization: Bearer` demo OAuth token is
 * enforced fail-closed (reads require the `read` scope) and never falls
 * through to the demo read. Never writes.
 */
export default defineEventHandler((event) => {
  const bearer = restBearerIdentity(getHeader(event, "authorization"));
  if (bearer) {
    const readGate = authorizeBearerRead(bearer);
    if (!readGate.ok) {
      throw createError({
        statusCode: readGate.statusCode,
        message: readGate.error,
        data: {
          demoOnly: true,
          roleMatrix: DEMO_ROLE_MATRIX_LABEL,
          boundary: REST_BOUNDARY,
        },
      });
    }
  }
  const key = getRouterParam(event, "key") ?? "";
  const result = restTransitions(key, getQuery(event) as Record<string, unknown>);
  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      message: result.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        boundary: REST_BOUNDARY,
      },
    });
  }
  return result.data;
});
