import { createHash } from 'node:crypto';
import { defineChannel, GET, POST, PUT, DELETE } from 'eve/channels';
import { routeAuth } from 'eve/channels/auth';
import { z } from 'zod';
import { repository,references,stages,starterRequests } from '@jira-clone/context';
import { factoryAuth } from '../lib/route-auth';
import { readCockpit,updateCockpit } from '../lib/cockpit-store';
import { collections,idSchema,changeRecord,importRecords,CockpitConflict } from '../../shared/cockpit';
import { readRun,readStationRun } from '../lib/cockpit-run';
import { proposalDraft } from '../../app/utils/mining-output';
const collectionSchema=z.enum(collections);
const mutation=z.object({value:z.unknown(),expectedVersion:z.number().int().nonnegative()}).strict();
async function authorized(request:Request,work:()=>Promise<unknown>) {
 const auth=await routeAuth(request,factoryAuth);if(auth instanceof Response)return auth;
 try{return Response.json(await work(),{headers:{'cache-control':'no-store'}});}
 catch(error){const status=error instanceof CockpitConflict?409:error instanceof z.ZodError?400:503;return Response.json({error:{code:status===409?'conflict':status===400?'invalid_request':'unavailable',message:status===503?'Cockpit data is unavailable. Retry without discarding your work.':error instanceof Error?error.message:'Invalid request'}},{status});}
}
export default defineChannel({routes:[
 GET('/factory/cockpit',request=>authorized(request,async()=>({version:1,repository,references,stages,starterRequests,sections:['mining','work','knowledge','growth'],capabilities:{collections:'/factory/cockpit/:collection',import:'/factory/cockpit/import',respond:'/eve/v1/session/:id',reset:'/eve/v1/session/:id/reset',delivery:'/factory/delivery',record:'/factory/cockpit/:collection/:id',activate:'/factory/cockpit/activate',issueLink:'/factory/cockpit/issue-link',runResult:'/factory/cockpit/run/:id',worker:'/factory/stations/worker',reviewer:'/factory/stations/reviewer',revision:'/factory/stations/revisions',mining:'/eve/v1/session',stream:'/eve/v1/session/:id/stream',send:'/eve/v1/session/:id',cancel:'/eve/v1/session/:id/cancel'}}))),
 POST('/factory/cockpit/import',request=>authorized(request,async()=>{const body=z.object({collection:collectionSchema,items:z.array(z.object({id:idSchema,value:z.unknown()}).strict()).max(1000)}).strict().parse(await request.json());return {items:await updateCockpit(doc=>importRecords(doc,body.collection,body.items))};})),
 POST('/factory/cockpit/:collection',(request,{params})=>authorized(request,async()=>{const body=z.object({id:idSchema,value:z.unknown()}).strict().parse(await request.json());return {item:await updateCockpit(doc=>changeRecord(doc,collectionSchema.parse(params.collection),body.id,body.value,0))};})),
 GET('/factory/cockpit/:collection',(request,{params})=>authorized(request,async()=>{const collection=collectionSchema.parse(params.collection);return {items:Object.values((await readCockpit()).document[collection]).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))};})),
 GET('/factory/cockpit/:collection/:id',(request,{params})=>authorized(request,async()=>({item:(await readCockpit()).document[collectionSchema.parse(params.collection)][idSchema.parse(params.id)]??null}))),
 PUT('/factory/cockpit/:collection/:id',(request,{params})=>authorized(request,async()=>{const body=mutation.parse(await request.json());return {item:await updateCockpit(doc=>changeRecord(doc,collectionSchema.parse(params.collection),idSchema.parse(params.id),body.value,body.expectedVersion))};})),
 DELETE('/factory/cockpit/:collection/:id',(request,{params})=>authorized(request,async()=>{const body=z.object({expectedVersion:z.number().int().positive()}).strict().parse(await request.json());return {item:await updateCockpit(doc=>changeRecord(doc,collectionSchema.parse(params.collection),idSchema.parse(params.id),null,body.expectedVersion))};})),
 POST('/factory/cockpit/issue-link',request=>authorized(request,async()=>{const body=z.object({title:z.string().max(200),request:z.string().max(40000)}).strict().parse(await request.json());return {url:`${repository.url}/issues/new?title=${encodeURIComponent(body.title)}&body=${encodeURIComponent(body.request)}`};})),
 GET('/factory/cockpit/run/:id',(request,{params,attachSession})=>authorized(request,async()=>readStationRun(attachSession,z.string().regex(/^wrun_[\w-]+$/).parse(params.id),z.object({operationId:z.string().uuid().optional(),deliveryId:z.string().max(200).optional()}).parse(Object.fromEntries(new URL(request.url).searchParams))))),
 POST('/factory/cockpit/activate',(request,{attachSession})=>authorized(request,async()=>{
  const body=z.object({sessionId:z.string().regex(/^wrun_[\w-]+$/),proposalId:z.string().optional()}).strict().parse(await request.json());
  const projected=await readRun(attachSession(body.sessionId));const result=projected.result;
  if(!projected.complete||result?.kind!=='mining'||!result.output?.report)throw new z.ZodError([{code:'custom',path:[],message:'No recorded findings are available.'}]);
  const output=result.output;let draft;
  if(body.proposalId){const index=output.proposals?.findIndex(p=>p.id===body.proposalId)??-1;if(index<0)throw new z.ZodError([{code:'custom',path:[],message:'Proposal not found in this run.'}]);draft=proposalDraft({proposal:output.proposals![index]!,index,sessionId:body.sessionId,revision:output.revision,capturedAt:output.capturedAt,phase:output.phase,contextGaps:output.contextGaps});}
  else draft={title:'Review task-mining proposals',body:output.report+`\n\nInvestigation: ${body.sessionId}\nSource revision: ${output.revision}\nThese are proposals for human review, not approved work.`};
  const id='proposal-'+createHash('sha256').update(body.sessionId+':'+(body.proposalId??'report')).digest('hex').slice(0,32);
  return {item:await updateCockpit(doc=>doc.drafts[id]??changeRecord(doc,'drafts',id,{title:draft.title,request:draft.body},0))};
 })),
]});
