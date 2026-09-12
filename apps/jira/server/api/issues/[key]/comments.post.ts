import { addComment } from "../../../utils/issues";

/**
 * Demo-only per-issue comment creation. Unknown keys return 404 before
 * writing; blank bodies are rejected with a client error; the deterministic
 * `{fail:true}` path returns a 500 and writes nothing.
 */
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key") ?? "";
  const body = await readBody<{
    body?: unknown;
    fail?: unknown;
  }>(event);
  const result = addComment(
    key,
    { body: body?.body },
    { fail: body?.fail === true },
  );
  if (!result.ok) {
    throw createError({ statusCode: result.statusCode, message: result.error });
  }
  return { comment: result.comment, demoOnly: true };
});
