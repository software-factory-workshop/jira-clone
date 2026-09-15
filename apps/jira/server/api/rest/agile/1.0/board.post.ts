import { PASSPORT_TOKEN_HEADER } from "../../../../utils/passportIdentity";
import { REST_BOUNDARY, restBearerIdentity, restCreateBoard } from "../../../../utils/jiraRest";

/** Demo-only Jira Agile-style POST /api/rest/agile/1.0/board. */
export default defineEventHandler(async (event) => {
  const identity = {
    passportToken: getHeader(event, PASSPORT_TOKEN_HEADER),
    demoUser: getHeader(event, "x-demo-user"),
    devUser: process.env.PASSPORT_DEV_USER,
    nodeEnv: process.env.NODE_ENV,
  };
  const bearer = restBearerIdentity(getHeader(event, "authorization"));
  const body = await readBody<Record<string, unknown>>(event);
  const result = await restCreateBoard(identity, body, { bearer });
  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      message: result.error,
      data: { demoOnly: true, boundary: REST_BOUNDARY },
    });
  }
  return result.data;
});
