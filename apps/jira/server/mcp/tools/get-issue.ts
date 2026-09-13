import { z } from "zod";
import { restIssue } from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: one issue read.
 *
 * Wraps `GET /api/rest/api/3/issue/:key` 1:1 (key, fields.summary from the
 * demo title, issuetype, status, priority, assignee, description, project
 * ref). Unknown keys stay 404 and write nothing.
 */
export default defineMcpTool({
  name: "getIssue",
  description:
    "Demo-only read: fetch one demo issue by key (GET /api/rest/api/3/issue/:key). Unknown keys stay 404.",
  inputSchema: {
    issueKey: z.string().describe('Demo issue key, e.g. "ADEO-1".'),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ issueKey }) => {
    const result = restIssue(issueKey);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
