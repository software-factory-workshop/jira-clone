import { z } from "zod";
import { mcpBearerAuthority, restTransitions } from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: allowed transition targets for one issue.
 *
 * Wraps `GET /api/rest/api/3/issue/:key/transitions` 1:1, derived from the
 * same `DEMO_TRANSITIONS` matrix that guards the PATCH save path. Unknown
 * keys stay 404. A present MCP `Authorization: Bearer` demo OAuth token
 * is enforced fail-closed (read scope required) and never falls through
 * to demo identity. Never writes and never performs a transition.
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
  name: "getAllowedTransitions",
  description:
    "Demo-only read: list allowed demo status transitions for one issue. Read-only; performs no transition.",
  inputSchema: {
    issueKey: z.string().describe('Demo issue key, e.g. "ADEO-1".'),
    jql: z
      .string()
      .optional()
      .describe(
        "Unsupported in this slice: when provided, the tool fails closed with a labelled demoOnly 400.",
      ),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ issueKey, jql }, extra) => {
    const authority = mcpBearerAuthority(requestHeadersOf(extra), "read");
    if (authority && !authority.ok) {
      throw createError({ statusCode: authority.statusCode, message: authority.error });
    }
    const query: Record<string, unknown> = {};
    if (jql !== undefined) query["jql"] = jql;
    const result = restTransitions(issueKey, query);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
