import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectRunEvent,readRun,readStationRun } from '../runtime/lib/cockpit-run.ts';
const proof=JSON.parse(readFileSync(new URL('./fixtures/cockpit-run-events.json',import.meta.url),'utf8'));
const liveEvents:unknown[]=[proof.publication];
function session(events:unknown[],tail=events.length-1){return {getStreamTailIndex:async()=>tail,getEventStream:async()=>new ReadableStream({start(controller){for(const event of events)controller.enqueue(event);controller.close();}})};}
test('actual recorded owner event projects the exact operation and delivery',async()=>{
 const event:any=liveEvents.find((e:any)=>e.type==='action.result'&&e.data?.result?.toolName==='publish_work'&&e.data?.result?.output?.operationId&&e.meta?.deliveryIds?.length);
 assert.ok(event,'Live proof must contain host publication');
 const operationId=event.data.result.output.operationId;
 assert.equal(projectRunEvent(event,operationId)?.kind,'work');
 assert.equal(projectRunEvent(event,'wrong-operation'),undefined);
 const deliveryId=event.meta.deliveryIds[0];
 assert.equal((await readRun(session([event]),{operationId,deliveryId})).result?.kind,'work');
 assert.equal((await readRun(session([event]),{operationId,deliveryId:'wrong-delivery'})).result,undefined);
});
test('new turn removes stale completion and truncated snapshots cannot activate',async()=>{
 const events=[{type:'turn.completed',data:{}},{type:'turn.started',data:{}}];
 assert.equal((await readRun(session(events))).terminal,undefined);
 assert.equal((await readRun(session(events,4))).complete,false);
});
test('session lifetime completion is exposed as a terminal event',async()=>{
 const result=await readRun(session([{type:'session.completed'}]));
 assert.equal(result.terminal,'session.completed');
 assert.equal(result.complete,true);
});
test('dispatcher result follows actual recorded child call',async()=>{
 const event=proof.dispatch;assert.ok(event);
 const child=event.data.childSessionId;const seen:string[]=[];
 const result=await readStationRun(id=>{seen.push(id);return session(id==='root'?[event]:[{type:'turn.started',data:{}}]);},'root');
 assert.deepEqual(seen,['root',child]);assert.equal(result.sessionId,child);
});
