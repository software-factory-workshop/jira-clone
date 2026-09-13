import { z } from "zod";
import { mcpBearerAuthority, restMyself, toRestUser } from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: current demo user.
 *
 * Wraps the `GET /api/rest/api/3/myself` contract 1:1 through the shared
 * request-to-application-account resolver. Reads stay open to read-only
 * accounts; unknown identities fail closed without writing. The caller
 * passes the same labelled demo identity the REST adapter accepts
 * (`demo-admin`, `demo-member`, `demo-viewer`, or the explicit default when
 * omitted). There is no auth claim and no raw Passport token is accepted
 * here: Passport identities arrive only via the platform-injected request
 * header on the HTTP route. When the MCP request carries an
 * `Authorization: Bearer` demo OAuth token, the server-derived bearer
 * account (read scope required) is authoritative and a failed bearer never
 * falls through to the demoUser fallback.
 */
/**
 * Live MCP request headers for this tool call. The toolkit passes the
 * request-scoped `extra` second argument (SDK `RequestHandlerExtra` with
 * `requestInfo.headers` built per HTTP request by the streamable-HTTP
 * transport); unknown shapes mean no bearer was sent. Pure; never writes.
 */
function requestHeadersOf(extra: unknown): unknown {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) {
    return null;
  }
  const requestInfo = (extra as Record<string, unknown>)["requestInfo"];
  if (!requestInfo || typeof requestInfo !== "object" || Array.isArray(requestInfo)) {
    return null;
  }
  const headers = (requestInfo as Record<string, unknown>)["headers"];
  return headers && typeof headers === "object" ? headers : null;
}

export default defineMcpTool({
  name: "me",
  description:
    "Demo-only read: resolve the current Jira demo user (GET /api/rest/api/3/myself). No writes, no auth claims.",
  inputSchema: {
    demoUser: z
      .string()
      .optional()
      .describe(
        "Demo identity header value (demo-admin, demo-member, demo-viewer). Omit for the explicit demo-member default.",
      ),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ demoUser }, extra) => {
    // A present MCP `authorization` request header is authoritative: the
    // server-derived bearer account (read scope required) wins and a
    // failed bearer never falls through to the demoUser fallback.
    const authority = mcpBearerAuthority(requestHeadersOf(extra), "read");
    if (authority) {
      if (!authority.ok) {
        throw createError({ statusCode: authority.statusCode, message: authority.error });
      }
      return toRestUser(authority.data);
    }
    const result = restMyself(demoUser);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
