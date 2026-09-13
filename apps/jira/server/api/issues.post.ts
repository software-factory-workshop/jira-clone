import { appActorLabel, authorizeAppWrite } from "../utils/appAccounts";
import { DEMO_ROLE_MATRIX_LABEL } from "../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../utils/passportIdentity";
import { createIssue } from "../utils/issues";

/**
 * Demo-only issue creation on the labelled in-memory store. Rejects blank
 * titles and unknown status/priority values before writing; the
 * deterministic `{fail:true}` path returns a 500 and writes nothing.
 * Actor-aware through the shared request-to-application-account resolver:
 * a present Passport identity derives a stable passport account through the
 * explicit claims/groups role mapping, otherwise the labelled synthetic
 * `x-demo-user` fallback applies. Viewer writes are denied with a structured
 * demoOnly 403 before any mutation; malformed or unrecognised Passport
 * identities fail closed with 401. Responses carry identitySource.
 */
export default defineEventHandler(async (event) => {
  const actor = authorizeAppWrite(
    {
      passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
      demoUser: getHeader(event, "x-demo-user"),
      devUser: process.env.PASSPORT_DEV_USER,
      nodeEnv: process.env.NODE_ENV,
    },
    "create",
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
  const body = await readBody<{
    title?: unknown;
    type?: unknown;
    status?: unknown;
    priority?: unknown;
    assignee?: unknown;
    description?: unknown;
    fail?: unknown;
  }>(event);
  const result = createIssue(
    {
      title: body?.title,
      type: body?.type,
      status: body?.status,
      priority: body?.priority,
      assignee: body?.assignee,
      description: body?.description,
    },
    { fail: body?.fail === true },
  );
  if (!result.ok) {
    throw createError({ statusCode: result.statusCode, message: result.error });
  }
  return {
    issue: result.issue,
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    actor: appActorLabel(actor.account),
  };
});
