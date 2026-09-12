import { listComments } from "../../../utils/issues";

export default defineEventHandler((event) => {
  const key = getRouterParam(event, "key") ?? "";
  const comments = listComments(key);
  if (!comments) {
    throw createError({
      statusCode: 404,
      message: `Unknown issue key: ${key}.`,
    });
  }
  return { comments, demoOnly: true };
});
