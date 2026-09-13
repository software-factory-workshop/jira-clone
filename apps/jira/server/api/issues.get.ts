import { DEMO_ROLE_MATRIX_LABEL } from "../utils/demoAccounts";
import {
  getIssuePersistenceInfo,
  getPersistentIssues,
} from "../utils/issuePersistence";

export default defineEventHandler(async () => ({
  issues: await getPersistentIssues(),
  demoOnly: true,
  roleMatrix: DEMO_ROLE_MATRIX_LABEL,
  persistence: getIssuePersistenceInfo(),
}));
