import { OAUTH_BOUNDARY, oauthAuthorizationServerMetadata, resolveOAuthIssuer } from "../../../utils/jiraOAuth";

/** OpenID-style alias serving the same RFC 8414 fields (no ID tokens issued). */
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
