import { z } from "zod";
import { mcpBearerIdentity, mcpWriteIdentity, restTransitionIssue } from "../../utils/jiraRest.ts";

/**
 * Demo-only write MCP tool: perform one demo status transition.
 *
 * Wraps `POST /api/rest/api/3/issue/:key/transitions` 1:1 through the same
 * `restTransitionIssue` helper and `authorizeAppWrite` authority as the HTTP
 * route, along the existing `DEMO_TRANSITIONS` matrix with the deterministic
 * demo transition ids. Unknown keys, unknown transition ids and off-matrix
 * moves write nothing. Accepts the explicit labelled `demoUser` fallback
 * because the raw Passport header only exists on the HTTP request boundary;
 * this tool runs without Passport auth. When the MCP request carries an
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
  name: "transitionIssue",
  description:
    "Demo-only write: move one demo issue along the demo transition matrix (POST /api/rest/api/3/issue/:key/transitions). Uses demo transition ids.",
  inputSchema: {
    issueKey: z.string().describe('Demo issue key, e.g. "ADEO-1".'),
    transitionId: z
      .string()
      .describe(
        'Demo transition id from getAllowedTransitions, e.g. "demo-in-progress".',
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
  handler: async ({ issueKey, transitionId, demoUser, fail }, extra) => {
    const toolBearer = mcpBearerIdentity(requestHeadersOf(extra));
    const result = restTransitionIssue(mcpWriteIdentity(demoUser), issueKey, {
      transition: transitionId,
      fail,
    }, toolBearer ? { bearer: toolBearer } : undefined);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
