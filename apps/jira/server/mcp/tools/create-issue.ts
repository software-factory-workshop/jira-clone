import { z } from "zod";
import { mcpWriteIdentity, restCreateIssue } from "../../utils/jiraRest.ts";

/**
 * Demo-only write MCP tool: bounded Jira-shaped issue creation.
 *
 * Wraps `POST /api/rest/api/3/issue` 1:1 through the same
 * `restCreateIssue` helper and `authorizeAppWrite` authority as the HTTP
 * route: `fields.summary` is required, `priority`/`assignee`/`description`/
 * `issuetype`/`status`/`project` are optional, anything else is rejected and
 * writes nothing. Accepts the explicit labelled `demoUser` fallback because
 * the raw Passport header only exists on the HTTP request boundary; this
 * tool runs without Passport auth.
 */
export default defineMcpTool({
  name: "createIssue",
  description:
    "Demo-only write: create one demo issue (POST /api/rest/api/3/issue). Requires fields.summary; writes to the in-memory demo store only.",
  inputSchema: {
    fields: z
      .record(z.string(), z.unknown())
      .describe(
        "Jira-shaped fields: required summary string; optional priority, assignee, description, issuetype, status, project. Other fields are rejected.",
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
  handler: async ({ fields, demoUser, fail }) => {
    const result = restCreateIssue(mcpWriteIdentity(demoUser), {
      fields,
      fail,
    });
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
