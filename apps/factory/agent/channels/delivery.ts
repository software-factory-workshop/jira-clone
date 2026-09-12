import { defineChannel,GET,POST,type RouteHandlerArgs } from 'eve/channels';
import { routeAuth } from 'eve/channels/auth';
import { z } from 'zod';
import { getToken } from '@vercel/connect';
import { updateCockpit } from '../lib/cockpit-store';
import { changeRecord } from '../../shared/cockpit';
import { factoryAuth } from '../lib/route-auth';
import { stationOperation } from './stations';
import { deliveryRequest,newDelivery,operationFor,transition,terminal,applyReview,referenceState,claimAdvance,commitAdvance,type Delivery } from '../lib/delivery-state';
import { readDelivery,updateDelivery } from '../lib/delivery-store';
import { snapshotEvents,childIn,hostResult,stoppedWithoutResult,eventsForDelivery } from '../lib/delivery-events';
import { readPull,readBranch,WorkError,workBranch } from '../lib/work-github';
const publication=z.object({number:z.number().int().positive(),url:z.string().url(),headSha:z.string().regex(/^[a-f0-9]{40}$/),targetHeadSha:z.string().regex(/^[a-f0-9]{40}$/),targetBranch:z.string(),ownerSessionId:z.string(),branch:z.string()});
const review=z.object({verdict:z.enum(['approve','changes_requested','incomplete']),summary:z.string(),headSha:z.string(),baseSha:z.string(),targetBranch:z.string(),findings:z.array(z.object({severity:z.string(),path:z.string(),message:z.string(),evidence:z.string()})),limitations:z.array(z.string())});
async function existing(id:string){const saved=await readDelivery(id);if(!saved)throw new Error('Delivery not found');return saved.state;}
function protectedRoute(fn:(request:Request,args:RouteHandlerArgs)=>Promise<Response>){return async(request:Request,args:RouteHandlerArgs)=>{const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)return auth;try{return await fn(request,args);}catch(error){return Response.json({error:error instanceof Error?error.message:'Delivery failed'},{status:400});}};}
async function checkCurrent(p:NonNullable<Delivery['publication']>){
 const token=await getToken('github/jira-clone',{subject:{type:'app'}});const pr=await readPull(token,p.number);const targetHeadSha=await readBranch(token,pr.base.ref);
 const status=referenceState(p,{state:pr.state,headSha:pr.head.sha,targetBranch:pr.base.ref,targetHeadSha});
 if(status==='needs_revision')throw new WorkError('needs_revision','PR head or target advanced. Request /revise for the original owner to incorporate current changes with refresh_target, verify and republish; then the loop requests a fresh review.');
 if(status==='blocked')throw new WorkError('blocked','PR closed or retargeted; an explicit target decision is required. No branch was adopted.');
}
async function advance(request:Request,ctx:RouteHandlerArgs){
 const id=ctx.params.id;let state=await existing(id);if(terminal(state.phase))return Response.json(state);
 const claim=await updateDelivery(id,current=>{if(!current)throw new Error('Delivery not found');const result=claimAdvance(current);return{state:current,result};});
 if(!claim)return Response.json(await existing(id));state=claim;const claimedVersion=claim.version;const startedPhase=claim.phase;
 try{
  if(state.phase.endsWith('_starting')){
   const station=state.phase==='worker_starting'?'worker':state.phase==='review_starting'?'reviewer':'revisions';
   if(station==='reviewer')await checkCurrent(state.publication!);
   const body=station==='worker'?{operationId:state.operationId,title:state.request.title,brief:state.request.brief,...(state.request.parentPrNumber?{parentPrNumber:state.request.parentPrNumber}:{})}:station==='reviewer'?{operationId:state.operationId,prNumber:state.publication!.number}:{operationId:state.operationId,prNumber:state.publication!.number,brief:state.revisionBrief};
   const response=await stationOperation(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(body)}),{...ctx,params:{station}},state.id);
   const result=await response.json();if(!response.ok)throw new Error(typeof result.error==='string'?result.error:result.error?.message||'Station start failed');
   state.sessionId=z.string().parse(result.sessionId);state.childSessionId=station==='revisions'?state.sessionId:undefined;state.deliveryId=result.deliveryId;
   transition(state,station==='worker'?'working':station==='reviewer'?'reviewing':'revising');
  }else{
   if(!state.sessionId)throw new Error('Delivery session receipt missing');
   let events=await snapshotEvents(ctx.attachSession(state.sessionId));
   if(!state.childSessionId)state.childSessionId=childIn(events);
   if(state.childSessionId&&state.childSessionId!==state.sessionId)events=await snapshotEvents(ctx.attachSession(state.childSessionId));
   const owner=state.childSessionId||state.sessionId;
   if(state.deliveryId)events=eventsForDelivery(events,state.deliveryId);
   const result=hostResult(events,state.phase==='reviewing'?'record_review':'publish_work',owner,state.phase==='reviewing'?undefined:state.operationId);
   if(result&&state.phase==='reviewing'){
    const observed=review.parse(result);await checkCurrent(state.publication!);applyReview(state,observed);
   }else if(result){
    const p=publication.parse(result.publication);if(result.revisionProtocol!==1||p.branch!==workBranch(owner)||p.ownerSessionId!==owner)throw new Error('Publication owner does not match the executing worker');
    state.publication=p;await checkCurrent(p);state.operationId=operationFor(state.id,'review',state.cycle);transition(state,'review_starting');
   }else if(state.childSessionId&&stoppedWithoutResult(events)){
    state.error='Agent stopped without a trusted result. Inspect its run; source and ownership are preserved.';transition(state,'human_review');
   }
  }
 }catch(error){state.failedPhase=startedPhase;state.error=error instanceof Error?error.message:'Delivery advance failed';transition(state,error instanceof WorkError&&error.code==='needs_revision'?'needs_revision':'blocked');}
 const committed=await updateDelivery(id,current=>{if(!current)throw new Error('Delivery missing');const next=commitAdvance(current,state,claimedVersion);return{state:next,result:next};});
 if(committed.phase==='cancelled'&&state.sessionId)await ctx.attachSession(state.sessionId).cancel({tasks:true});
 return Response.json(committed);
}
export default defineChannel({routes:[
 POST('/factory/delivery',protectedRoute(async(request)=>{
  const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)return auth;
  const input=deliveryRequest.parse(await request.json());const fresh=newDelivery(auth.principalId,input);
  const state=await updateDelivery(fresh.id,current=>{if(current&&JSON.stringify(current.request)!==JSON.stringify(input))throw new Error('Operation ID reused with a different task');return{state:current||fresh,result:current||fresh};});await updateCockpit(doc=>doc.runs[state.id]||changeRecord(doc,'runs',state.id,{label:state.request.title,station:'loop',operationId:state.request.operationId},0));return Response.json(state,{status:202});
 })),
 GET('/factory/delivery/:id',protectedRoute(async(_,ctx)=>Response.json(await existing(ctx.params.id)))),
 POST('/factory/delivery/:id/advance',protectedRoute(advance)),
 POST('/factory/delivery/:id/cancel',protectedRoute(async(_,ctx)=>{
  const state=await updateDelivery(ctx.params.id,current=>{if(!current)throw new Error('Delivery not found');transition(current,'cancelled');return{state:current,result:current};});
  for(const id of new Set([state.sessionId,state.childSessionId].filter((id):id is string=>!!id)))await ctx.attachSession(id).cancel({tasks:true});return Response.json(state);
 })),
 POST('/factory/delivery/:id/resume',protectedRoute(async(_,ctx)=>{const state=await updateDelivery(ctx.params.id,current=>{if(!current||current.phase!=='blocked'||!current.failedPhase)throw new Error('Only a blocked delivery can resume');transition(current,current.failedPhase);delete current.error;return{state:current,result:current};});return Response.json(state,{status:202});})),
 POST('/factory/delivery/:id/revise',protectedRoute(async(request,ctx)=>{
  const input=z.object({operationId:z.string().uuid(),brief:z.string().trim().min(20).max(18000)}).strict().parse(await request.json());
  const state=await updateDelivery(ctx.params.id,current=>{if(!current)throw new Error('Delivery not found');
   if(current.revisionRequests?.[input.operationId]){if(current.revisionRequests[input.operationId]!==input.brief)throw new Error('Revision ID reused with different instructions');return{state:current,result:current};}
   if(!['human_review','ready','blocked','needs_revision'].includes(current.phase)||!current.publication)throw new Error('Wait for a published candidate before requesting a revision');
   current.revisionRequests={...current.revisionRequests,[input.operationId]:input.brief};current.cycle++;current.operationId=input.operationId;current.revisionBrief=input.brief;delete current.error;transition(current,'revision_starting');return{state:current,result:current};});return Response.json(state,{status:202});
 }))
]});
