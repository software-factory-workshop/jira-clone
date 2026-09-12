import { defineAgent,defineDynamic } from "eve";
import { getVercelOidcToken } from "@vercel/oidc";
import { model,verifyGatewayScope } from "../../lib/github.mjs";
import { requireStation } from "../../lib/station-access.ts";
export default defineAgent({
 description:"Run the authenticated worker station only. Other station/mining sessions are denied before the child model runs.",
 defaultTools:false,
 model:defineDynamic({events:{"session.started":async(_,ctx)=>{
  requireStation(ctx,"worker");
  verifyGatewayScope(await getVercelOidcToken(),process.env.AI_GATEWAY_API_KEY);
  return model;
 }}}),
 limits:{maxInputTokensPerSession:500000,maxOutputTokensPerSession:16000,maxTokenCostUsdPerSession:0.2}
});
