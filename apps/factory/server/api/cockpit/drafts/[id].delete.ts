import { defineEventHandler, getRouterParam, readBody, setResponseHeader } from "h3";
import {
  COCKPIT_API_VERSION,
  invalidDraftId,
  invalidRequest,
  isValidDraftId,
  removeDraft,
  requireJsonBody,
  restoreDraftsBodySchema,
} from "../../../utils/cockpit-api.ts";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "private, no-store");
  requireJsonBody(event);

  const id = getRouterParam(event, "id");
  if (!isValidDraftId(id)) invalidDraftId();

  const body: unknown = await readBody(event);
  const parsed = restoreDraftsBodySchema.safeParse(body);
  if (!parsed.success) invalidRequest(parsed.error);

  return {
    apiVersion: COCKPIT_API_VERSION,
    data: removeDraft(id, parsed.data.drafts),
    meta: { storage: "caller-owned" },
  };
});
