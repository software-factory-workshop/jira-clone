import { appActorLabel, authorizeAppWrite } from "../../../utils/appAccounts";
import { DEMO_ROLE_MATRIX_LABEL } from "../../../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../../../utils/passportIdentity";
import { addComment } from "../../../utils/issues";

/**
 * Demo-only per-issue comment creation through the shared
 * request-to-application-account resolver. Unknown keys return 404 before
 * writing; blank bodies are rejected with a client error; the deterministic
 * `{fail:true}` path returns a 500 and writes nothing. Viewer writes return
 * a structured demoOnly 403 without mutation; malformed Passport identities
 * fail closed with 401.
 */
export default defineEventHandler(async (event) => {
  const actor = authorizeAppWrite(
    {
      passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
      demoUser: getHeader(event, "x-demo-user"),
      devUser: process.env.PASSPORT_DEV_USER,
      nodeEnv: process.env.NODE_ENV,
    },
    "comment",
  );
  if (!actor.ok) {
    throw createError({
      statusCode: actor.statusCode,
      message: actor.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        ...(actor.account ? { actor: appActorLabel(actor.account) } : {}),
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
    actor: appActorLabel(actor.account),
  };
});
