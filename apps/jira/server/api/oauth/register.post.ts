import { defineOAuthHandler } from "../../utils/oauthPersistence";
import {
  OAUTH_BOUNDARY,
  OAUTH_ERRORS,
  oauthRegisterClient,
  resolveOAuthIssuer,
} from "../../utils/jiraOAuth";

/**
 * Demo-only dynamic client registration (RFC 7591-shaped):
 * POST /api/oauth/register with `{client_name, redirect_uris, scope?,
 * token_endpoint_auth_method?}` JSON.
 *
 * Each redirect URI is validated exactly (https, or http loopback for
 * local demo testing; fragments never allowed); the Connect callback
 * `https://connect.vercel.com/callback` registers like any other exact
 * https URI. Unknown scopes and unknown auth methods fail closed. Returns
 * the registration record plus, for confidential clients, a one-time
 * `client_secret` and a `registration_access_token` credential for the
 * management URI.
 */
export default defineOAuthHandler(async (event) => {
  const issuer = resolveOAuthIssuer({
    envIssuer: process.env.JIRA_OAUTH_ISSUER,
    proto: getHeader(event, "x-forwarded-proto") ?? undefined,
    host: getHeader(event, "x-forwarded-host") ?? getHeader(event, "host"),
  });
  const body = await readBody<{
    client_name?: unknown;
    redirect_uris?: unknown;
    scope?: unknown;
    token_endpoint_auth_method?: unknown;
  }>(event).catch(() => undefined);
  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      message: `${OAUTH_ERRORS.invalidRequest}: expected a JSON object with redirect_uris. Nothing was registered.`,
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
  let result: Awaited<ReturnType<typeof oauthRegisterClient>>;
  try {
    result = await oauthRegisterClient(body, issuer);
  } catch (error) {
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Demo-only OAuth registration is unavailable.",
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      message: `${result.error}: ${result.errorDescription}`,
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
  setHeader(event, "Content-Type", "application/json");
  setHeader(event, "Cache-Control", "no-store");
  setResponseStatus(event, 201);
  return { ...result.client, ...(result.clientSecret ? { client_secret: result.clientSecret } : {}), demoOnly: true, boundary: OAUTH_BOUNDARY };
});
