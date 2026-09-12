import { getIssues } from "../utils/issues";

export default defineEventHandler(() => ({
  issues: getIssues(),
  demoOnly: true,
  persistence:
    "Demo-only in-memory store. Seeded status/priority edits and created demo issues survive reload against this server and reset on redeploy or reset.",
}));
