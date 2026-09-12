import { resetIssues } from "../../utils/issues";

export default defineEventHandler(() => ({
  reset: true,
  issues: resetIssues(),
  demoOnly: true,
}));
