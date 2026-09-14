import { defineOAuthHandler } from "../../../utils/oauthPersistence";
import { OAUTH_BOUNDARY, oauthClientManagementBody, oauthReadClient, resolveOAuthIssuer } from "../../../utils/jiraOAuth";

/**
 * Demo-only client management read: GET /api/oauth/register/:clientId
 * with `Authorization: Bearer <registration_access_token>`. Only the
 * registration credential is accepted; client secrets never work here.
 */
export default defineOAuthHandler((event) => {
  const issuer = resolveOAuthIssuer({
    envIssuer: process.env.JIRA_OAUTH_ISSUER,
    proto: getHeader(event, "x-forwarded-proto") ?? undefined,
    host: getHeader(event, "x-forwarded-host") ?? getHeader(event, "host"),
  });
  const clientId = getRouterParam(event, "clientId") ?? "";
  const authorization = getHeader(event, "authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
  const result = oauthReadClient(clientId, token);
  if (!result.ok) {
    throw createError({
      statusCode: result.statusCode,
      message: `${result.error}: ${result.errorDescription}`,
      data: { demoOnly: true, boundary: OAUTH_BOUNDARY },
    });
  }
  setHeader(event, "Content-Type", "application/json");
  setHeader(event, "Cache-Control", "no-store");
  return { ...oauthClientManagementBody(result.client, issuer), demoOnly: true };
});
