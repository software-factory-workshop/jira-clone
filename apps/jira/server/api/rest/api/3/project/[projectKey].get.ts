import { DEMO_ROLE_MATRIX_LABEL } from "../../../../../utils/demoAccounts";
import { REST_BOUNDARY, restProject } from "../../../../../utils/jiraRest";

/**
 * Demo-only Jira-style GET /api/rest/api/3/project/:key.
 * Serves only the observed reference project KAN; anything else is a
 * labelled 404. Never writes.
 */
export default defineEventHandler((event) => {
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
