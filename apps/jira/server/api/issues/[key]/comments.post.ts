import { DEMO_ROLE_MATRIX_LABEL, actorLabel, authorizeDemoWrite } from "../../../utils/demoAccounts";
import { addComment } from "../../../utils/issues";

/**
 * Demo-only per-issue comment creation. Unknown keys return 404 before
 * writing; blank bodies are rejected with a client error; the deterministic
 * `{fail:true}` path returns a 500 and writes nothing. Demo Viewer writes
 * return a structured demoOnly 403 without mutation.
 */
export default defineEventHandler(async (event) => {
  const actor = authorizeDemoWrite(getHeader(event, "x-demo-user"), "comment");
  if (!actor.ok) {
    throw createError({
      statusCode: actor.statusCode,
      message: actor.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        ...(actor.account ? { actor: actorLabel(actor.account) } : {}),
      },
    });
  }
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
  return {
    comment: result.comment,
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    actor: actorLabel(actor.account),
  };
});
