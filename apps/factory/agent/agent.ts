import { defineAgent, defineDynamic } from "eve";
import { getVercelOidcToken } from "@vercel/oidc";
import { model, verifyGatewayScope } from "./lib/github.mjs";

export default defineAgent({
  model: defineDynamic({events:{"session.started":async()=>{verifyGatewayScope(await getVercelOidcToken(),process.env.AI_GATEWAY_API_KEY);return model;}}}),
  defaultTools: false,
  limits: {
    maxInputTokensPerSession: false,
    maxOutputTokensPerSession: false,
    maxTokenCostUsdPerSession: false,
  },
});
