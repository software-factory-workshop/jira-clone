import { z } from "zod";
import { REST_PROJECT_KEY, restProject } from "../../utils/jiraRest.ts";

/**
 * Demo-only read-only MCP tool: observed reference project KAN.
 *
 * Wraps `GET /api/rest/api/3/project/KAN` 1:1. Only the observed reference
 * project is served; anything else is a labelled 404 that writes nothing.
 */
export default defineMcpTool({
  name: "getProject",
  description:
    "Demo-only read: fetch the observed reference project KAN (GET /api/rest/api/3/project/KAN). Other keys stay 404.",
  inputSchema: {
    projectKey: z
      .string()
      .optional()
      .describe('Demo project key. Only "KAN" is served; defaults to "KAN".'),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ projectKey }) => {
    const key = projectKey === undefined ? REST_PROJECT_KEY : projectKey;
    const result = restProject(key);
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
