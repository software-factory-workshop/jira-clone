import { appActorLabel, authorizeAppWrite } from "../../../../../utils/appAccounts";
import { DEMO_ROLE_MATRIX_LABEL } from "../../../../../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../../../../../utils/passportIdentity";
import { REST_BOUNDARY, restUpdateIssue } from "../../../../../utils/jiraRest";

/**
 * Demo-only Jira-style PUT /api/rest/api/3/issue/:key.
 *
 * Bounded field update over the same in-memory demo store: `fields.summary`,
 * `fields.priority`, `fields.assignee` and `fields.description` map onto the
 * demo model. `fields.status` is rejected here with a hint to use
 * POST /api/rest/api/3/issue/:key/transitions; any other unknown field,
 * unknown key, invalid value or the deterministic `{fail:true}` path fails
 * closed and writes nothing. Authority runs first through the shared
 * resolver/`authorizeAppWrite`, so viewer writes stay 403 (and malformed
 * Passport identities stay 401) without touching state; responses carry
 * `actor` and `identitySource`.
 */
export default defineEventHandler(async (event) => {
  const identity = {
    passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
    demoUser: getHeader(event, "x-demo-user"),
    devUser: process.env.PASSPORT_DEV_USER,
    nodeEnv: process.env.NODE_ENV,
  };
  const gate = authorizeAppWrite(identity, "update");
  if (!gate.ok) {
    throw createError({
      statusCode: gate.statusCode,
      message: gate.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        boundary: REST_BOUNDARY,
        ...("account" in gate && gate.account
          ? { actor: appActorLabel(gate.account) }
          : {}),
      },
    });
  }
  const key = getRouterParam(event, "key") ?? "";
  const body = await readBody<{
    fields?: unknown;
    fail?: unknown;
  }>(event);
  const result = restUpdateIssue(identity, key, {
    fields: body?.fields,
    fail: body?.fail,
  });
  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      message: result.error,
      data: {
        demoOnly: true,
        roleMatrix: DEMO_ROLE_MATRIX_LABEL,
        boundary: REST_BOUNDARY,
        actor: appActorLabel(gate.account),
        ...(result.statusCode === 409 && result.allowedFrom
          ? { allowedFrom: [...result.allowedFrom] }
          : {}),
      },
    });
  }
  return {
    ...result.data,
    demoOnly: true,
    roleMatrix: DEMO_ROLE_MATRIX_LABEL,
    boundary: REST_BOUNDARY,
  };
});
