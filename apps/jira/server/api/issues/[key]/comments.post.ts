// DEMO-ONLY save path: appends a synthetic comment to the in-memory
// teaching store. Send { "failSave": true } to force a deterministic 500
// for failure-state testing; the draft must be retained by the caller.
import { addIssueComment } from "../../../utils/issue-store";

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key") ?? "";
  const body = await readBody<{ body?: unknown; failSave?: unknown }>(event);
  const result = addIssueComment(
    key,
    typeof body?.body === "string" ? body.body : "",
    { failSave: body?.failSave === true },
  );
  if (!result.ok) {
    throw createError({ statusCode: result.status, message: result.error });
  }
  return { comment: result.comment };
});
