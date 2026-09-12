import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDocument,changeRecord,importRecords,CockpitConflict } from '../shared/cockpit.ts';
const draft={title:'Issue priority',request:'Build a fake save API'};
test('stale writers cannot replace another user edit',()=>{
 const doc=emptyDocument();changeRecord(doc,'drafts','one',draft,0);
 changeRecord(doc,'drafts','one',{...draft,title:'Updated'},1);
 assert.throws(()=>changeRecord(doc,'drafts','one',{...draft,title:'Stale'},1),CockpitConflict);
 assert.equal(doc.drafts.one!.value.title,'Updated');
});
test('migration preserves shared edits and cannot resurrect cleared feedback',()=>{
 const doc=emptyDocument();changeRecord(doc,'drafts','one',{...draft,title:'Shared'},0);
 importRecords(doc,'drafts',[{id:'one',value:draft}]);assert.equal(doc.drafts.one!.value.title,'Shared');
 const legacy=[{id:'proposal:1',value:{verdict:'useful',reason:'Old'}}];
 importRecords(doc,'feedback',legacy);changeRecord(doc,'feedback','proposal:1',null,1);
 importRecords(doc,'feedback',legacy);assert.equal(doc.feedback['proposal:1'],undefined);
});
test('validation rejects arbitrary paths and oversized records',()=>{
 const doc=emptyDocument();assert.throws(()=>changeRecord(doc,'drafts','../secret',draft,0));
 assert.throws(()=>changeRecord(doc,'drafts','one',{...draft,request:'x'.repeat(40001)},0));
 assert.throws(()=>changeRecord(doc,'drafts','one',{...draft,provenance:'invented'},0));
});
test('unrelated record edits preserve both records',()=>{
 const doc=emptyDocument();changeRecord(doc,'drafts','one',draft,0);changeRecord(doc,'drafts','two',draft,0);
 changeRecord(doc,'drafts','one',{...draft,title:'First'},1);changeRecord(doc,'drafts','two',{...draft,title:'Second'},1);
 assert.equal(doc.drafts.one!.value.title,'First');assert.equal(doc.drafts.two!.value.title,'Second');
});
test('deleting and recreating a record cannot revive a stale writer version',()=>{
 const doc=emptyDocument();changeRecord(doc,'drafts','one',draft,0);changeRecord(doc,'drafts','one',null,1);
 const recreated=changeRecord(doc,'drafts','one',{...draft,title:'Recreated'},0)!;
 assert.equal(recreated.version,3);assert.throws(()=>changeRecord(doc,'drafts','one',draft,1),CockpitConflict);
});
test('CAS retry recomputes against newest document without losing another record',async()=>{
 const {mutateCockpit}=await import('../runtime/lib/cockpit-store.ts');
 let actual=emptyDocument();let revision=0;let writes=0;
 const storage={read:async()=>({document:structuredClone(actual),etag:String(revision)}),write:async(doc:typeof actual,etag:string|undefined)=>{
  writes++;if(writes===1){changeRecord(actual,'drafts','other',{...draft,title:'Concurrent'},0);revision++;return false;}
  if(etag!==String(revision))return false;actual=structuredClone(doc);revision++;return true;
 }};
 await mutateCockpit(storage,doc=>changeRecord(doc,'drafts','one',draft,0));
 assert.equal(writes,2);assert.equal(actual.drafts.other!.value.title,'Concurrent');assert.equal(actual.drafts.one!.value.title,draft.title);
});
test('storage failures propagate without changing an accepted record',async()=>{
 const {mutateCockpit}=await import('../runtime/lib/cockpit-store.ts');const actual=emptyDocument();
 await assert.rejects(mutateCockpit({read:async()=>({document:structuredClone(actual),etag:undefined}),write:async()=>{throw Error('outage');}},doc=>changeRecord(doc,'drafts','one',draft,0)),/outage/);
 assert.equal(actual.drafts.one,undefined);
});

test('both durable stores request identity encoding for strong conditional-write ETags',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const file of ['cockpit-store.ts','delivery-store.ts']){
  const source=await readFile(new URL('../runtime/lib/'+file,import.meta.url),'utf8');
  assert.match(source,/'accept-encoding':'identity'/);assert.match(source,/etag\.startsWith\('W\/'\)/);
 }
});
