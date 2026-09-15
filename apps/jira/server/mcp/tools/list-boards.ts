import { z } from "zod";
import { restBoards } from "../../utils/jiraRest.ts";

/** Demo-only read MCP tool for the bounded Jira board collection. */
export default defineMcpTool({
  name: "listBoards",
  description:
    "Demo-only read: list boards available in the bounded KAN project (GET /api/rest/agile/1.0/board).",
  inputSchema: {
    projectKey: z.literal("KAN").optional().describe('Demo project key; only "KAN" is supported.'),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async () => {
    const result = await restBoards();
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
