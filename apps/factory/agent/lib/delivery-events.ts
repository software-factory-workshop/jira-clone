import type { Session } from 'eve/channels';
import { z } from 'zod';
export const resultEvent=z.object({type:z.literal('action.result'),data:z.object({status:z.literal('completed'),result:z.object({kind:z.literal('tool-result'),toolName:z.string(),isError:z.literal(false).optional(),output:z.unknown()})})});
export async function snapshotEvents(session:Session){
 const tail=await session.getStreamTailIndex();if(tail>30000)throw new Error('Session history exceeds delivery observation limit.');
 const reader=(await session.getEventStream({startIndex:0})).getReader();const events:unknown[]=[];let timedOut=false;const timer=setTimeout(()=>{timedOut=true;void reader.cancel();},10000);
 try{for(let n=0;n<=tail;n++){const item=await reader.read();if(item.done)throw new Error(timedOut?'Session observation timed out; no partial result accepted.':'Session observation ended before captured tail.');events.push(item.value);}}finally{clearTimeout(timer);await reader.cancel();}return events;
}
export function childIn(events:unknown[]){for(const e of [...events].reverse()){const p=z.object({type:z.literal('subagent.called'),data:z.object({childSessionId:z.string()})}).safeParse(e);if(p.success)return p.data.data.childSessionId;}}
export function hostResult(events:unknown[],tool:string,sessionId:string,operationId?:string){
 for(const event of [...events].reverse()) {const parsed=resultEvent.safeParse(event);if(!parsed.success)continue;const envelope=parsed.data.data.result;let value=envelope.output;if(envelope.toolName!==tool){if(tool!=='publish_work'||envelope.toolName!=='prepare_work')continue;const cached=z.object({phase:z.literal('Already published'),result:z.unknown()}).safeParse(value);if(!cached.success)continue;value=cached.data.result;}const output=z.object({sessionId:z.literal(sessionId),operationId:z.string().optional()}).passthrough().safeParse(value);if(output.success&&(!operationId||output.data.operationId===operationId))return output.data;}
}
export function stoppedWithoutResult(events:unknown[]){for(const e of [...events].reverse()){const p=z.object({type:z.string()}).safeParse(e);if(!p.success)continue;if(['turn.cancelled','turn.failed','session.failed','turn.completed'].includes(p.data.type))return p.data.type;if(['turn.started','message.received'].includes(p.data.type))return null;}return null;}

export function eventsForDelivery(events:unknown[],deliveryId:string){return events.filter(event=>z.object({meta:z.object({deliveryIds:z.array(z.string())})}).safeParse(event).data?.meta.deliveryIds.includes(deliveryId));}
