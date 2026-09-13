import { z } from "zod";
import { mcpWriteIdentity, restTransitionIssue } from "../../utils/jiraRest.ts";

/**
 * Demo-only write MCP tool: perform one demo status transition.
 *
 * Wraps `POST /api/rest/api/3/issue/:key/transitions` 1:1 through the same
 * `restTransitionIssue` helper and `authorizeAppWrite` authority as the HTTP
 * route, along the existing `DEMO_TRANSITIONS` matrix with the deterministic
 * demo transition ids. Unknown keys, unknown transition ids and off-matrix
 * moves write nothing. Accepts the explicit labelled `demoUser` fallback
 * because the raw Passport header only exists on the HTTP request boundary;
 * this tool runs without Passport auth.
 */
export default defineMcpTool({
  name: "transitionIssue",
  description:
    "Demo-only write: move one demo issue along the demo transition matrix (POST /api/rest/api/3/issue/:key/transitions). Uses demo transition ids.",
  inputSchema: {
    issueKey: z.string().describe('Demo issue key, e.g. "ADEO-1".'),
    transitionId: z
      .string()
      .describe(
        'Demo transition id from getAllowedTransitions, e.g. "demo-in-progress".',
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
  handler: async ({ issueKey, transitionId, demoUser, fail }) => {
    const result = restTransitionIssue(mcpWriteIdentity(demoUser), issueKey, {
      transition: transitionId,
      fail,
    });
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
