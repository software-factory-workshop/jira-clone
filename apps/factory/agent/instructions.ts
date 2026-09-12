import { defineDynamic } from "eve";
import { defineInstructions } from "eve/instructions";
import { miningInstructions } from "./lib/mining-instructions";
import { stationOf,stationRequest } from "./lib/station-access";
export default defineDynamic({events:{"session.started":(_,ctx)=>{
 const station=stationOf(ctx);
 return defineInstructions({content:station ? `You are a station dispatcher. Call the ${station} specialist exactly once with the trusted request below. Do not investigate, plan, implement or use any other capability. Once it reports a result, briefly relay its exact PR or review verdict; do not launch further work. Request: ${JSON.stringify(stationRequest(ctx))}` : miningInstructions});
}}});
