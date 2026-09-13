import { DEMO_ROLE_MATRIX_LABEL, actorLabel, authorizeDemoWrite } from "../utils/demoAccounts";
import { createIssue } from "../utils/issues";

/**
 * Demo-only issue creation on the labelled in-memory store. Rejects blank
 * titles and unknown status/priority values before writing; the
 * deterministic `{fail:true}` path returns a 500 and writes nothing.
 * Actor-aware: the `x-demo-user` header resolves the synthetic demo actor
 * and Demo Viewer writes are denied with a structured demoOnly 403 before
 * any mutation.
 */
export default defineEventHandler(async (event) => {
  const actor = authorizeDemoWrite(getHeader(event, "x-demo-user"), "create");
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
    actor: actorLabel(actor.account),
  };
});
