// DEMO-ONLY save path: persists an issue priority change into the
// in-memory teaching store. Send { "failSave": true } to force a
// deterministic 500 for failure-state testing.
import { saveIssuePriority } from "../../utils/issue-store";

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key") ?? "";
  const body = await readBody<{ priority?: unknown; failSave?: unknown }>(
    event,
  );
  const result = saveIssuePriority(
    key,
    typeof body?.priority === "string" ? body.priority : "",
    { failSave: body?.failSave === true },
  );
  if (!result.ok) {
    throw createError({ statusCode: result.status, message: result.error });
  }
  return { issue: result.issue };
});
