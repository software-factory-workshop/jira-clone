import { getIssues } from "../utils/issues";

export default defineEventHandler(() => ({
  issues: getIssues(),
  demoOnly: true,
  persistence:
    "Demo-only in-memory store. Status moves survive reload against this server and reset on redeploy.",
}));
