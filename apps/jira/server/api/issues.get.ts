// DEMO-ONLY read path: returns the in-memory teaching store, seeded from
// synthetic fixtures. State resets when the server restarts.
import { listIssues } from "../utils/issue-store";

export default defineEventHandler(() => {
  return {
    issues: listIssues(),
    persistence: "demo-only-in-memory",
  };
});
