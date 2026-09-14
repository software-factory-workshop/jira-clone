import { z } from "zod";
import { mcpWriteIdentity, restDeleteIssue } from "../../utils/jiraRest.ts";

/**
 * Demo-only write MCP tool: delete one demo issue and its comments.
 *
 * Wraps `DELETE /api/rest/api/3/issue/:key` 1:1 through the same
 * `restDeleteIssue` helper and `authorizeAppWrite` authority as the HTTP
 * route. Unknown keys are 404 and write nothing. Accepts the explicit
 * labelled `demoUser` fallback because the raw Passport header only exists
 * on the HTTP request boundary; this tool runs without Passport auth.
 */
export default defineMcpTool({
  name: "deleteIssue",
  description:
    "Demo-only write: delete one demo issue and its comments (DELETE /api/rest/api/3/issue/:key). Unknown keys are 404. Seeds return with the demo reset.",
  inputSchema: {
    issueKey: z.string().describe('Demo issue key, e.g. "ADEO-5".'),
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
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ issueKey, demoUser, fail }) => {
    const result = await restDeleteIssue(mcpWriteIdentity(demoUser), issueKey, { fail });
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
