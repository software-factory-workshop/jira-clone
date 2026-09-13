import { DEMO_ROLE_MATRIX_LABEL } from "../../../utils/demoAccounts";
import {
  getIssuePersistenceInfo,
  listPersistentComments,
} from "../../../utils/issuePersistence";

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key") ?? "";
  const comments = await listPersistentComments(key);
  if (!comments) {
    throw createError({
      statusCode: 404,
      message: `Unknown issue key: ${key}.`,
    });
  }
  return { comments, demoOnly: true, persistence: getIssuePersistenceInfo() };
});
