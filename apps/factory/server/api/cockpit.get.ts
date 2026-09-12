import { defineEventHandler, setResponseHeader } from "h3";
import { buildManifest } from "../utils/cockpit-api.ts";

export default defineEventHandler((event) => {
  setResponseHeader(event, "Cache-Control", "private, no-store");
  return buildManifest();
});
