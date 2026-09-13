import { z } from "zod";
import { REST_PROJECT_KEY, mcpBearerAuthority, restProject } from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: observed reference project KAN.
 *
 * Wraps `GET /api/rest/api/3/project/KAN` 1:1. Only the observed reference
 * project is served; anything else is a labelled 404 that writes nothing.
 * A present MCP `Authorization: Bearer` demo OAuth token is enforced
 * fail-closed (read scope required) and never falls through to demo
 * identity.
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
  name: "getProject",
  description:
    "Demo-only read: fetch the observed reference project KAN (GET /api/rest/api/3/project/KAN). Other keys stay 404.",
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
    const result = restProject(key);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
