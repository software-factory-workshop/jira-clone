import {
  DEFAULT_DEMO_USER_ID,
  DEMO_ACCOUNTS,
  DEMO_ROLE_MATRIX_LABEL,
} from "../utils/demoAccounts";
import {
  PASSPORT_ROLE_MAPPING_LABEL,
  appActorLabel,
  resolveAppActor,
} from "../utils/appAccounts";
import {
  PASSPORT_DEPLOYMENT_NOTE,
  PASSPORT_TOKEN_HEADER,
} from "../utils/passportIdentity";

/**
 * Identity read for the account display. Uses the shared
 * request-to-application-account resolver: a present Passport identity
 * (platform-injected `x-vercel-oidc-passport-token` header) derives a
 * stable `passport:<external_sub>` account through the explicit
 * claims/groups role mapping; otherwise the labelled synthetic
 * `x-demo-user` fallback applies so the workshop still runs. The response
 * distinguishes `identitySource` passport versus demoFallback and never
 * returns the raw token.
 */
export default defineEventHandler((event) => {
  const resolved = resolveAppActor({
    passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
    demoUser: getHeader(event, "x-demo-user"),
    devUser: process.env.PASSPORT_DEV_USER,
    nodeEnv: process.env.NODE_ENV,
  });
  if (!resolved.ok) {
    throw createError({
      statusCode: resolved.statusCode,
      message: resolved.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        identitySource: resolved.identitySource ?? null,
      },
    });
  }
  const { account } = resolved;
  return {
    account: {
      ...account,
      actor: appActorLabel(account),
    },
    accounts: DEMO_ACCOUNTS,
    defaultUserId: DEFAULT_DEMO_USER_ID,
    explicit: account.explicit,
    identitySource: account.identitySource,
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    passportRoleMapping: PASSPORT_ROLE_MAPPING_LABEL,
    deploymentNote: PASSPORT_DEPLOYMENT_NOTE,
  };
});
