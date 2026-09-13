import { DEMO_ROLE_MATRIX_LABEL } from "../../../../../../utils/demoAccounts";
import { REST_BOUNDARY, authorizeBearerRead, restBearerIdentity, restComments } from "../../../../../../utils/jiraRest";

/**
 * Demo-only Jira-style GET /api/rest/api/3/issue/:key/comment.
 * Comment list for one issue with bounded startAt/maxResults (defaults 0/25,
 * maxResults hard-bound 50). Unknown keys stay 404; jql/JQL is a labelled
 * 400. A present `Authorization: Bearer` demo OAuth token is enforced
 * fail-closed (reads require the `read` scope) and never falls through to
 * the demo read. Never writes.
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
  const result = restComments(key, getQuery(event) as Record<string, unknown>);
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
