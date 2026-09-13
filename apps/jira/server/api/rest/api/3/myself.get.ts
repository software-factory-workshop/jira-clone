import { DEMO_ROLE_MATRIX_LABEL } from "../../../../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../../../../utils/passportIdentity";
import {
  REST_BOUNDARY,
  authorizeBearerRead,
  restBearerIdentity,
  restMyself,
  restPermissions,
  toRestUser,
} from "../../../../utils/jiraRest";
import { resolveAppActor } from "../../../../utils/appAccounts";

/**
 * Demo-only Jira-style GET /api/rest/api/3/myself.
 * Resolves the request through the shared request-to-application-account
 * resolver to a Jira-shaped user plus a read permission summary. A present
 * Passport identity maps through the explicit claims/groups role mapping
 * (default viewer); otherwise the labelled synthetic `x-demo-user` fallback
 * applies. Reads stay open to read-only accounts. A present
 * `Authorization: Bearer` demo OAuth token is enforced instead (reads
 * require the `read` scope) and never falls through to the demo fallback;
 * requests without the header keep the labelled local demo behavior. Never
 * writes and never exposes the raw token.
 */
export default defineEventHandler((event) => {
  const identity = {
    passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
    demoUser: getHeader(event, "x-demo-user"),
    devUser: process.env.PASSPORT_DEV_USER,
    nodeEnv: process.env.NODE_ENV,
  };
  const bearer = restBearerIdentity(getHeader(event, "authorization"));
  if (bearer) {
    const readGate = authorizeBearerRead(bearer);
    if (!readGate.ok) {
      throw createError({
        statusCode: readGate.statusCode,
        message: readGate.error,
        data: {
          demoOnly: true,
          roleMatrix: DEMO_ROLE_MATRIX_LABEL,
          boundary: REST_BOUNDARY,
        },
      });
    }
    return {
      ...toRestUser(readGate.data),
      permissions: restPermissions(readGate.data),
    };
  }
  const result = restMyself(identity.demoUser, identity);
  if (!result.ok) {
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
  const resolved = resolveAppActor(identity);
  const account = resolved.ok ? resolved.account : undefined;
  return {
    ...result.data,
    permissions: account ? restPermissions(account) : undefined,
  };
});