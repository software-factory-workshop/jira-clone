import { defineAgent,defineDynamic } from "eve";
import { getVercelOidcToken } from "@vercel/oidc";
import { verifyGatewayScope } from "../../lib/github.mjs";
import { factoryModelIds, factoryModelLimits } from "../../lib/factory-config.ts";
import { requireStation } from "../../lib/station-access.ts";
export default defineAgent({
 description:"Run the authenticated worker station only. Other station/mining sessions are denied before the model runs.",
 defaultTools:false,
 build:{externalDependencies:["@cedar-policy/cedar-wasm"]},
 model:defineDynamic({events:{"session.started":async(_,ctx)=>{
  requireStation(ctx,"worker");
  verifyGatewayScope(await getVercelOidcToken(),process.env.AI_GATEWAY_API_KEY);
  return factoryModelIds.worker;
 }}}),
 limits:factoryModelLimits
});
