import {
  DEFAULT_DEMO_USER_ID,
  DEMO_ACCOUNTS,
  DEMO_ROLE_MATRIX_LABEL,
  resolveDemoActor,
} from "../utils/demoAccounts";

/**
 * Demo-only identity read for the account switcher. Resolves the selected
 * `x-demo-user` id (or the explicit default) to its labelled synthetic
 * account. No real session or token is created; reads stay available even
 * for unknown identities so the UI can show demo reads.
 */
export default defineEventHandler((event) => {
  const header = getHeader(event, "x-demo-user");
  const resolved = resolveDemoActor(header);
  if (!resolved.ok) {
    throw createError({
      statusCode: resolved.statusCode,
      message: resolved.error,
      data: { demoOnly: true, roleMatrix: DEMO_ROLE_MATRIX_LABEL },
    });
  }
  return {
    account: resolved.account,
    accounts: DEMO_ACCOUNTS,
    defaultUserId: DEFAULT_DEMO_USER_ID,
    explicit: resolved.explicit,
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
  };
});
