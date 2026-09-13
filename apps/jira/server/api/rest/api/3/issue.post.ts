import { appActorLabel, authorizeAppWrite } from "../../../../utils/appAccounts";
import { DEMO_ROLE_MATRIX_LABEL } from "../../../../utils/demoAccounts";
import { PASSPORT_TOKEN_HEADER } from "../../../../utils/passportIdentity";
import { REST_BOUNDARY, restCreateIssue } from "../../../../utils/jiraRest";

/**
 * Demo-only Jira-style POST /api/rest/api/3/issue.
 *
 * Bounded creation over the same in-memory demo store as POST /api/issues:
 * `fields.summary` is required, `priority`, `assignee`, `description`,
 * `issuetype` and the fixture-defaulted `status` are optional, anything else
 * is rejected with a labelled demoOnly 400 that writes nothing. Authority
 * runs first through the shared resolver/`authorizeAppWrite`, so viewer
 * writes stay 403 (and malformed Passport identities stay 401) without
 * touching state; responses carry `actor` and `identitySource`. The
 * deterministic `{fail:true}` path returns a 500 and writes nothing.
 */
export default defineEventHandler(async (event) => {
  const identity = {
    passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
    demoUser: getHeader(event, "x-demo-user"),
    devUser: process.env.PASSPORT_DEV_USER,
    nodeEnv: process.env.NODE_ENV,
  };
  const gate = authorizeAppWrite(identity, "create");
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
  const body = await readBody<{
    fields?: unknown;
    fail?: unknown;
  }>(event);
  const result = restCreateIssue(identity, {
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
