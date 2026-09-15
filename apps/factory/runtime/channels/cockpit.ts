import { factorySession } from "../lib/root-agent-client";
import { createHash } from 'node:crypto';
import { defineChannel, GET, POST, PUT, DELETE } from 'eve/channels';
import { routeAuth } from 'eve/channels/auth';
import { z } from 'zod';
import { repository,references,stages,starterRequests } from '@jira-clone/context';
import { factoryAuth } from '../lib/route-auth';
import { readCockpit,updateCockpit } from '../lib/cockpit-store';
import { collections,idSchema,changeRecord,importRecords,CockpitConflict,workOrderAdmissionSchema } from '../../shared/cockpit';
import { readRun,readStationRun } from '../lib/cockpit-run';
import { proposalDraft } from '../../app/utils/mining-output';
import { readVisualFrame } from '../lib/visual-review-store';
const collectionSchema=z.enum(collections);
// Shared records (drafts, feedback, run references) are versioned. Every write
// carries expectedVersion; a stale writer gets 409 and must reload. Import
// never replaces an existing record and remembers imported IDs, so deleted
// browser-era items cannot reappear.
const mutation=z.object({value:z.unknown(),expectedVersion:z.number().int().nonnegative()}).strict();
async function authorized(request:Request,work:()=>Promise<unknown>) {
 const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)return auth;
 try{return Response.json(await work(),{headers:{'cache-control':'no-store'}});}
 catch(error){const status=error instanceof CockpitConflict?409:error instanceof z.ZodError?400:503;return Response.json({error:{code:status===409?'conflict':status===400?'invalid_request':'unavailable',message:status===503?'Cockpit data is unavailable. Retry without discarding your work.':error instanceof Error?error.message:'Invalid request'}},{status});}
}
export default defineChannel({routes:[
 GET('/factory/review-artifacts/:artifactId/:token',async(request,{params})=>{
  try{
   const image=await readVisualFrame(params.artifactId,params.token,new URL(request.url).searchParams.get('phase')||'');
   if(!image)return new Response('Visual frame not found',{status:404});
   return new Response(image.stream,{status:200,headers:{'cache-control':'private, max-age=31536000, immutable','content-type':image.mediaType,'x-content-type-options':'nosniff','etag':image.sha256}});
  }catch{return new Response('Visual frame not found',{status:404});}
 }),
 GET('/factory/cockpit',request=>authorized(request,async()=>({version:1,repository,references,stages,starterRequests,sections:['mining','work'],capabilities:{collections:'/factory/cockpit/records/:collection',import:'/factory/cockpit/import',respond:'/eve/v1/session/:id',reset:'/eve/v1/session/:id/reset',delivery:'/factory/delivery',record:'/factory/cockpit/records/:collection/:id',activate:'/factory/cockpit/activate',approve:'/factory/cockpit/approve',issueLink:'/factory/cockpit/issue-link',runResult:'/factory/cockpit/run/:id',worker:'/factory/stations/worker',reviewer:'/factory/stations/reviewer',revision:'/factory/stations/revisions',mining:'/eve/v1/session',stream:'/eve/v1/session/:id/stream',send:'/eve/v1/session/:id',cancel:'/eve/v1/session/:id/cancel'}}))),
 POST('/factory/cockpit/import',request=>authorized(request,async()=>{const body=z.object({collection:collectionSchema,items:z.array(z.object({id:idSchema,value:z.unknown()}).strict()).max(1000)}).strict().parse(await request.json());return {items:await updateCockpit(doc=>importRecords(doc,body.collection,body.items))};})),
 POST('/factory/cockpit/records/:collection',(request,{params})=>authorized(request,async()=>{const body=z.object({id:idSchema,value:z.unknown()}).strict().parse(await request.json());return {item:await updateCockpit(doc=>changeRecord(doc,collectionSchema.parse(params.collection),body.id,body.value,0))};})),
 GET('/factory/cockpit/records/:collection',(request,{params})=>authorized(request,async()=>{const collection=collectionSchema.parse(params.collection);return {items:Object.values((await readCockpit()).document[collection]).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))};})),
 GET('/factory/cockpit/records/:collection/:id',(request,{params})=>authorized(request,async()=>({item:(await readCockpit()).document[collectionSchema.parse(params.collection)][idSchema.parse(params.id)]??null}))),
 PUT('/factory/cockpit/records/:collection/:id',(request,{params})=>authorized(request,async()=>{const body=mutation.parse(await request.json());return {item:await updateCockpit(doc=>changeRecord(doc,collectionSchema.parse(params.collection),idSchema.parse(params.id),body.value,body.expectedVersion))};})),
 DELETE('/factory/cockpit/records/:collection/:id',(request,{params})=>authorized(request,async()=>{const body=z.object({expectedVersion:z.number().int().positive()}).strict().parse(await request.json());return {item:await updateCockpit(doc=>changeRecord(doc,collectionSchema.parse(params.collection),idSchema.parse(params.id),null,body.expectedVersion))};})),
 POST('/factory/cockpit/issue-link',request=>authorized(request,async()=>{const body=z.object({title:z.string().max(200),request:z.string().max(40000)}).strict().parse(await request.json());return {url:`${repository.url}/issues/new?title=${encodeURIComponent(body.title)}&body=${encodeURIComponent(body.request)}`};})),
 GET('/factory/cockpit/run/:id',(request,{params,attachSession})=>authorized(request,async()=>readStationRun(id=>factorySession(id,attachSession),z.string().regex(/^wrun_[\w-]+$/).parse(params.id),z.object({operationId:z.string().uuid().optional(),deliveryId:z.string().max(200).optional()}).parse(Object.fromEntries(new URL(request.url).searchParams))))),
 POST('/factory/cockpit/activate',(request,{attachSession})=>authorized(request,async()=>{
  const body=z.object({sessionId:z.string().regex(/^wrun_[\w-]+$/),proposalId:z.string().optional()}).strict().parse(await request.json());
  const projected=await readRun(await factorySession(body.sessionId,attachSession));const result=projected.result;
  if(!projected.complete||result?.kind!=='mining'||!result.output?.report)throw new z.ZodError([{code:'custom',path:[],message:'No recorded findings are available.'}]);
  const output=result.output;let draft;
  if(body.proposalId){const index=output.proposals?.findIndex(p=>p.id===body.proposalId)??-1;if(index<0)throw new z.ZodError([{code:'custom',path:[],message:'Proposal not found in this run.'}]);draft=proposalDraft({proposal:output.proposals![index]!,index,sessionId:body.sessionId,revision:output.revision,capturedAt:output.capturedAt,phase:output.phase,contextGaps:output.contextGaps,admission:output.admission});}
  else draft={title:'Review task-mining proposals',body:output.report+`\n\nInvestigation: ${body.sessionId}\nSource revision: ${output.revision}\nThese are proposals for human review, not approved work.`,...(output.admission ? {admission:output.admission} : {})};
  const id='proposal-'+createHash('sha256').update(body.sessionId+':'+(body.proposalId??'report')).digest('hex').slice(0,32);
  return {item:await updateCockpit(doc=>doc.drafts[id]??changeRecord(doc,'drafts',id,{title:draft.title,request:draft.body,origin:'task-mining',...(draft.admission ? {admission:draft.admission} : {})},0))};
 })),
 POST('/factory/cockpit/approve',(request,{attachSession})=>authorized(request,async()=>{
  const body=z.object({sessionId:z.string().regex(/^wrun_[\w-]+$/),draftId:idSchema,expectedVersion:z.number().int().positive()}).strict().parse(await request.json());
  const projected=await readRun(await factorySession(body.sessionId,attachSession));const result=projected.result;
  const admission=workOrderAdmissionSchema.safeParse(result?.kind==='mining'?result.output?.admission:undefined);
  if(!projected.complete||result?.kind!=='mining'||!result.output?.report||!admission.success||admission.data.kind!=='work_order')throw new z.ZodError([{code:'custom',path:[],message:'This investigation did not admit a work order.'}]);
  return {item:await updateCockpit(doc=>{
   const binding=doc.runs[body.sessionId];const draft=doc.drafts[body.draftId];
   if(binding?.value.station!=='mining'||binding.value.draftId!==body.draftId)throw new z.ZodError([{code:'custom',path:['draftId'],message:'This investigation is not bound to that work order.'}]);
   if(!draft)throw new z.ZodError([{code:'custom',path:['draftId'],message:'The saved work order does not exist.'}]);
   if(draft.value.admissionSessionId===body.sessionId&&JSON.stringify(draft.value.admission)===JSON.stringify(admission.data))return draft;
   return changeRecord(doc,'drafts',body.draftId,{title:draft.value.title,request:draft.value.request,origin:'task-mining',admission:admission.data,admissionSessionId:body.sessionId},body.expectedVersion);
  })};
 })),
]});
