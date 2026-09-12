// DEMO-ONLY reset path: restores the seeded synthetic fixtures.
import { resetIssues } from "../utils/issue-store";

export default defineEventHandler(() => {
  return { issues: resetIssues() };
});
