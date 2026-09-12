import { z } from 'zod';
import { parseMiningOutput } from '../../app/utils/mining-output';
import { parseStationToolResult } from '../../app/utils/work-station';
const eventSchema=z.object({type:z.string(),meta:z.object({deliveryId:z.string().optional()}).passthrough().optional(),data:z.unknown()});
const resultSchema=z.object({status:z.literal('completed'),result:z.object({kind:z.literal('tool-result'),toolName:z.string(),isError:z.boolean().optional(),output:z.unknown()})});
export function projectRunEvent(value:unknown,operationId?:string) {
 const event=eventSchema.safeParse(value);if(!event.success||event.data.type!=='action.result')return undefined;
 const parsed=resultSchema.safeParse(event.data.data);if(!parsed.success||parsed.data.result.isError)return undefined;
 const result=parsed.data.result;
 if(result.toolName==='record_findings'){const output=parseMiningOutput(result.output);return output?{kind:'mining' as const,output}:undefined;}
 const output=parseStationToolResult(result.toolName,result.output,operationId);
 return output?{kind:'work' as const,output}:undefined;
}
export async function readRun(session:{getStreamTailIndex():Promise<number>;getEventStream(options:{startIndex:number}):Promise<ReadableStream<unknown>>},filter:{operationId?:string;deliveryId?:string}={}) {
 const tail=await session.getStreamTailIndex();if(tail>30000)throw new Error('Run exceeds the bounded result window; use its Eve stream.');
 const reader=(await session.getEventStream({startIndex:0})).getReader();let result:ReturnType<typeof projectRunEvent>;let terminal:string|undefined;let timedOut=false;let read=0;
 const timeout=setTimeout(()=>{timedOut=true;void reader.cancel();},15000);
 try {for(let index=0;index<=tail;index++){const item=await reader.read();if(item.done)break;read++;const event=eventSchema.safeParse(item.value);if(!event.success)continue;
  if(filter.deliveryId&&event.data.meta?.deliveryId!==filter.deliveryId)continue;
  if(event.data.type==='turn.started'){terminal=undefined;result=undefined;}
  result=projectRunEvent(item.value,filter.operationId)||result;
  if(['turn.completed','turn.cancelled','turn.failed','session.failed'].includes(event.data.type))terminal=event.data.type;
 }} finally {clearTimeout(timeout);await reader.cancel();}
 return {result,terminal,streamIndex:tail,complete:!timedOut&&read>tail};
}
