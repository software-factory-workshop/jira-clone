import { createHash } from 'node:crypto';
import { z } from 'zod';
import { workerRequest } from './station-access.ts';
export const deliveryRequest=workerRequest.extend({maxRevisions:z.number().int().min(0).max(10).default(3)});
export type DeliveryRequest=z.infer<typeof deliveryRequest>;
export type Phase='worker_starting'|'working'|'review_starting'|'reviewing'|'revision_starting'|'revising'|'human_review'|'ready'|'blocked'|'cancelled'|'needs_revision';
export interface Delivery {
 id:string;version:number;request:DeliveryRequest;principalId:string;phase:Phase;cycle:number;
 createdAt:string;updatedAt:string;leaseUntil?:number;sessionId?:string;childSessionId?:string;
 operationId:string;deliveryId?:string;publication?:{number:number;url:string;headSha:string;targetHeadSha:string;targetBranch:string;ownerSessionId:string;branch:string};
 review?:{verdict:string;summary:string;headSha:string;baseSha:string;targetBranch:string;findings:Array<{severity:string;path:string;message:string;evidence:string}>;limitations:string[]};
 failedPhase?:Phase;revisionRequests?:Record<string,string>;revisionBrief?:string;error?:string;history:Array<{phase:Phase;at:string;sessionId?:string;headSha?:string}>;
}
export const terminal=(phase:Phase)=>['human_review','ready','blocked','cancelled','needs_revision'].includes(phase);
export function operationFor(id:string,kind:string,cycle:number){const h=createHash('sha256').update(`${id}:${kind}:${cycle}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
export function newDelivery(principalId:string,request:DeliveryRequest):Delivery {
 const id=createHash('sha256').update(`${principalId}:${request.operationId}`).digest('hex');const now=new Date().toISOString();
 return{id,version:1,request,principalId,phase:'worker_starting',cycle:0,createdAt:now,updatedAt:now,operationId:operationFor(id,'worker',0),history:[]};
}
export function transition(state:Delivery,phase:Phase){state.history.push({phase:state.phase,at:new Date().toISOString(),sessionId:state.childSessionId||state.sessionId,headSha:state.publication?.headSha});state.phase=phase;state.updatedAt=new Date().toISOString();state.version++;delete state.leaseUntil;}
// A review is usable only for the host-published candidate and captured target.
export function applyReview(state:Delivery,review:NonNullable<Delivery['review']>){
 const p=state.publication;if(!p||review.headSha!==p.headSha||review.baseSha!==p.targetHeadSha||review.targetBranch!==p.targetBranch)throw new Error('Review is not bound to the published head and target.');
 state.review=review;
 if(review.findings.some(f=>f.severity==='blocking')&&state.cycle<state.request.maxRevisions){
  state.cycle++;state.operationId=operationFor(state.id,'revision',state.cycle);state.revisionBrief=`Original task remains in force. Fix the independent review findings, preserve all original requirements, run checks, and update your existing PR.\n${JSON.stringify(review.findings)}`;transition(state,'revision_starting');
 }else if(review.verdict==='approve'&&!review.limitations.length&&!review.findings.some(f=>f.severity==='blocking'))transition(state,'ready');
 else transition(state,'human_review');
}

export function referenceState(publication:NonNullable<Delivery['publication']>,actual:{state:string;headSha:string;targetBranch:string;targetHeadSha:string}):'current'|'needs_revision'|'blocked' {
 if(actual.state!=="open"||actual.targetBranch!==publication.targetBranch)return 'blocked';
 return actual.headSha===publication.headSha&&actual.targetHeadSha===publication.targetHeadSha?'current':'needs_revision';
}
