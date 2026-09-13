import { DEMO_ROLE_MATRIX_LABEL } from "../../../../utils/demoAccounts";
import { REST_BOUNDARY, restMyself } from "../../../../utils/jiraRest";

/**
 * Demo-only Jira-style GET /api/rest/api/3/myself.
 * Resolves the `x-demo-user` identity to a Jira-shaped demo user. Reads stay
 * open to the demo viewer; no write gate. Never writes.
 */
export default defineEventHandler((event) => {
  const result = restMyself(getHeader(event, "x-demo-user"));
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
