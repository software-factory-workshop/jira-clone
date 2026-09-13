import { z } from "zod";
import {
  REST_DEFAULT_MAX_RESULTS,
  REST_DEFAULT_START_AT,
  REST_MAX_MAX_RESULTS,
  mcpBearerAuthority,
  restComments,
} from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: comment list for one issue.
 *
 * Wraps `GET /api/rest/api/3/issue/:key/comment` 1:1 with the same bounded
 * `startAt`/`maxResults` pagination as the issue list. Unknown keys stay
 * 404; any `jql` input is a labelled 400. A present MCP `Authorization:
 * Bearer` demo OAuth token is enforced fail-closed (read scope required)
 * and never falls through to demo identity. Never writes.
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
  name: "listComments",
  description:
    "Demo-only read: list demo comments for one issue with bounded pagination. Unknown keys stay 404.",
  inputSchema: {
    issueKey: z.string().describe('Demo issue key, e.g. "ADEO-1".'),
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
  handler: async ({ issueKey, startAt, maxResults, jql }, extra) => {
    const authority = mcpBearerAuthority(requestHeadersOf(extra), "read");
    if (authority && !authority.ok) {
      throw createError({ statusCode: authority.statusCode, message: authority.error });
    }
    const query: Record<string, unknown> = {};
    if (startAt !== undefined) query["startAt"] = String(startAt);
    if (maxResults !== undefined) query["maxResults"] = String(maxResults);
    if (jql !== undefined) query["jql"] = jql;
    const result = restComments(issueKey, query);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
