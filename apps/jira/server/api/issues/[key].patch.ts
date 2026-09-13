import { DEMO_ROLE_MATRIX_LABEL, actorLabel, authorizeDemoWrite } from "../../utils/demoAccounts";
import { updateIssue } from "../../utils/issues";

export default defineEventHandler(async (event) => {
  const actor = authorizeDemoWrite(getHeader(event, "x-demo-user"), "update");
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
  return {
    issue: result.issue,
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    actor: actorLabel(actor.account),
  };
});
