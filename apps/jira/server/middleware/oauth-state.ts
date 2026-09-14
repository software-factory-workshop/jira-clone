import { defineEventHandler } from "h3";
import { hydrateOAuthStore } from "../utils/oauthPersistence";

/**
 * Bearer-validating surfaces (Jira-shaped REST, MCP) only read the OAuth
 * store, so they need the latest durable copy and nothing more. The OAuth
 * routes hydrate and persist through `defineOAuthHandler`.
 */
export default defineEventHandler(async (event) => {
  const path = event.path.split("?")[0] ?? "";
  if (path.startsWith("/api/rest/") || path === "/mcp" || path.startsWith("/mcp/")) {
    await hydrateOAuthStore();
  }
});
