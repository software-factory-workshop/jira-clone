import { defineHook } from 'eve/hooks';
import { log } from 'evlog';
import { updateCockpit } from '../lib/cockpit-store';
import { changeRecord } from '../../shared/cockpit';
import { stationOf,stationRequest } from '../lib/station-access';
export default defineHook({events:{async 'session.started'(_,ctx){
 const station=stationOf(ctx)||'mining';const request=stationOf(ctx)?stationRequest(ctx):undefined;
 try {await updateCockpit(doc=>doc.runs[ctx.session.id]??changeRecord(doc,'runs',ctx.session.id,{station,rootAgent:station==='mining'?'task-miner':station,label:request&&'title'in request?request.title:station==='mining'?'Repository investigation':'PR review',...(request&&'operationId'in request?{operationId:request.operationId}:{})},0));}catch{log.warn({factory:{stage:'cockpit_history',outcome:'unavailable',reason:'storage_write_failed'}});}
}}});
