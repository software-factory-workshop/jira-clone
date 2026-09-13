import { z } from "zod";
import { mcpBearerAuthority, restIssue } from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: one issue read.
 *
 * Wraps `GET /api/rest/api/3/issue/:key` 1:1 (key, fields.summary from the
 * demo title, issuetype, status, priority, assignee, description, project
 * ref). Unknown keys stay 404 and write nothing. A present MCP
 * `Authorization: Bearer` demo OAuth token is enforced fail-closed (read
 * scope required) and never falls through to demo identity.
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
  name: "getIssue",
  description:
    "Demo-only read: fetch one demo issue by key (GET /api/rest/api/3/issue/:key). Unknown keys stay 404.",
  inputSchema: {
    issueKey: z.string().describe('Demo issue key, e.g. "ADEO-1".'),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ issueKey }, extra) => {
    const authority = mcpBearerAuthority(requestHeadersOf(extra), "read");
    if (authority && !authority.ok) {
      throw createError({ statusCode: authority.statusCode, message: authority.error });
    }
    const result = restIssue(issueKey);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
