import { defineOAuthHandler } from "../../utils/oauthPersistence";
import { OAUTH_BOUNDARY, oauthRevokeToken } from "../../utils/jiraOAuth";

/**
 * Demo-only RFC 7009 revocation: POST /api/oauth/revoke with
 * `application/x-www-form-urlencoded` `{token, token_type_hint?}`.
 * A known token revokes its whole grant family; unknown tokens still
 * return success (per spec, so callers cannot probe the store).
 */
export default defineOAuthHandler(async (event) => {
  const contentType = getHeader(event, "content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
    throw createError({
      statusCode: 400,
      message: "invalid_request: the demo revocation endpoint only accepts application/x-www-form-urlencoded bodies. Nothing was revoked.",
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
  const form = await readBody<Record<string, unknown>>(event).catch(() => undefined);
  const body: Record<string, unknown> =
    form && typeof form === "object" && !Array.isArray(form) ? form : {};
  oauthRevokeToken({ token: body["token"], token_type_hint: body["token_type_hint"] });
  setHeader(event, "Content-Type", "application/json");
  setHeader(event, "Cache-Control", "no-store");
  return { ok: true, demoOnly: true, boundary: OAUTH_BOUNDARY };
});
