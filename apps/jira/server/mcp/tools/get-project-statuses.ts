import { z } from "zod";
import { REST_PROJECT_KEY, restProjectStatuses } from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: observed statuses per observed issue type.
 *
 * Wraps `GET /api/rest/api/3/project/KAN/statuses` 1:1. This is the observed
 * status list, not a transition graph; allowed moves come from the
 * getAllowedTransitions tool. Other project keys stay 404.
 */
export default defineMcpTool({
  name: "getProjectStatuses",
  description:
    "Demo-only read: list observed statuses per observed issue type for project KAN. Not a transition graph.",
  inputSchema: {
    projectKey: z
      .string()
      .optional()
      .describe('Demo project key. Only "KAN" is served; defaults to "KAN".'),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ projectKey }) => {
    const key = projectKey === undefined ? REST_PROJECT_KEY : projectKey;
    const result = restProjectStatuses(key);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
