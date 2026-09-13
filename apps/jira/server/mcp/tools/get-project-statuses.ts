import { z } from "zod";
import { REST_PROJECT_KEY, mcpBearerAuthority, restProjectStatuses } from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: observed statuses per observed issue type.
 *
 * Wraps `GET /api/rest/api/3/project/KAN/statuses` 1:1. This is the observed
 * status list, not a transition graph; allowed moves come from the
 * getAllowedTransitions tool. Other project keys stay 404. A present MCP
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
  name: "getProjectStatuses",
  description:
    "Demo-only read: list observed statuses per observed issue type for project KAN. Not a transition graph.",
  inputSchema: {
    projectKey: z
      .string()
      .optional()
      .describe('Demo project key. Only "KAN" is served; defaults to "KAN".'),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ projectKey }, extra) => {
    const authority = mcpBearerAuthority(requestHeadersOf(extra), "read");
    if (authority && !authority.ok) {
      throw createError({ statusCode: authority.statusCode, message: authority.error });
    }
    const key = projectKey === undefined ? REST_PROJECT_KEY : projectKey;
    const result = restProjectStatuses(key);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
