import { DEMO_ROLE_MATRIX_LABEL } from "../../../utils/demoAccounts";
import { OAUTH_BOUNDARY, oauthBrowserDecision } from "../../../utils/jiraOAuth";

/**
 * Demo-only browser consent decision: POST /api/oauth/consent/decision with
 * `application/x-www-form-urlencoded` `{grant_ticket, decision}` from the
 * labelled consent page served by GET /api/oauth/authorize.
 *
 * `decision` is exactly `approve` or `deny`: approval mints the one-time
 * 5-minute code bound to client, redirect URI, PKCE challenge and the
 * server-derived account, then redirects (302) exactly to the registered
 * redirect_uri with `code` and `state`; denial redirects with
 * `error=access_denied` and `state`. The grant ticket is consumed exactly
 * once: unknown, replayed, expired and malformed decisions fail closed with
 * a machine-readable error and no redirect. The body never accepts a
 * caller-supplied user id: the code always binds the account snapshotted
 * at grant time.
 */
export default defineEventHandler(async (event) => {
  const form = await readBody<Record<string, unknown>>(event).catch(() => undefined);
  const body: Record<string, unknown> =
    form && typeof form === "object" && !Array.isArray(form) ? form : {};
  let result: ReturnType<typeof oauthBrowserDecision>;
  try {
    result = oauthBrowserDecision(body);
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
  setHeader(event, "Cache-Control", "no-store");
  return sendRedirect(event, result.redirectTo, 302);
});
