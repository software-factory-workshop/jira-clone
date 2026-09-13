import { DEMO_ROLE_MATRIX_LABEL } from "../../../../../utils/demoAccounts";
import { REST_BOUNDARY, authorizeBearerRead, restBearerIdentity, restProject } from "../../../../../utils/jiraRest";

/**
 * Demo-only Jira-style GET /api/rest/api/3/project/:key.
 * Serves only the observed reference project KAN; anything else is a
 * labelled 404. A present `Authorization: Bearer` demo OAuth token is
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
  const projectKey = getRouterParam(event, "projectKey") ?? "";
  const result = restProject(projectKey);
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
