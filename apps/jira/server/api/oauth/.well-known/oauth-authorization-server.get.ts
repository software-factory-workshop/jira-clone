import { OAUTH_BOUNDARY, oauthAuthorizationServerMetadata, resolveOAuthIssuer } from "../../../utils/jiraOAuth";

/**
 * Demo-only RFC 8414 authorization-server metadata at
 * `/api/oauth/.well-known/oauth-authorization-server` (plus an OpenID-style
 * alias at `.../openid-configuration` serving the same fields).
 *
 * Root `/.well-known/*` is owned by the fixed `@nuxtjs/mcp-toolkit`
 * not-configured stub and routing configuration is outside the worker
 * boundary, so a deployment that wants root discovery needs the external
 * proxy step documented in `docs/jira-oauth-provider.md`. Standard fields
 * only: redirect-URI support is behavioral (exact-match registration and
 * authorize/token checks) and `expires_in` is asserted on token responses.
 */
export default defineEventHandler((event) => {
  const issuer = resolveOAuthIssuer({
    envIssuer: process.env.JIRA_OAUTH_ISSUER,
    proto: getHeader(event, "x-forwarded-proto") ?? undefined,
    host: getHeader(event, "x-forwarded-host") ?? getHeader(event, "host"),
  });
  setHeader(event, "Content-Type", "application/json");
  setHeader(event, "Cache-Control", "no-store");
  return { ...oauthAuthorizationServerMetadata(issuer), demoOnly: true, boundary: OAUTH_BOUNDARY };
});
