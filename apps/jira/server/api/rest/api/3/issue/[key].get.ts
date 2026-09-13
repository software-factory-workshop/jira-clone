import { DEMO_ROLE_MATRIX_LABEL } from "../../../../../utils/demoAccounts";
import { REST_BOUNDARY, restIssue } from "../../../../../utils/jiraRest";

/**
 * Demo-only Jira-style GET /api/rest/api/3/issue/:key.
 * Single-issue read with the Jira-like envelope (title -> summary). Unknown
 * keys return a labelled 404. Never writes.
 */
export default defineEventHandler((event) => {
  const key = getRouterParam(event, "key") ?? "";
  const result = restIssue(key);
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
