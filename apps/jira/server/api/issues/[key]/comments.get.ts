import { listComments } from "../../../utils/issues";

export default defineEventHandler((event) => {
  const key = getRouterParam(event, "key") ?? "";
  const result = listComments(key);
  if (!result.ok) {
    throw createError({ statusCode: result.statusCode, message: result.error });
  }
  return {
    comments: result.comments,
    demoOnly: true,
    persistence:
      "Demo-only in-memory store. Comments survive reload against this server and reset on redeploy.",
  };
});
