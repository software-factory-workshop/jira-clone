import { z } from 'zod';
import { visualReviewPacketSchema } from '../runtime/lib/visual-review.ts';
export const idSchema = z.string().min(1).max(240).regex(/^[\w:.-]+$/);
const admissionText = z.string().trim().min(1).max(4000);
const admissionList = z.array(admissionText).min(1).max(20);
export const workOrderAdmissionSchema = z.discriminatedUnion('kind', [
 z.object({kind:z.literal('work_order'),outcome:admissionText,scope:admissionList,evidence:admissionList,verification:admissionList}).strict(),
 z.object({kind:z.literal('clarification'),questions:admissionList,blockingDecision:admissionText}).strict(),
 z.object({kind:z.literal('unsupported'),reason:admissionText,evidence:admissionList}).strict(),
]);
export type WorkOrderAdmission = z.infer<typeof workOrderAdmissionSchema>;
export const draftOriginSchema = z.enum(['operator', 'task-mining']);
export type DraftOrigin = z.infer<typeof draftOriginSchema>;
export const draftInput = z.object({ title: z.string().trim().min(1).max(200), request: z.string().trim().min(1).max(40000), origin: draftOriginSchema.optional(), admission: workOrderAdmissionSchema.optional() }).strict();

// Delivery may start from either an evidence-backed task-mining work order or
// an explicit operator idea. An unmarked draft is never treated as executable,
// which keeps legacy and malformed records from silently bypassing admission.
export function deliveryEntryPoint(value: Record<string, unknown>): 'task-mining' | 'operator' | undefined {
 const admission = workOrderAdmissionSchema.safeParse(value.admission);
 if (admission.success && admission.data.kind === 'work_order') return 'task-mining';
 if (value.origin === 'operator' && value.admission === undefined) return 'operator';
 return undefined;
}
export const feedbackInput = z.object({ verdict: z.enum(['useful','not-useful']), reason: z.string().max(500) }).strict();
const reviewFallback = z.object({ station:z.literal('reviewer'), sessionId:z.string().min(1).max(240), prNumber:z.number().int().positive(), url:z.string().url(), baseSha:z.string().regex(/^[a-f0-9]{40}$/), headSha:z.string().regex(/^[a-f0-9]{40}$/), targetBranch:z.string().min(1).max(240), verdict:z.literal('incomplete'), summary:z.string().min(1).max(3000), findings:z.array(z.object({severity:z.enum(['blocking','nonblocking']),path:z.string(),message:z.string(),evidence:z.string()})).max(15), limitations:z.array(z.string()).max(20), visualReview:visualReviewPacketSchema, commands:z.array(z.unknown()).max(100), browserEvidence:z.object({complete:z.literal(false),observations:z.array(z.unknown()).max(4)}), capturedAt:z.string().min(1).max(100) }).strict();
export const runInput = z.object({ label: z.string().max(200), station: z.enum(['mining','worker','reviewer','loop']), operationId: z.string().max(240).optional(), execution: z.enum(['owner','dispatcher','direct']).optional(), rootAgent:z.enum(['task-miner','worker','reviewer']).optional(), deliveryId: z.string().optional(), reviewFallback: reviewFallback.optional() }).strict();
export const recordSchema = z.object({ id: idSchema, version: z.number().int().positive(), updatedAt: z.string(), createdAt: z.string(), value: z.record(z.string(), z.unknown()) });
export type CockpitRecord = z.infer<typeof recordSchema>;
export const collections = ['drafts','feedback','runs'] as const;
export type Collection = typeof collections[number];
export const documentSchema = z.object({ schemaVersion: z.literal(1), imported: z.array(z.string()).default([]), versions: z.record(z.string(),z.number().int().nonnegative()).default({}), drafts: z.record(z.string(),recordSchema), feedback: z.record(z.string(),recordSchema), runs: z.record(z.string(),recordSchema) });
export type CockpitDocument = z.infer<typeof documentSchema>;
export function emptyDocument(): CockpitDocument { return {schemaVersion:1,imported:[],versions:{},drafts:{},feedback:{},runs:{}}; }
export function parseValue(collection:Collection, value:unknown) { return ({drafts:draftInput,feedback:feedbackInput,runs:runInput}[collection]).parse(value); }
export class CockpitConflict extends Error {}
export function changeRecord(doc:CockpitDocument, collection:Collection, id:string, value:unknown|null, expectedVersion:number, now=new Date().toISOString()): CockpitRecord | null {
 idSchema.parse(id); const previous=doc[collection][id];
 if((previous?.version??0)!==expectedVersion)throw new CockpitConflict('This item changed. Reload before saving; your edit has not been discarded.');
 const key=collection+':'+id;const version=Math.max(doc.versions[key]??0,previous?.version??0)+1;
 doc.versions[key]=version;
 if(value===null){delete doc[collection][id];return null;}
 const next={id,version,createdAt:previous?.createdAt??now,updatedAt:now,value:parseValue(collection,value)};
 doc[collection][id]=next;return next;
}

export function importRecords(doc:CockpitDocument,collection:Collection,records:Array<{id:string;value:unknown}>) {
 for(const record of records){const key=collection+':'+idSchema.parse(record.id);if(doc.imported.includes(key))continue;
  if(!doc[collection][record.id])changeRecord(doc,collection,record.id,record.value,0);
  doc.imported.push(key);
 }
 return Object.values(doc[collection]);
}
