import { DEMO_ROLE_MATRIX_LABEL } from "../../utils/demoAccounts";
import { getIssue } from "../../utils/issues";

export default defineEventHandler((event) => {
  const key = getRouterParam(event, "key") ?? "";
  const issue = getIssue(key);
  if (!issue) {
    throw createError({
      statusCode: 404,
      message: `Unknown issue key: ${key}.`,
    });
  }
  return { issue, demoOnly: true };
});
