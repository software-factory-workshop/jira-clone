import { z } from "zod";
import { mcpWriteIdentity, restCreateBoard } from "../../utils/jiraRest.ts";

/**
 * Demo-only write MCP tool for a board in the sole KAN project. The tool
 * runs without Passport auth and uses the same labelled demo identity gate
 * as the other bounded MCP writes.
 */
export default defineMcpTool({
  name: "createBoard",
  description:
    "Demo-only write: create a kanban or scrum board for project KAN (POST /api/rest/agile/1.0/board).",
  inputSchema: {
    name: z.string().trim().min(1).max(100).describe("Board name (1..100 characters)."),
    type: z.enum(["kanban", "scrum"]).describe("Jira board type."),
    projectKey: z.literal("KAN").optional().describe('Demo project key; only "KAN" is supported.'),
    demoUser: z
      .string()
      .optional()
      .describe("Demo identity (demo-admin, demo-member, demo-viewer). Omit for demo-member."),
    fail: z.boolean().optional().describe("Deterministic failure path; writes nothing."),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ name, type, projectKey, demoUser, fail }) => {
    const result = await restCreateBoard(mcpWriteIdentity(demoUser), {
      name,
      type,
      projectKey,
      fail,
    });
    if (!result.ok) {
      throw createError({ statusCode: result.statusCode, message: result.error });
    }
    return result.data;
  },
});
