import { createIssue } from "../utils/issues";

/**
 * Demo-only issue creation on the labelled in-memory store. Rejects blank
 * titles and unknown status/priority values before writing; the
 * deterministic `{fail:true}` path returns a 500 and writes nothing.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    title?: unknown;
    type?: unknown;
    status?: unknown;
    priority?: unknown;
    assignee?: unknown;
    description?: unknown;
    fail?: unknown;
  }>(event);
  const result = createIssue(
    {
      title: body?.title,
      type: body?.type,
      status: body?.status,
      priority: body?.priority,
      assignee: body?.assignee,
      description: body?.description,
    },
    { fail: body?.fail === true },
  );
  if (!result.ok) {
    throw createError({ statusCode: result.statusCode, message: result.error });
  }
  return { issue: result.issue, demoOnly: true };
});
