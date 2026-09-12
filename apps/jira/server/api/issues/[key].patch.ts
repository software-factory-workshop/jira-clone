import { updateIssueStatus } from "../../utils/issues";

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key") ?? "";
  const body = await readBody<{ status?: unknown; fail?: unknown }>(event);
  const result = updateIssueStatus(key, body?.status, {
    fail: body?.fail === true,
  });
  if (!result.ok) {
    throw createError({ statusCode: result.statusCode, message: result.error });
  }
  return { issue: result.issue, demoOnly: true };
});
