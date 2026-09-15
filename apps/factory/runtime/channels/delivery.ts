import { factorySession } from "../lib/root-agent-client";
import { ensureDeliveryDriver,cancelDeliveryDriver } from '../lib/delivery-driver';
import { ownsDriver } from '../lib/delivery-driver-state';
import { defineChannel,GET,POST,type RouteHandlerArgs } from 'eve/channels';
import { routeAuth } from 'eve/channels/auth';
import { z } from 'zod';
import { getToken } from '@vercel/connect';
import { readCockpit,updateCockpit } from '../lib/cockpit-store';
import { changeRecord,deliveryEntryPoint } from '../../shared/cockpit';
import { factoryAuth } from '../lib/route-auth';
import { stationOperation } from './stations';
import { reconcileCanReuse, answerOwnerQuestion, deliveryRequest,newDelivery,operationFor,transition,terminal,applyReview,referenceState,claimAdvance,commitAdvance,requestResume,beginRevision,admissionRecoveryAction,recordAdmissionFailure,retryAdmission,type Delivery } from '../lib/delivery-state';
import { listDeliveryReceipts,readDelivery,updateDelivery } from '../lib/delivery-store';
import { classifyDeliveryError,snapshotEvents,childIn,hostResult,stoppedWithoutResult,eventsForDelivery,modelUsageFromEvents,pendingSessionLimitResponses,resolvedSessionLimitRequests,resumeMessage,resumeReceipt,type ClassifiedDeliveryError, type EventSnapshot } from '../lib/delivery-events';
import { readPull,readBranch,WorkError,workBranch } from '../lib/work-github';
import { githubConnectorName } from '../lib/factory-config.ts';
import { inspectMergeCandidate, markPullRequestReady, readGithubPullSnapshot, recoverPublishedWork, snapshotIsMergedCandidate, type RecoveredPublication } from '../lib/pr-lifecycle';
import type { MergeDecision, MergeReview } from '../lib/merge-policy';
import { mergeReviewed } from '../lib/merge-reviewed';
import { visualReviewPacketSchema } from '../lib/visual-review';
import { createIncompleteReviewFeedback } from '../lib/review-feedback';
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
function executionRoot(state: Delivery) {
 const station=state.execution?.station;
 return station==='reviewer' ? 'reviewer' as const : station==='worker'||station==='revisions' ? 'worker' as const : undefined;
}
function deliverySession(state: Delivery, id: string, attachSession: RouteHandlerArgs['attachSession']) {
 return factorySession(id,attachSession,executionRoot(state));
}
function protectedRoute(fn:(request:Request,args:RouteHandlerArgs)=>Promise<Response>){return async(request:Request,args:RouteHandlerArgs)=>{const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)return auth;try{return await fn(request,args);}catch(error){return classifiedResponse(classifyDeliveryError(error));}};}
async function checkCurrent(p:NonNullable<Delivery['publication']>){
 const token=await getToken(githubConnectorName,{subject:{type:'app'}});const pr=await readPull(token,p.number);const targetHeadSha=await readBranch(token,pr.base.ref);
 const status=referenceState(p,{state:pr.state,headSha:pr.head.sha,targetBranch:pr.base.ref,targetHeadSha});
 if(status==='needs_revision')throw new WorkError('needs_revision','PR head or target advanced. Request /revise for the original owner to incorporate current changes with refresh_target, verify and republish; then the loop requests a fresh review.');
 if(status==='blocked')throw new WorkError('target_closed','PR closed or retargeted; an explicit target decision is required. No branch was adopted.');
}
function mergeReviewFor(state: Delivery): MergeReview | undefined {
 if(state.mergeReview)return state.mergeReview;
 return state.review as unknown as MergeReview|undefined;
}
async function persistGithubObservation(id:string, expected:NonNullable<Delivery['publication']>, snapshot:Awaited<ReturnType<typeof readGithubPullSnapshot>>, decision:MergeDecision, options:{beginMerge?:boolean;fallbackPhase?:'ready'|'human_review'}={}){
 return updateDelivery(id,current=>{
  if(!current)throw new Error('Delivery not found');
  if(!current.publication||current.publication.number!==expected.number||current.publication.headSha!==expected.headSha||current.publication.targetBranch!==expected.targetBranch)return{state:current,result:current};
  current.github={...snapshot,observedAt:new Date().toISOString()};
  current.mergeDecision=decision;
  if(decision.status==='eligible'&&options.beginMerge&&['human_review','ready','blocked','needs_revision'].includes(current.phase)){
   transition(current,'merging',{actor:'operator',reason:'Exact GitHub and host policy checks passed; the requested merge is in flight.'});
  }else if(decision.status==='merged'&&snapshotIsMergedCandidate(snapshot,current.publication)&&['human_review','ready','blocked','needs_revision','merging'].includes(current.phase)){
   transition(current,'merged',{actor:'reconciler',reason:decision.reason});
  }else if(['manual','waiting'].includes(decision.status)&&current.phase==='merging'){
   transition(current,options.fallbackPhase||'ready',{actor:'provider',reason:decision.reason});
  }
  return{state:current,result:current};
 });
}
const publicationRecoveryPhases = new Set<Delivery['phase']>(['human_review', 'blocked', 'needs_revision']);
async function persistRecoveredPublication(id:string, recovered:RecoveredPublication) {
 return updateDelivery(id,current=>{
  if(!current)throw new Error('Delivery not found');
  if(current.publication)return{state:current,result:current};
  const owner=current.childSessionId||current.sessionId;
  if(owner!==recovered.ownerSessionId||current.operationId!==recovered.operationId)return{state:current,result:current};
  current.publication={number:recovered.number,url:recovered.url,headSha:recovered.headSha,targetHeadSha:recovered.targetHeadSha,targetBranch:recovered.targetBranch,ownerSessionId:recovered.ownerSessionId,branch:recovered.branch};
  current.changeId??=current.id;
  delete current.error;
  return{state:current,result:current};
});
}
async function reconcileDelivery(state:Delivery) {
 if(reconcileCanReuse(state))return state;
 let token:string|undefined;
 if(!state.publication){
  const owner=state.childSessionId||state.sessionId;
  if(!owner||!publicationRecoveryPhases.has(state.phase))return state;
  token=await getToken(githubConnectorName,{subject:{type:'app'}});
  const recovered=await recoverPublishedWork(token,owner,state.operationId,state.request.parentPrNumber?undefined:'main');
  if(!recovered)return state;
  state=await persistRecoveredPublication(state.id,recovered);
 }
 if(!state.publication)return state;
 token??=await getToken(githubConnectorName,{subject:{type:'app'}});
 const inspection=await inspectMergeCandidate(token,state.publication,mergeReviewFor(state),state.reviewerSessionId);
 return persistGithubObservation(state.id,state.publication,inspection.snapshot,inspection.decision);
}
function mergeFailureResponse(state:Delivery,decision:MergeDecision){
 return Response.json({delivery:state,error:{code:'merge_not_eligible',message:decision.reason},blockers:decision.blockers||[decision.reason]},{status:409});
}
async function advance(request:Request,ctx:RouteHandlerArgs){
 const id=ctx.params.id;let state=await existing(id);if(terminal(state.phase)||state.phase==='awaiting_input'||state.phase==='merging')return Response.json(state);
 const driverGeneration=request.headers.get('x-factory-driver-generation');
 if(driverGeneration&&!ownsDriver(state,driverGeneration,request.headers.get('x-factory-driver-run')||''))return Response.json(state);
 const claim=await updateDelivery(id,current=>{if(!current)throw new Error('Delivery not found');const result=claimAdvance(current);return{state:current,result};});
 if(!claim)return Response.json(await existing(id));state=claim;let claimedVersion=claim.version;const startedPhase=claim.phase;
 let failure: ClassifiedDeliveryError|undefined;
 try{
  if(state.phase==='owner_resuming'){
   if(!state.childSessionId||state.publication||!state.resumeOperationId)throw new Error('Recovery requires the original unpublished worker.');
   const owner=await deliverySession(state,state.childSessionId,ctx.attachSession);
   let deliveryId:string|undefined;
   let continuationAccepted=false;
   if(state.resumeAttemptedAt){
    const snapshot=await snapshotEvents(owner,{startIndex:0});
    rememberObservation(state,snapshot);
    deliveryId=resumeReceipt(snapshot,state.resumeOperationId,state.resumeMessage);
    continuationAccepted=!!deliveryId||resolvedSessionLimitRequests(snapshot,state.resumeInputRequestIds||[]);
    // Send intent is recorded before the queued message. If the receipt is lost we
    // look for the exact message in the owner's durable stream; we never resend,
    // because a duplicate turn would make the owner do the work twice. The rare
    // crash-before-send case is therefore left for a person after 60 s instead of
    // guessing. Recovery paths: unpublished worker after a baseline failure ->
    // fix the baseline, then /resume (or CLI --continue); published worker ->
    // /revise; stopped reviewer -> start a new review; this error -> inspect.
    if(!deliveryId&&Date.now()-state.resumeAttemptedAt>60000)throw new Error('Resume acceptance is unconfirmed. No message was resent. Inspect the original owner before manual recovery.');
   }else{
    const snapshot=await snapshotEvents(owner,{startIndex:0});
    rememberObservation(state,snapshot);
    const inputResponses=pendingSessionLimitResponses(snapshot);
    const marked=await updateDelivery(id,current=>{if(!current)throw new Error('Delivery missing');if(current.version!==claimedVersion)return{state:current,result:null};current.resumeAttemptedAt=Date.now();if(snapshot.length)current.observation={...state.observation};if(inputResponses.length)current.resumeInputRequestIds=inputResponses.map(response=>response.requestId);else delete current.resumeInputRequestIds;current.version++;return{state:current,result:structuredClone(current)};});
    if(!marked)return Response.json(await existing(id));
    state.resumeAttemptedAt=marked.resumeAttemptedAt;state.resumeInputRequestIds=marked.resumeInputRequestIds;state.observation=marked.observation;state.version=marked.version;claimedVersion=marked.version;
    const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)throw new Error('Recovery identity unavailable');
    const resumeAuth={...auth,attributes:{...auth.attributes,factoryResumeOperationId:state.resumeOperationId}};
    const accepted=inputResponses.length
      ? await owner.respond(inputResponses,{auth:resumeAuth})
      : await owner.send(state.resumeMessage||resumeMessage(state.resumeOperationId),{turnPolicy:'queue',auth:resumeAuth});
    if(accepted.status!=='accepted'||(!inputResponses.length&&!accepted.deliveryId))throw new Error('Original worker acceptance is unconfirmed; this owner will not be replaced.');
    continuationAccepted=true;
    deliveryId=accepted.deliveryId;
   }
   // A structured input response resumes the existing turn and normally has
   // no new delivery ID. Keep the original binding for subsequent evidence.
   if(continuationAccepted){const usedSessionLimitResponse=!!state.resumeInputRequestIds?.length;const acceptedDeliveryId=deliveryId||state.deliveryId;state.sessionId=state.childSessionId;if(acceptedDeliveryId)state.deliveryId=acceptedDeliveryId;delete state.resumeInputRequestIds;state.execution={attempt:state.attempt,station:'worker',operationId:state.operationId,sessionId:state.childSessionId,...(acceptedDeliveryId?{deliveryId:acceptedDeliveryId}: {})};transition(state,'working',{reason:usedSessionLimitResponse?'The original owner accepted the pending session-limit continuation.':'The original owner accepted the queued continuation.'});}
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
   let snapshot=await snapshotEvents((await deliverySession(state,state.sessionId,ctx.attachSession)),{startIndex});
   let events: unknown[]=snapshot;
   if(!state.childSessionId)state.childSessionId=childIn(events);
   if(state.childSessionId&&state.childSessionId!==state.sessionId){
    snapshot=await snapshotEvents((await deliverySession(state,state.childSessionId,ctx.attachSession)),{startIndex});
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
    if(['ready','human_review'].includes(state.phase)){state.mergeReview=observed;state.reviewerSessionId=owner;}
   }else if(result){
    const p=publication.parse(result.publication);if(result.revisionProtocol!==1||p.branch!==workBranch(owner)||p.ownerSessionId!==owner)throw new Error('Publication owner does not match the executing worker');
    state.publication=p;state.changeId??=state.id;await checkCurrent(p);state.operationId=operationFor(state.id,'review',state.cycle);transition(state,'review_starting',{reason:'The worker publication is recorded; independent verification is next.'});
   }else if(state.childSessionId&&stoppedWithoutResult(events)){
    const stoppedPhase=state.phase;
    state.failedPhase=stoppedPhase;state.error='Agent stopped without a trusted result. Inspect its run; source and ownership are preserved.';
    if(stoppedPhase==='reviewing'&&state.publication){
     try{
      const fallback=await createIncompleteReviewFeedback({token:await getToken(githubConnectorName,{subject:{type:'app'}}),prNumber:state.publication.number,reviewerSessionId:owner,headSha:state.publication.headSha,baseSha:state.publication.targetHeadSha,targetBranch:state.publication.targetBranch,reason:'Reviewer session stopped before a trusted record_review result was observed.',signal:request.signal});
      state.reviewerSessionId=owner;applyReview(state,fallback.review);state.mergeReview=fallback.review;
      state.error=`Reviewer stopped without a trusted result. An incomplete visual review was recorded for the exact candidate; inspect its limitations before deciding.${fallback.publication.errors.length?` PR publication limitations: ${fallback.publication.errors.join(' ')}`:''}`;
     }catch(error){state.error=`Reviewer stopped without a trusted result. The incomplete PR feedback fallback could not run: ${error instanceof Error?error.message:'publication failed'}. Inspect its run; source and ownership are preserved.`;transition(state,'human_review',{reason:'The owner session stopped without a trusted host result and fallback publication failed.'});}
    }else{
     transition(state,'human_review',{reason:'The owner session stopped without a trusted host result.'});
    }
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
 if(committed.phase==='cancelled'&&state.sessionId)await (await deliverySession(state,state.sessionId,ctx.attachSession)).cancel({tasks:true});
 if(failure)return classifiedResponse(failure,committed);
 return Response.json(committed);
}
export default defineChannel({routes:[
 POST('/factory/delivery',protectedRoute(async(request)=>{
  const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)return auth;
  const input=deliveryRequest.parse(await request.json());
  if(!input.draftId)throw new WorkError('invalid_request','Start delivery from a saved operator idea or a task-mining draft admitted as a work order.');
  const draft=(await readCockpit()).document.drafts[input.draftId];
  const entryPoint=draft ? deliveryEntryPoint(draft.value) : undefined;
  if(!draft||!entryPoint)throw new WorkError('invalid_request','Start from an operator idea or a task-mining draft admitted as a work order.');
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
  return Response.json(await reconcileDelivery(await existing(ctx.params.id)));
 })),
 POST('/factory/delivery/:id/pr/ready',protectedRoute(async(request,ctx)=>{
  const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)return auth;
  const state=await existing(ctx.params.id);
  if(state.principalId!==auth.principalId)return Response.json({error:{code:'forbidden',message:'Only the delivery owner can change its pull request lifecycle.'}},{status:403});
  if(!state.publication)throw new WorkError('invalid_request','A pull request must be published before it can be marked ready.');
  const token=await getToken(githubConnectorName,{subject:{type:'app'}});
  const snapshot=await markPullRequestReady(token,state.publication);
  const inspection=await inspectMergeCandidate(token,state.publication,mergeReviewFor(state),state.reviewerSessionId);
  return Response.json(await persistGithubObservation(state.id,state.publication,inspection.snapshot,inspection.decision));
 })),
 POST('/factory/delivery/:id/pr/merge',protectedRoute(async(request,ctx)=>{
  const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)return auth;
  const state=await existing(ctx.params.id);
  if(state.principalId!==auth.principalId)return Response.json({error:{code:'forbidden',message:'Only the delivery owner can merge its pull request.'}},{status:403});
  if(!state.publication)throw new WorkError('invalid_request','A pull request must be published before it can be merged.');
  if(!['human_review','ready','blocked','needs_revision','merging'].includes(state.phase))throw new WorkError('invalid_request',`Delivery phase ${state.phase} cannot be merged from Cockpit.`);
  const token=await getToken(githubConnectorName,{subject:{type:'app'}});
  const review=mergeReviewFor(state);
  const inspection=await inspectMergeCandidate(token,state.publication,review,state.reviewerSessionId);
  let saved=await persistGithubObservation(state.id,state.publication,inspection.snapshot,inspection.decision,{beginMerge:inspection.decision.status==='eligible',fallbackPhase:state.phase==='ready'?'ready':'human_review'});
  if(inspection.decision.status==='merged')return Response.json(saved);
  if(inspection.decision.status!=='eligible')return mergeFailureResponse(saved,inspection.decision);
  const result=await mergeReviewed({publication:state.publication,review:review!,reviewerSessionId:state.reviewerSessionId!},token);
  const confirmed=await readGithubPullSnapshot(token,state.publication);
  const confirmedMerge=snapshotIsMergedCandidate(confirmed,state.publication);
  const decision={...result,...(confirmedMerge?{status:'merged' as const,reason:`GitHub confirms PR #${state.publication.number} merged the recorded candidate.`,commitSha:confirmed.mergeCommitSha||result.commitSha}:{}),checkedHeadSha:confirmed.headSha,checkedAt:confirmed.checkedAt, blockers:confirmedMerge?[]:(result.blockers||[result.reason])};
  saved=await persistGithubObservation(state.id,state.publication,confirmed,decision,{fallbackPhase:state.phase==='ready'?'ready':'human_review'});
  if(confirmedMerge)return Response.json(saved);
  return mergeFailureResponse(saved,decision);
 })),
 GET('/factory/delivery/:id/receipts',protectedRoute(async(_,ctx)=>{await existing(ctx.params.id);return Response.json(await listDeliveryReceipts(ctx.params.id));})),
 POST('/factory/delivery/:id/advance',protectedRoute(advance)),
 POST('/factory/delivery/:id/answer',protectedRoute(async(request,ctx)=>{
  const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)return auth;
  const input=z.object({operationId:z.string().min(1).max(240),answer:z.string().trim().min(1).max(10000)}).strict().parse(await request.json());
  const state=await updateDelivery(ctx.params.id,current=>{if(!current)throw new Error('Delivery not found');if(current.principalId!==auth.principalId)throw Object.assign(new WorkError('forbidden','Only the delivery owner can answer its worker question.'),{status:403});try{answerOwnerQuestion(current,input.operationId,input.answer,auth.principalId);}catch(error){throw new WorkError('invalid_request',error instanceof Error?error.message:'Invalid owner answer.');}return{state:current,result:current};});
  await ensureDeliveryDriver(state.id,request);
  return Response.json(await existing(state.id),{status:202});
 })),
 POST('/factory/delivery/:id/cancel',protectedRoute(async(request,ctx)=>{
  const state=await updateDelivery(ctx.params.id,current=>{if(!current)throw new Error('Delivery not found');transition(current,'cancelled',{actor:'operator',reason:'Operator cancelled the delivery.'});return{state:current,result:current};});
  const cancellations=await Promise.allSettled([cancelDeliveryDriver(state.id,request),...Array.from(new Set([state.sessionId,state.childSessionId].filter((id):id is string=>!!id))).map(async id=>(await deliverySession(state,id,ctx.attachSession)).cancel({tasks:true}))]);
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
