import { defineDynamic } from "eve";
import { stationOf } from "../lib/station-access";
import { defineTool } from "eve/tools";
import { miningState } from "../lib/mining-state";
import { workOrderAdmissionSchema } from "../../shared/cockpit.ts";

const tool = defineTool({
 description:"Record the host admission decision for the single best next task. Choose work_order only when the bounded scope, evidence and verification are sufficient; otherwise record clarification or unsupported. Call once before record_findings.",
 inputSchema:workOrderAdmissionSchema,
 async execute(input){
  const state=miningState.get();
  if(state.recorded) throw new Error("Findings were already recorded; start a new investigation for another run.");
  if(state.admission) throw new Error("The work-order admission was already recorded; start a new investigation for another decision.");
  miningState.update(s=>({...s,admission:input}));
  return input;
 },
 toModelOutput(output){return {type:"text",value:`${output.kind}: the host admission decision was recorded. Call record_findings next with the evidence-backed proposals and reflection.`};},
});

export default defineDynamic({events:{"session.started":(_,ctx)=>stationOf(ctx) ? null : tool}});
