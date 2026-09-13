import { DEMO_ROLE_MATRIX_LABEL } from "../../utils/demoAccounts";
import {
  getIssuePersistenceInfo,
  getPersistentIssue,
} from "../../utils/issuePersistence";

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key") ?? "";
  const issue = await getPersistentIssue(key);
  if (!issue) {
    throw createError({
      statusCode: 404,
      message: `Unknown issue key: ${key}.`,
    });
  }
  return { issue, demoOnly: true, persistence: getIssuePersistenceInfo() };
});
