import { defineEventHandler, readBody, setResponseHeader } from "h3";
import {
  COCKPIT_API_VERSION,
  invalidRequest,
  requireJsonBody,
  saveDraft,
  saveDraftBodySchema,
} from "../../utils/cockpit-api.ts";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "private, no-store");
  requireJsonBody(event);

  const body: unknown = await readBody(event);
  const parsed = saveDraftBodySchema.safeParse(body);
  if (!parsed.success) invalidRequest(parsed.error);

  return {
    apiVersion: COCKPIT_API_VERSION,
    data: saveDraft(parsed.data),
    meta: { storage: "caller-owned" },
  };
});
