import { factorySession } from "../lib/root-agent-client";
import { mergeReviewed } from "../lib/merge-reviewed";
import { ensureDeliveryDriver,cancelDeliveryDriver } from '../lib/delivery-driver';
import { ownsDriver } from '../lib/delivery-driver-state';
import { defineChannel,GET,POST,type RouteHandlerArgs } from 'eve/channels';
import { routeAuth } from 'eve/channels/auth';
import { z } from 'zod';
import { getToken } from '@vercel/connect';
import { readCockpit,updateCockpit } from '../lib/cockpit-store';
import { changeRecord,workOrderAdmissionSchema } from '../../shared/cockpit';
import { factoryAuth } from '../lib/route-auth';
import { stationOperation } from './stations';
import { deliveryRequest,newDelivery,operationFor,transition,terminal,applyReview,referenceState,claimAdvance,commitAdvance,requestResume,beginRevision,admissionRecoveryAction,recordAdmissionFailure,retryAdmission,type Delivery } from '../lib/delivery-state';
import { listDeliveryReceipts,readDelivery,updateDelivery } from '../lib/delivery-store';
import { classifyDeliveryError,snapshotEvents,childIn,hostResult,stoppedWithoutResult,eventsForDelivery,modelUsageFromEvents,resumeMessage,resumeReceipt,type ClassifiedDeliveryError, type EventSnapshot } from '../lib/delivery-events';
import { readPull,readBranch,WorkError,workBranch } from '../lib/work-github';
import { repository } from '../lib/github.mjs';
import { githubConnectorName } from '../lib/factory-config.ts';
import { reconcileManuallyMergedDelivery } from '../lib/delivery-reconcile';
import { visualReviewPacketSchema } from '../lib/visual-review';
const publication=z.object({number:z.number().int().positive(),url:z.string().url(),headSha:z.string().regex(/^[a-f0-9]{40}$/),targetHeadSha:z.string().regex(/^[a-f0-9]{40}$/),targetBranch:z.string(),ownerSessionId:z.string(),branch:z.string()});
const review=z.object({verdict:z.enum(['approve','changes_requested','incomplete']),summary:z.string(),headSha:z.string(),baseSha:z.string(),targetBranch:z.string(),findings:z.array(z.object({severity:z.string(),path:z.string(),message:z.string(),evidence:z.string()})),limitations:z.array(z.string()),visualReview:visualReviewPacketSchema.optional(),verification:z.object({prepared:z.boolean(),repositoryChecksPassed:z.boolean(),candidateUnchanged:z.boolean()}).optional()});
function admissionFailureResponse(state: Delivery){return Response.json({deliveryId:state.id,phase:state.phase,state:state.state,error:state.error||'Outer workflow admission failed.',recovery:admissionRecoveryAction(state.id,state.request)},{status:503});}
async function existing(id:string){const saved=await readDelivery(id);if(!saved)throw new Error('Delivery not found');return saved.state;}
function classifiedResponse(failure: ClassifiedDeliveryError, state?: Delivery){
 const recovery=failure.code.startsWith('observation_')&&state ? {method:'POST',path:`/factory/delivery/${state.id}/resume`,body:{},description:'Retry observation of the same session. The failed phase and owner are preserved.'} : failure.code==='provider_unavailable'&&state ? {method:'POST',path:`/factory/delivery/${state.id}/advance`,body:{},description:'Retry the same delivery operation after the provider recovers.'} : undefined;
 return Response.json({...(state?{deliveryId:state.id,phase:state.phase,state:state.state,failedPhase:state.failedPhase}:{}),error:{code:failure.code,kind:failure.kind,message:failure.message,retryable:failure.retryable},...(recovery?{recovery}:{})},{status:failure.status});
}
function rememberObservation(state: Delivery, snapshot: EventSnapshot) {
 if(!snapshot.length)return;
 state.observation={lastEventIndex:snapshot.observation.lastEventIndex,lastEventAt:snapshot.observation.lastEventAt||state.observation.lastEventAt||new Date().toISOString()};
}
function protectedRoute(fn:(request:Request,args:RouteHandlerArgs)=>Promise<Response>){return async(request:Request,args:RouteHandlerArgs)=>{const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)return auth;try{return await fn(request,args);}catch(error){return classifiedResponse(classifyDeliveryError(error));}};}
async function checkCurrent(p:NonNullable<Delivery['publication']>){
 const token=await getToken(githubConnectorName,{subject:{type:'app'}});const pr=await readPull(token,p.number);const targetHeadSha=await readBranch(token,pr.base.ref);
 const status=referenceState(p,{state:pr.state,headSha:pr.head.sha,targetBranch:pr.base.ref,targetHeadSha});
 if(status==='needs_revision')throw new WorkError('needs_revision','PR head or target advanced. Request /revise for the original owner to incorporate current changes with refresh_target, verify and republish; then the loop requests a fresh review.');
 if(status==='blocked')throw new WorkError('target_closed','PR closed or retargeted; an explicit target decision is required. No branch was adopted.');
}
async function advance(request:Request,ctx:RouteHandlerArgs){
 const id=ctx.params.id;let state=await existing(id);if(terminal(state.phase))return Response.json(state);
 const driverGeneration=request.headers.get('x-factory-driver-generation');
 if(driverGeneration&&!ownsDriver(state,driverGeneration,request.headers.get('x-factory-driver-run')||''))return Response.json(state);
 const claim=await updateDelivery(id,current=>{if(!current)throw new Error('Delivery not found');const result=claimAdvance(current);return{state:current,result};});
 if(!claim)return Response.json(await existing(id));state=claim;let claimedVersion=claim.version;const startedPhase=claim.phase;
 let failure: ClassifiedDeliveryError|undefined;
 try{
  if(state.phase==='merging'){
   if(!state.publication||!state.mergeReview||!state.reviewerSessionId)throw new Error('Missing bound review for merge decision');
   state.mergeDecision=await mergeReviewed({publication:state.publication,review:state.mergeReview,reviewerSessionId:state.reviewerSessionId});
   if(state.mergeDecision.status!=='waiting')transition(state,state.mergeDecision.status==='merged'?'merged':'human_review',{reason:state.mergeDecision.reason});
  }else if(state.phase==='owner_resuming'){
   if(!state.childSessionId||state.publication||!state.resumeOperationId)throw new Error('Recovery requires the original unpublished worker.');
   let deliveryId:string|undefined;
   if(state.resumeAttemptedAt){
    const snapshot=await snapshotEvents((await factorySession(state.childSessionId,ctx.attachSession)),{startIndex:0});
    rememberObservation(state,snapshot);
    deliveryId=resumeReceipt(snapshot,state.resumeOperationId);
    // Send intent is recorded before the queued message. If the receipt is lost we
    // look for the exact message in the owner's durable stream; we never resend,
    // because a duplicate turn would make the owner do the work twice. The rare
    // crash-before-send case is therefore left for a person after 60 s instead of
    // guessing. Recovery paths: unpublished worker after a baseline failure ->
    // fix the baseline, then /resume (or CLI --continue); published worker ->
    // /revise; stopped reviewer -> start a new review; this error -> inspect.
    if(!deliveryId&&Date.now()-state.resumeAttemptedAt>60000)throw new Error('Resume acceptance is unconfirmed. No message was resent. Inspect the original owner before manual recovery.');
   }else{
    const marked=await updateDelivery(id,current=>{if(!current)throw new Error('Delivery missing');if(current.version!==claimedVersion)return{state:current,result:null};current.resumeAttemptedAt=Date.now();current.version++;return{state:current,result:structuredClone(current)};});
    if(!marked)return Response.json(await existing(id));
    state.resumeAttemptedAt=marked.resumeAttemptedAt;state.version=marked.version;claimedVersion=marked.version;
    const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)throw new Error('Recovery identity unavailable');
    const accepted=await (await factorySession(state.childSessionId,ctx.attachSession)).send(resumeMessage(state.resumeOperationId),{turnPolicy:'queue',auth:{...auth,attributes:{...auth.attributes,factoryResumeOperationId:state.resumeOperationId}}});
    if(accepted.status!=='accepted'||!accepted.deliveryId)throw new Error('Original worker acceptance is unconfirmed; this owner will not be replaced.');
    deliveryId=accepted.deliveryId;
   }
   if(deliveryId){state.sessionId=state.childSessionId;state.deliveryId=deliveryId;state.execution={attempt:state.attempt,station:'worker',operationId:state.operationId,sessionId:state.childSessionId,deliveryId};transition(state,'working',{reason:'The original owner accepted the queued continuation.'});}
  }else if(state.phase.endsWith('_starting')){
   const station=state.phase==='worker_starting'?'worker':state.phase==='review_starting'?'reviewer':'revisions';
   if(station==='reviewer')await checkCurrent(state.publication!);
   const body=station==='worker'?{operationId:state.operationId,title:state.request.title,brief:state.request.brief,...(state.request.parentPrNumber?{parentPrNumber:state.request.parentPrNumber}:{})}:station==='reviewer'?{operationId:state.operationId,prNumber:state.publication!.number}:{operationId:state.operationId,prNumber:state.publication!.number,brief:state.revisionBrief};
   const response=await stationOperation(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(body)}),{...ctx,params:{station}},state.id);
   const result=await response.json();if(!response.ok){const code=typeof result.error==='object'&&result.error&&typeof result.error.code==='string'?result.error.code:response.status>=500?'provider_unavailable':'invalid_request';throw new WorkError(code,typeof result.error==='string'?result.error:result.error?.message||'Station start failed');}
   state.sessionId=z.string().parse(result.sessionId);state.childSessionId=station==='revisions'||result.execution==='direct'||result.execution==='owner'?state.sessionId:undefined;state.deliveryId=result.deliveryId;state.execution={attempt:state.attempt,station,operationId:state.operationId,sessionId:state.sessionId,deliveryId:state.deliveryId};
   transition(state,station==='worker'?'working':station==='reviewer'?'reviewing':'revising',{reason:`${station} execution accepted by the host.`});
  }else{
   if(!state.sessionId)throw new Error('Delivery session receipt missing');
   const startIndex=state.observation.lastEventIndex+1;
   let snapshot=await snapshotEvents((await factorySession(state.sessionId,ctx.attachSession)),{startIndex});
   let events: unknown[]=snapshot;
   if(!state.childSessionId)state.childSessionId=childIn(events);
   if(state.childSessionId&&state.childSessionId!==state.sessionId){
    snapshot=await snapshotEvents((await factorySession(state.childSessionId,ctx.attachSession)),{startIndex});
    events=snapshot;
   }
   rememberObservation(state,snapshot);
   const owner=state.childSessionId||state.sessionId;
   if(state.deliveryId)events=eventsForDelivery(events,state.deliveryId);
   const usage=modelUsageFromEvents(events,{attachFactorySha:true});
   if(usage)state.usage=usage;
   const result=hostResult(events,state.phase==='reviewing'?'record_review':'publish_work',owner,state.phase==='reviewing'?undefined:state.operationId);
   if(result&&state.phase==='reviewing'){
    const observed=review.parse(result);await checkCurrent(state.publication!);applyReview(state,observed);
    if(['ready','human_review'].includes(state.phase)){state.mergeReview=observed;state.reviewerSessionId=owner;transition(state,'merging');}
   }else if(result){
    const p=publication.parse(result.publication);if(result.revisionProtocol!==1||p.branch!==workBranch(owner)||p.ownerSessionId!==owner)throw new Error('Publication owner does not match the executing worker');
    state.publication=p;state.changeId??=state.id;await checkCurrent(p);state.operationId=operationFor(state.id,'review',state.cycle);transition(state,'review_starting',{reason:'The worker publication is recorded; independent verification is next.'});
   }else if(state.childSessionId&&stoppedWithoutResult(events)){
    state.failedPhase=state.phase;state.error='Agent stopped without a trusted result. Inspect its run; source and ownership are preserved.';transition(state,'human_review',{reason:'The owner session stopped without a trusted host result.'});
   }
  }
 }catch(error){
  failure=classifyDeliveryError(error);
  state.failure=failure;
  state.error=failure.message;
  if(failure.kind==='observation'){
   state.failedPhase=startedPhase;
   transition(state,'blocked',{actor:'workflow',reason:`Recoverable observation failure in ${startedPhase}: ${failure.message}`});
  }else if(failure.code==='target_closed'){
   state.failedPhase=startedPhase;
   transition(state,'human_review',{actor:'provider',reason:`Target requires a human decision: ${failure.message}`});
  }else if(failure.code==='needs_revision'||failure.code==='stale_head'||failure.code==='target_advanced'){
   transition(state,'needs_revision',{actor:'provider',reason:failure.message});
  }
 }
 const committed=await updateDelivery(id,current=>{if(!current)throw new Error('Delivery missing');const next=commitAdvance(current,state,claimedVersion);return{state:next,result:next};});
 if(committed.phase==='cancelled'&&state.sessionId)await (await factorySession(state.sessionId,ctx.attachSession)).cancel({tasks:true});
 if(failure)return classifiedResponse(failure,committed);
 return Response.json(committed);
}
export default defineChannel({routes:[
 POST('/factory/delivery',protectedRoute(async(request)=>{
  const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)return auth;
  const input=deliveryRequest.parse(await request.json());
  if(!input.draftId)throw new WorkError('invalid_request','Start delivery from a persisted task-mining draft admitted as a work order.');
  const draft=(await readCockpit()).document.drafts[input.draftId];
  const admission=workOrderAdmissionSchema.safeParse(draft?.value.admission);
  if(!draft||!admission.success||admission.data.kind!=='work_order')throw new WorkError('invalid_request','Only a task-mining draft admitted as a work order can start delivery.');
  if(draft.value.title!==input.title||draft.value.request!==input.brief)throw new WorkError('invalid_request','Delivery content must match the admitted draft.');
  const fresh=newDelivery(auth.principalId,input);
  const state=await updateDelivery(fresh.id,current=>{if(current&&JSON.stringify(current.request)!==JSON.stringify(input))throw new Error('Operation ID reused with a different task');if(current)retryAdmission(current);return{state:current||fresh,result:current||fresh};});await updateCockpit(doc=>doc.runs[state.id]||changeRecord(doc,'runs',state.id,{label:state.request.title,station:'loop',operationId:state.request.operationId},0));
  try{await ensureDeliveryDriver(state.id,request);}catch(error){
   try{const blocked=await updateDelivery(state.id,current=>{if(!current)throw new Error('Delivery disappeared during outer workflow admission.');if(current.phase==='worker_starting')recordAdmissionFailure(current,error);return{state:current,result:current};});return admissionFailureResponse(blocked);}catch{ return Response.json({deliveryId:state.id,phase:state.phase,state:state.state,error:'Outer workflow admission failed and recovery could not be confirmed. Retry the original POST with the same operationId, then inspect this delivery ID.',recovery:admissionRecoveryAction(state.id,input)},{status:503});}
  }
  return Response.json(await existing(state.id),{status:202});
 })),
 GET('/factory/delivery/:id',protectedRoute(async(_,ctx)=>Response.json(await existing(ctx.params.id)))),
 GET('/factory/delivery/:id/reconcile',protectedRoute(async(_,ctx)=>{
  const state=await existing(ctx.params.id);
  if(!state.publication)return Response.json({deliveryId:state.id,...reconcileManuallyMergedDelivery(state,undefined,repository)});
  const token=await getToken(githubConnectorName,{subject:{type:'app'}});
  const pull=await readPull(token,state.publication.number);
  return Response.json({deliveryId:state.id,...reconcileManuallyMergedDelivery(state,{repository,number:pull.number,merged:pull.merged===true,state:pull.state,headSha:pull.head.sha,targetHeadSha:pull.base.sha,targetBranch:pull.base.ref,mergeCommitSha:pull.merge_commit_sha??undefined},repository)});
 })),
 GET('/factory/delivery/:id/receipts',protectedRoute(async(_,ctx)=>{await existing(ctx.params.id);return Response.json(await listDeliveryReceipts(ctx.params.id));})),
 POST('/factory/delivery/:id/advance',protectedRoute(advance)),
 POST('/factory/delivery/:id/cancel',protectedRoute(async(request,ctx)=>{
  const state=await updateDelivery(ctx.params.id,current=>{if(!current)throw new Error('Delivery not found');transition(current,'cancelled',{actor:'operator',reason:'Operator cancelled the delivery.'});return{state:current,result:current};});
  const cancellations=await Promise.allSettled([cancelDeliveryDriver(state.id,request),...Array.from(new Set([state.sessionId,state.childSessionId].filter((id):id is string=>!!id))).map(async id=>(await factorySession(id,ctx.attachSession)).cancel({tasks:true}))]);
  if(cancellations.some(result=>result.status==='rejected'))throw new Error('Cancellation was recorded; retry to confirm all sessions and the outer driver have stopped.');return Response.json(state);
 })),
 POST('/factory/delivery/:id/resume',protectedRoute(async(request,ctx)=>{
  const input=z.object({operationId:z.string().uuid().optional()}).strict().parse(await request.json().catch(()=>({})));
  const state=await updateDelivery(ctx.params.id,current=>{if(!current)throw new Error('Delivery missing');if(terminal(current.phase))requestResume(current,input.operationId);return{state:current,result:current};});await ensureDeliveryDriver(state.id,request);return Response.json(await existing(state.id),{status:202});
 })),
 POST('/factory/delivery/:id/revise',protectedRoute(async(request,ctx)=>{
  const input=z.object({operationId:z.string().uuid(),brief:z.string().trim().min(20).max(18000)}).strict().parse(await request.json());
  const state=await updateDelivery(ctx.params.id,current=>{if(!current)throw new Error('Delivery not found');
   if(current.revisionRequests?.[input.operationId]){if(current.revisionRequests[input.operationId]!==input.brief)throw new Error('Revision ID reused with different instructions');return{state:current,result:current};}
   if(!['human_review','ready','blocked','needs_revision'].includes(current.phase)||!current.publication)throw new Error('Wait for a published candidate before requesting a revision');
   current.revisionRequests={...current.revisionRequests,[input.operationId]:input.brief};beginRevision(current,input.operationId,input.brief,{actor:'operator',reason:'Operator requested a new same-owner revision attempt.'});return{state:current,result:current};});await ensureDeliveryDriver(state.id,request);return Response.json(await existing(state.id),{status:202});
 }))
]});
