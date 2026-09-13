import { OAUTH_BOUNDARY, oauthExchangeCode, oauthRefreshToken, oauthTokenClientById, resolveOAuthIssuer, type OAuthClientAuth } from "../../utils/jiraOAuth";

/**
 * Demo-only token endpoint: POST /api/oauth/token with
 * `application/x-www-form-urlencoded`
 * (`grant_type=authorization_code|refresh_token`). Authorization codes are
 * single-use, expire after 5 minutes and bind client, redirect URI, PKCE
 * verifier and the server-derived account; refresh tokens rotate
 * single-use and replay revokes the whole grant family. Success returns
 * `{access_token, token_type: Bearer, expires_in: 600, scope,
 * refresh_token}`. Client secrets arrive via basic auth or form fields;
 * failures are RFC 6749-shaped `{error, error_description}` JSON.
 */
function readClientAuth(authorizationHeader: string | undefined): OAuthClientAuth {
  const basicMatch = (authorizationHeader ?? "").match(/^Basic\s+(\S+)$/i);
  if (basicMatch) {
    try {
      const decoded = Buffer.from(basicMatch[1] as string, "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator >= 0) {
        return {
          clientId: decoded.slice(0, separator) || null,
          secret: decoded.slice(separator + 1) || null,
          method: "client_secret_basic",
        };
      }
    } catch {
      // Fall through to form-field auth below.
    }
  }
  return { clientId: null, secret: null, method: "client_secret_post" };
}

export default defineEventHandler(async (event) => {
  const issuer = resolveOAuthIssuer({
    envIssuer: process.env.JIRA_OAUTH_ISSUER,
    proto: getHeader(event, "x-forwarded-proto") ?? undefined,
    host: getHeader(event, "x-forwarded-host") ?? getHeader(event, "host"),
  });
  const contentType = getHeader(event, "content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
    throw createError({
      statusCode: 400,
      message: "invalid_request: the demo token endpoint only accepts application/x-www-form-urlencoded bodies. Nothing was issued.",
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
  const form = await readBody<Record<string, unknown>>(event).catch(() => undefined);
  const body: Record<string, unknown> =
    form && typeof form === "object" && !Array.isArray(form) ? form : {};
  const grantType = body["grant_type"];
  if (grantType !== "authorization_code" && grantType !== "refresh_token") {
    setHeader(event, "Content-Type", "application/json");
    setHeader(event, "Cache-Control", "no-store");
    throw createError({
      statusCode: 400,
      message: `unsupported_grant_type: this demo provider supports authorization_code and refresh_token. Nothing was issued.`,
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
  const formClientId = typeof body["client_id"] === "string" ? (body["client_id"] as string) : null;
  const formSecret = typeof body["client_secret"] === "string" ? (body["client_secret"] as string) : null;
  const headerAuth = readClientAuth(getHeader(event, "authorization"));
  const auth: OAuthClientAuth =
    headerAuth.clientId !== null
      ? headerAuth
      : { clientId: formClientId, secret: formSecret, method: formSecret ? "client_secret_post" : "none" };
  // Fail closed before touching grants: the client must exist and
  // authenticate (public clients present only their id).
  const lookup = oauthTokenClientById(auth.clientId);
  if (!lookup.ok) {
    setHeader(event, "Content-Type", "application/json");
    setHeader(event, "Cache-Control", "no-store");
    throw createError({
      statusCode: lookup.statusCode,
      message: `${lookup.error}: ${lookup.errorDescription}`,
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
  try {
    const result =
      grantType === "authorization_code"
        ? await oauthExchangeCode(
            { grant_type: grantType, code: body["code"], redirect_uri: body["redirect_uri"], code_verifier: body["code_verifier"], resource: body["resource"] },
            { ...auth, clientId: lookup.client.clientId },
            issuer,
          )
        : await oauthRefreshToken(
            { grant_type: grantType, refresh_token: body["refresh_token"], scope: body["scope"] },
            { ...auth, clientId: lookup.client.clientId },
          );
    if (!result.ok) {
      throw createError({
        statusCode: result.statusCode,
        message: `${result.error}: ${result.errorDescription}`,
        data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
      });
    }
    setHeader(event, "Content-Type", "application/json");
    setHeader(event, "Cache-Control", "no-store");
    return { ...result.token, demoOnly: true, boundary: OAUTH_BOUNDARY };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Demo-only OAuth token exchange is unavailable.",
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
});
