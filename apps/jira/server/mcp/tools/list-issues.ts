import { z } from "zod";
import {
  REST_DEFAULT_MAX_RESULTS,
  REST_DEFAULT_START_AT,
  REST_MAX_MAX_RESULTS,
  restSearch,
} from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: bounded issue list (search-lite).
 *
 * Wraps `GET /api/rest/api/3/search` 1:1 with bounded `startAt`
 * (integer >= 0, default 0) and `maxResults` (integer 1..50, default 25).
 * There is no JQL engine in this slice: any `jql` input is rejected with a
 * labelled demoOnly 400, never silently ignored. Never writes.
 */
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
  handler: async ({ startAt, maxResults, jql }) => {
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
