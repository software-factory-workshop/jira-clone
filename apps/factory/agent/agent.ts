import { defineAgent, defineDynamic } from "eve";
import { getVercelOidcToken } from "@vercel/oidc";
import { model, verifyScope } from "./lib/github.mjs";

export default defineAgent({
  model: defineDynamic({events:{"session.started":async()=>{verifyScope(await getVercelOidcToken());return model;}}}),
  defaultTools: false,
  limits: {
    maxInputTokensPerSession: 100_000,
    maxOutputTokensPerSession: 8_000,
    maxTokenCostUsdPerSession: 0.2,
  },
});
