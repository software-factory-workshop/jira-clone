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
