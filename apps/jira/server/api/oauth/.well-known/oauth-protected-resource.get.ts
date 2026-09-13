import { OAUTH_BOUNDARY, oauthProtectedResourceMetadata, resolveOAuthIssuer } from "../../../utils/jiraOAuth";

/**
 * Demo-only RFC 9728 protected-resource metadata for the demo API resource
 * (`{origin}/api`, served by the REST adapter). The toolkit-owned `/mcp`
 * endpoint is intentionally absent: it is currently unauthenticated demo
 * tooling, not bearer-protected by this provider.
 */
export default defineEventHandler((event) => {
  const issuer = resolveOAuthIssuer({
    envIssuer: process.env.JIRA_OAUTH_ISSUER,
    proto: getHeader(event, "x-forwarded-proto") ?? undefined,
    host: getHeader(event, "x-forwarded-host") ?? getHeader(event, "host"),
  });
  setHeader(event, "Content-Type", "application/json");
  setHeader(event, "Cache-Control", "no-store");
  return { ...oauthProtectedResourceMetadata(issuer), demoOnly: true, boundary: OAUTH_BOUNDARY };
});
