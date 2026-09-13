import { z } from "zod";
import { restMyself } from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: current demo user.
 *
 * Wraps the `GET /api/rest/api/3/myself` contract 1:1 through the shared
 * request-to-application-account resolver. Reads stay open to read-only
 * accounts; unknown identities fail closed without writing. The caller
 * passes the same labelled demo identity the REST adapter accepts
 * (`demo-admin`, `demo-member`, `demo-viewer`, or the explicit default when
 * omitted). There is no auth claim and no raw Passport token is accepted
 * here: Passport identities arrive only via the platform-injected request
 * header on the HTTP route.
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
