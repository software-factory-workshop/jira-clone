import { createHash } from "node:crypto";
import { defineChannel, POST } from "eve/channels";
import { routeAuth } from "eve/channels/auth";
import { factoryAuth } from "../lib/route-auth";
import { workerRequest, reviewerRequest } from "../lib/station-access";
export default defineChannel({routes:[
 POST("/factory/stations/:station",async(request,{from,params,resolveSession})=>{
  const auth=await routeAuth(request,factoryAuth);
  if(auth instanceof Response) return auth;
  const station=params.station;
  if(station!=="worker" && station!=="reviewer") return Response.json({error:"Unknown station"},{status:404});
  const parsed=(station==="worker"?workerRequest:reviewerRequest).safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return Response.json({error:"Invalid station request",issues:parsed.error.issues},{status:400});
  const address=createHash("sha256").update(JSON.stringify([auth.principalId,station,parsed.data.operationId])).digest("hex");
  const prior=await resolveSession(address);
  if(prior) return Response.json({sessionId:prior.id,station},{status:200});
  const session=await from(address).send(`Run the authenticated ${station} station once. The immutable request is supplied in your system context.`,{auth:{...auth,attributes:{...auth.attributes,factoryStation:station,factoryRequest:JSON.stringify(parsed.data)}}});
  return Response.json({sessionId:session.id,station},{status:202});
 })
]});
