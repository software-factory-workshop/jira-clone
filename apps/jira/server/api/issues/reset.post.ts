import { DEMO_ROLE_MATRIX_LABEL, actorLabel, authorizeDemoWrite } from "../../utils/demoAccounts";
import { resetIssues } from "../../utils/issues";

/**
 * Demo-only reset of the labelled in-memory store. Only Demo Admin may
 * reset; Demo Member and Demo Viewer receive a structured demoOnly 403 and
 * nothing is cleared. Unknown or malformed `x-demo-user` values are
 * rejected before any mutation.
 */
export default defineEventHandler((event) => {
  const actor = authorizeDemoWrite(getHeader(event, "x-demo-user"), "reset");
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
  return {
    reset: true,
    issues: resetIssues(),
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    actor: actorLabel(actor.account),
  };
});
