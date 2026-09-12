import { defineAgent,defineDynamic } from "eve";
import { getVercelOidcToken } from "@vercel/oidc";
import { model,verifyGatewayScope } from "../../lib/github.mjs";
import { stationOf } from "../../lib/station-access";
export default defineDynamic({events:{"session.started":async(_,ctx)=>{
 if(stationOf(ctx)!=="reviewer") return null;
 verifyGatewayScope(await getVercelOidcToken(),process.env.AI_GATEWAY_API_KEY);
 return defineAgent({description:"Run the authenticated reviewer station and return its concrete result.",model,defaultTools:false,limits:{maxInputTokensPerSession:500000,maxOutputTokensPerSession:16000,maxTokenCostUsdPerSession:0.2}});
}}});
