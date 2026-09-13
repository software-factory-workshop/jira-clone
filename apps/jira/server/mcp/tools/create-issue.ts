import { z } from "zod";
import { mcpBearerIdentity, mcpWriteIdentity, restCreateIssue } from "../../utils/jiraRest.ts";

/**
 * Demo-only write MCP tool: bounded Jira-shaped issue creation.
 *
 * Wraps `POST /api/rest/api/3/issue` 1:1 through the same
 * `restCreateIssue` helper and `authorizeAppWrite` authority as the HTTP
 * route: `fields.summary` is required, `priority`/`assignee`/`description`/
 * `issuetype`/`status`/`project` are optional, anything else is rejected and
 * writes nothing. Accepts the explicit labelled `demoUser` fallback because
 * the raw Passport header only exists on the HTTP request boundary; this
 * tool runs without Passport auth. When the MCP request carries an
 * `Authorization: Bearer` demo OAuth token, the server-derived bearer
 * account (write scope required) is authoritative and a failed bearer
 * never falls through to the demoUser fallback.
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
  name: "createIssue",
  description:
    "Demo-only write: create one demo issue (POST /api/rest/api/3/issue). Requires fields.summary; writes to the in-memory demo store only.",
  inputSchema: {
    fields: z
      .record(z.string(), z.unknown())
      .describe(
        "Jira-shaped fields: required summary string; optional priority, assignee, description, issuetype, status, project. Other fields are rejected.",
      ),
    demoUser: z
      .string()
      .optional()
      .describe(
        "Demo identity header value (demo-admin, demo-member, demo-viewer). Omit for the explicit demo-member default.",
      ),
    fail: z
      .boolean()
      .optional()
      .describe(
        "Deterministic test path: when true, the write fails closed with a 500 and changes nothing.",
      ),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ fields, demoUser, fail }, extra) => {
    // A present MCP `authorization` header is authoritative: the
    // server-derived bearer account (write scope required) wins and a
    // failed bearer never falls through to the demoUser fallback.
    const toolBearer = mcpBearerIdentity(requestHeadersOf(extra));
    const result = restCreateIssue(mcpWriteIdentity(demoUser), {
      fields,
      fail,
    }, toolBearer ? { bearer: toolBearer } : undefined);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
