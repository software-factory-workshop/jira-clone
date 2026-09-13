import { appActorLabel, authorizeAppWrite } from "../../utils/appAccounts";
import { DEMO_ROLE_MATRIX_LABEL } from "../../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../../utils/passportIdentity";
import {
  getIssuePersistenceInfo,
  resetPersistentIssues,
} from "../../utils/issuePersistence";

/**
 * Demo-only reset of the configured Jira persistence boundary through the shared
 * request-to-application-account resolver. Only admin accounts (Demo Admin
 * or a Passport-derived admin) may reset; other roles receive a structured
 * demoOnly 403 and nothing is cleared. Unknown/malformed identities fail
 * closed before any mutation.
 */
export default defineEventHandler(async (event) => {
  const actor = authorizeAppWrite(
    {
      passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
      demoUser: getHeader(event, "x-demo-user"),
      devUser: process.env.PASSPORT_DEV_USER,
      nodeEnv: process.env.NODE_ENV,
    },
    "reset",
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
  return {
    reset: true,
    issues: await resetPersistentIssues(),
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    persistence: getIssuePersistenceInfo(),
    actor: appActorLabel(actor.account),
  };
});
