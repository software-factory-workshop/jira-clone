import { defineOAuthHandler } from "../../utils/oauthPersistence";
import { DEMO_ROLE_MATRIX_LABEL } from "../../utils/demoAccounts";
import { OAUTH_BOUNDARY, oauthApproveGrant } from "../../utils/jiraOAuth";

/**
 * Demo-only consent decision: POST /api/oauth/consent with
 * `{grant_ticket, approved}` JSON. Approval mints the one-time
 * authorization code (5 minutes, bound to client, redirect URI, PKCE
 * challenge and the server-derived account); denial destroys the ticket
 * and returns access_denied with no code. Replay of a decided ticket fails
 * closed.
 */
export default defineOAuthHandler(async (event) => {
  const body = await readBody<{ grant_ticket?: unknown; approved?: unknown }>(event).catch(
    () => undefined,
  );
  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      message: "invalid_request: expected a JSON object with grant_ticket and approved. Nothing was issued.",
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
  let result: ReturnType<typeof oauthApproveGrant>;
  try {
    result = oauthApproveGrant(body);
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Demo-only OAuth consent is unavailable.",
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      message: `${result.error}: ${result.errorDescription}`,
      data: { demoOnly: true, roleMatrix: DEMO_ROLE_MATRIX_LABEL, boundary: OAUTH_BOUNDARY },
    });
  }
  setHeader(event, "Content-Type", "application/json");
  setHeader(event, "Cache-Control", "no-store");
  return { ...result.approval, demoOnly: true, boundary: OAUTH_BOUNDARY };
});
