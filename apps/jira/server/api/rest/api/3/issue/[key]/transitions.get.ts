import { DEMO_ROLE_MATRIX_LABEL } from "../../../../../../utils/demoAccounts";
import { REST_BOUNDARY, restTransitions } from "../../../../../../utils/jiraRest";

/**
 * Demo-only Jira-style GET /api/rest/api/3/issue/:key/transitions.
 * Allowed targets derived from the same DEMO_TRANSITIONS matrix that guards
 * the PATCH save path, so the adapter and the save path agree. Unknown keys
 * stay 404. Never writes.
 */
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key") ?? "";
  const result = await restTransitions(key, getQuery(event) as Record<string, unknown>);
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
