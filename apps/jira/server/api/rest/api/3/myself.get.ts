import { DEMO_ROLE_MATRIX_LABEL } from "../../../../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../../../../utils/passportIdentity";
import { REST_BOUNDARY, restBearerIdentity, restMyself, restPermissions } from "../../../../utils/jiraRest";
import { resolveAppActor } from "../../../../utils/appAccounts";

/**
 * Demo-only Jira-style GET /api/rest/api/3/myself.
 * Resolves the request through the shared request-to-application-account
 * resolver to a Jira-shaped user plus a read permission summary. A present
 * Passport identity maps through the explicit claims/groups role mapping
 * (default viewer); otherwise the labelled synthetic `x-demo-user` fallback
 * applies. Reads stay open to read-only accounts; no write gate. When an
 * `Authorization: Bearer` demo OAuth token is present it is validated
 * instead and never falls through to the demo fallback (401 on unknown,
 * revoked or expired tokens) so bearer holders such as the MCP gateway can
 * check a token here. Never writes and never exposes the raw token.
 */
export default defineEventHandler((event) => {
  const identity = {
    passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
    demoUser: getHeader(event, "x-demo-user"),
    devUser: process.env.PASSPORT_DEV_USER,
    nodeEnv: process.env.NODE_ENV,
  };
  const bearer = restBearerIdentity(getHeader(event, "authorization"));
  const result = restMyself(identity.demoUser, identity, { bearer });
  if (!result.ok) {
    if (bearer) {
      setHeader(event, "WWW-Authenticate", 'Bearer realm="jira-clone-demo"');
    }
    throw createError({
      statusCode: result.statusCode,
      message: result.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        boundary: REST_BOUNDARY,
      },
    });
  }
  const account = bearer?.ok
    ? bearer.account
    : (() => {
        const resolved = resolveAppActor(identity);
        return resolved.ok ? resolved.account : undefined;
      })();
  return {
    ...result.data,
    permissions: account ? restPermissions(account) : undefined,
  };
});