import { z } from "zod";
import { restTransitions } from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: allowed transition targets for one issue.
 *
 * Wraps `GET /api/rest/api/3/issue/:key/transitions` 1:1, derived from the
 * same `DEMO_TRANSITIONS` matrix that guards the PATCH save path. Unknown
 * keys stay 404. Never writes and never performs a transition.
 */
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
  handler: async ({ issueKey, jql }) => {
    const query: Record<string, unknown> = {};
    if (jql !== undefined) query["jql"] = jql;
    const result = restTransitions(issueKey, query);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
