import { z } from "zod";
import {
  REST_DEFAULT_MAX_RESULTS,
  REST_DEFAULT_START_AT,
  REST_MAX_MAX_RESULTS,
  mcpBearerAuthority,
  restSearch,
} from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: bounded issue list (search-lite).
 *
 * Wraps `GET /api/rest/api/3/search` 1:1 with bounded `startAt`
 * (integer >= 0, default 0) and `maxResults` (integer 1..50, default 25).
 * There is no JQL engine in this slice: any `jql` input is rejected with a
 * labelled demoOnly 400, never silently ignored. When the MCP request
 * carries an `Authorization: Bearer` demo OAuth token it is enforced
 * fail-closed (read scope required) and never falls through to demo
 * identity. Never writes.
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
  name: "listIssues",
  description:
    "Demo-only read: list demo issues with bounded pagination (startAt/maxResults). JQL is unsupported in this slice.",
  inputSchema: {
    startAt: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(`Zero-based offset, default ${REST_DEFAULT_START_AT}.`),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(REST_MAX_MAX_RESULTS)
      .optional()
      .describe(
        `Page size 1..${REST_MAX_MAX_RESULTS}, default ${REST_DEFAULT_MAX_RESULTS}.`,
      ),
    jql: z
      .string()
      .optional()
      .describe(
        "Unsupported in this slice: when provided, the tool fails closed with a labelled demoOnly 400.",
      ),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ startAt, maxResults, jql }, extra) => {
    const authority = mcpBearerAuthority(requestHeadersOf(extra), "read");
    if (authority && !authority.ok) {
      throw createError({ statusCode: authority.statusCode, message: authority.error });
    }
    const query: Record<string, unknown> = {};
    if (startAt !== undefined) query["startAt"] = String(startAt);
    if (maxResults !== undefined) query["maxResults"] = String(maxResults);
    if (jql !== undefined) query["jql"] = jql;
    const result = restSearch(query);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
