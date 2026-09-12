import { addComment } from "../../../utils/issues";

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key") ?? "";
  const body = await readBody<{ body?: unknown; fail?: unknown }>(event);
  const result = addComment(key, body?.body, {
    fail: body?.fail === true,
  });
  if (!result.ok) {
    throw createError({ statusCode: result.statusCode, message: result.error });
  }
  return { comment: result.comment, demoOnly: true };
});
