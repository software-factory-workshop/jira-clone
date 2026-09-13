import { z } from "zod";
import {
  REST_DEFAULT_MAX_RESULTS,
  REST_DEFAULT_START_AT,
  REST_MAX_MAX_RESULTS,
  restComments,
} from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: comment list for one issue.
 *
 * Wraps `GET /api/rest/api/3/issue/:key/comment` 1:1 with the same bounded
 * `startAt`/`maxResults` pagination as the issue list. Unknown keys stay
 * 404; any `jql` input is a labelled 400. Never writes.
 */
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
  handler: async ({ issueKey, startAt, maxResults, jql }) => {
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
