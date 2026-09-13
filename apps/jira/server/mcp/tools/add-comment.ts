import { z } from "zod";
import { mcpWriteIdentity, restAddComment } from "../../utils/jiraRest.ts";

/**
 * Demo-only write MCP tool: Jira-shaped comment creation.
 *
 * Wraps `POST /api/rest/api/3/issue/:key/comment` 1:1 through the same
 * `restAddComment` helper and `authorizeAppWrite` authority as the HTTP
 * route: a nonblank `body` string is required; unknown keys, blank bodies
 * and the deterministic `fail` path write nothing. Accepts the explicit
 * labelled `demoUser` fallback because the raw Passport header only exists
 * on the HTTP request boundary; this tool runs without Passport auth.
 */
export default defineMcpTool({
  name: "addComment",
  description:
    "Demo-only write: add one demo comment to an issue (POST /api/rest/api/3/issue/:key/comment). Requires a nonblank body.",
  inputSchema: {
    issueKey: z.string().describe('Demo issue key, e.g. "ADEO-1".'),
    body: z.string().describe("Nonblank demo comment text."),
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
  handler: async ({ issueKey, body, demoUser, fail }) => {
    const result = await restAddComment(mcpWriteIdentity(demoUser), issueKey, {
      body,
      fail,
    });
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
