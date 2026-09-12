import { updateIssue } from "../../utils/issues";

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key") ?? "";
  const body = await readBody<{
    status?: unknown;
    priority?: unknown;
    fail?: unknown;
  }>(event);
  const result = updateIssue(
    key,
    { status: body?.status, priority: body?.priority },
    { fail: body?.fail === true },
  );
  if (!result.ok) {
    throw createError({ statusCode: result.statusCode, message: result.error });
  }
  return { issue: result.issue, demoOnly: true };
});
