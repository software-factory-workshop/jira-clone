import { REST_BOUNDARY, restBoards } from "../../../../utils/jiraRest";

/** Demo-only Jira Agile-style GET /api/rest/agile/1.0/board. */
export default defineEventHandler(async () => {
  const result = await restBoards();
  if (!result.ok) {
    throw createError({ statusCode: result.statusCode, message: result.error });
  }
  return { ...result.data, boundary: REST_BOUNDARY };
});
