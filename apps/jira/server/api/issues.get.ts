import { DEMO_ROLE_MATRIX_LABEL } from "../utils/demoAccounts";
import { getIssues } from "../utils/issues";

export default defineEventHandler(() => ({
  issues: getIssues(),
  demoOnly: true,
  roleMatrix: DEMO_ROLE_MATRIX_LABEL,
  persistence:
    "Demo-only in-memory store. Seeded status/priority edits and created demo issues survive reload against this server and reset on redeploy or reset.",
}));
