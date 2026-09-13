import { DEMO_ROLE_MATRIX_LABEL } from "../../../../../../utils/demoAccounts";
import { REST_BOUNDARY, restProjectStatuses } from "../../../../../../utils/jiraRest";

/**
 * Demo-only Jira-style GET /api/rest/api/3/project/:key/statuses.
 * Observed statuses per observed issue type for project KAN: the observed
 * status list, not a verified transition graph. Never writes.
 */
export default defineEventHandler((event) => {
  const projectKey = getRouterParam(event, "projectKey") ?? "";
  const result = restProjectStatuses(projectKey);
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
