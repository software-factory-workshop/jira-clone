import { DEMO_ROLE_MATRIX_LABEL } from "../../../../utils/demoAccounts";
import { REST_BOUNDARY, restSearch } from "../../../../utils/jiraRest";

/**
 * Demo-only Jira-style GET /api/rest/api/3/search (list-lite).
 * Full demo list slice with bounded startAt/maxResults (defaults 0/25,
 * maxResults hard-bound 50). There is no JQL engine: any jql/JQL parameter
 * is a labelled demoOnly 400, never silently ignored. Never writes.
 */
export default defineEventHandler((event) => {
  const result = restSearch(getQuery(event) as Record<string, unknown>);
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
