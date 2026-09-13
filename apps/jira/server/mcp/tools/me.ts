import { z } from "zod";
import { restMyself } from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: current demo user.
 *
 * Wraps the `GET /api/rest/api/3/myself` contract 1:1. Reads stay open to
 * the demo viewer; unknown identities fail closed without writing. There is
 * no auth claim: the caller passes the same labelled demo identity the REST
 * adapter accepts (`demo-admin`, `demo-member`, `demo-viewer`, or the
 * explicit default when omitted).
 */
export default defineMcpTool({
  name: "me",
  description:
    "Demo-only read: resolve the current Jira demo user (GET /api/rest/api/3/myself). No writes, no auth claims.",
  inputSchema: {
    demoUser: z
      .string()
      .optional()
      .describe(
        "Demo identity header value (demo-admin, demo-member, demo-viewer). Omit for the explicit demo-member default.",
      ),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ demoUser }) => {
    const result = restMyself(demoUser);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
