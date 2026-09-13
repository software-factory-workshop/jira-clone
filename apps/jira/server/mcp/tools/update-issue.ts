import { z } from "zod";
import { mcpWriteIdentity, restUpdateIssue } from "../../utils/jiraRest.ts";

/**
 * Demo-only write MCP tool: bounded Jira-shaped field update.
 *
 * Wraps `PUT /api/rest/api/3/issue/:key` 1:1 through the same
 * `restUpdateIssue` helper and `authorizeAppWrite` authority as the HTTP
 * route: `fields.summary`/`priority`/`assignee`/`description` map onto the
 * demo model. `fields.status` is rejected here with a hint to use the
 * transitionIssue tool; any other unknown field, unknown key or invalid
 * value writes nothing. Accepts the explicit labelled `demoUser` fallback
 * because the raw Passport header only exists on the HTTP request boundary;
 * this tool runs without Passport auth.
 */
export default defineMcpTool({
  name: "updateIssue",
  description:
    "Demo-only write: update summary/priority/assignee/description on one demo issue (PUT /api/rest/api/3/issue/:key). Status moves use transitionIssue.",
  inputSchema: {
    issueKey: z.string().describe('Demo issue key, e.g. "ADEO-1".'),
    fields: z
      .record(z.string(), z.unknown())
      .describe(
        "Jira-shaped fields: summary, priority, assignee, description. Other fields (including status) are rejected.",
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
  handler: async ({ issueKey, fields, demoUser, fail }) => {
    const result = restUpdateIssue(mcpWriteIdentity(demoUser), issueKey, {
      fields,
      fail,
    });
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
