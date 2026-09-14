import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lowRiskFiles,mergeEligibility,type MergeReview} from '../runtime/lib/merge-policy.ts';
import {hostReviewLimitations} from '../runtime/lib/review-policy.ts';
import { factoryRepository, requiredCheckName } from '../runtime/lib/factory-config.ts';
const doc={filename:'apps/jira/app/assets/colors.css',status:'modified',patch:'@@ -1,3 +1,3 @@\n .card {\n-color: red;\n+color: blue;\n }'};
const review:MergeReview={headSha:'a'.repeat(40),baseSha:'b'.repeat(40),targetBranch:'main',verdict:'approve',findings:[],limitations:[],verification:{prepared:true,repositoryChecksPassed:true,candidateUnchanged:true}};
const input={files:[doc],review,headSha:review.headSha,baseSha:review.baseSha,targetBranch:'main',workerSessionId:'worker',reviewerSessionId:'reviewer'};
test('prose docs are never low risk; protected instructions, runtime, tests, APIs and renames are not',()=>{
 assert.equal(mergeEligibility(input),null);
 for(const filename of ['docs/user-guide.md','docs/AGENTS.md','docs/security.md','.agents/foo.md','factory/CONTRACT.md','apps/factory/runtime/lib/a.ts','apps/jira/server/api/a.ts','apps/jira/tests/a.test.ts','apps/jira/package.json'])assert.equal(lowRiskFiles([{...doc,filename}]),false,filename);
 assert.equal(lowRiskFiles([{...doc,previous_filename:'AGENTS.md'}]),false);
});
test('cosmetic CSS has narrow declaration-level scope, browser absence remains explicit',()=>{
 const css={filename:'apps/jira/app/assets/colors.css',status:'modified',patch:'@@ -1,3 +1,3 @@\n .card {\n-color: red;\n+color: blue;\n }'};
 assert.equal(lowRiskFiles([css]),true);
 assert.equal(mergeEligibility({...input,files:[css],review:{...review,verdict:'incomplete',limitations:hostReviewLimitations([css])}}),null);
 for(const patch of ['+display: none;','+opacity: 0;','+.new-selector {','+color: url(https://evil);'])assert.equal(lowRiskFiles([{...css,patch}]),false);
});
test('missing independent checks, unknown gaps, blockers and stale bindings remain manual',()=>{
 for(const change of [{verification:undefined},{verification:{prepared:true,repositoryChecksPassed:false,candidateUnchanged:true}},{verification:{prepared:true,repositoryChecksPassed:true,candidateUnchanged:false}},{headSha:'c'.repeat(40)},{baseSha:'c'.repeat(40)},{limitations:['Could not inspect source']},{findings:[{severity:'blocking'}]}])assert.equal(mergeEligibility({...input,review:{...review,...change}})?.status,'manual');
 assert.equal(mergeEligibility({...input,reviewerSessionId:'worker'})?.status,'manual');
 assert.equal(mergeEligibility({...input,targetBranch:'child'})?.status,'manual');
});

test('GitHub merge checks reject stale heads and pending checks, bind successful mutation to reviewed SHA',async()=>{
 const {mergeReviewed}=await import('../runtime/lib/merge-reviewed.ts');
 const prior=globalThis.fetch;
 const publication={number:42,headSha:review.headSha,targetHeadSha:review.baseSha,targetBranch:'main',ownerSessionId:'worker'};
 let stale=false,pending=false,merges=0;let requiredConclusion='success';let optionalConclusion='neutral';let optionalStatus='completed';
 globalThis.fetch=async(url,init)=>{
  const path=String(url);
  let data:unknown;
  if(path.endsWith('/merge')){
   assert.equal(JSON.parse(String(init?.body)).sha,review.headSha);merges++;data={merged:true,sha:'d'.repeat(40)};
  }else if(path.includes('/files?'))data=[doc];
  else if(path.includes('/check-runs?'))data={total_count:2,check_runs:[{name:requiredCheckName,app:{slug:'github-actions'},status:pending?'in_progress':'completed',conclusion:pending?null:requiredConclusion},{name:'Vercel Agent Review',app:{slug:'vercel'},status:optionalStatus,conclusion:optionalConclusion}]};
  else if(path.includes('/status?'))data={total_count:0,statuses:[]};
  else data={state:'open',head:{sha:stale?'c'.repeat(40):review.headSha,repo:{full_name:factoryRepository}},base:{sha:review.baseSha,ref:'main',repo:{full_name:factoryRepository}},changed_files:1,draft:false,mergeable:true,mergeable_state:'clean'};
  return Response.json(data);
 };
 try{
  stale=true;assert.equal((await mergeReviewed({publication,review,reviewerSessionId:'reviewer'},'test-token')).status,'manual');assert.equal(merges,0);
  stale=false;pending=true;assert.equal((await mergeReviewed({publication,review,reviewerSessionId:'reviewer'},'test-token')).status,'waiting');assert.equal(merges,0);
  pending=false;
  for(const conclusion of ['failure','neutral','skipped']){
   requiredConclusion=conclusion;assert.equal((await mergeReviewed({publication,review,reviewerSessionId:'reviewer'},'test-token')).status,'manual',`required check ${conclusion}`);assert.equal(merges,0);
  }
  requiredConclusion='success';
  for(const conclusion of ['failure','cancelled','timed_out']){
   optionalConclusion=conclusion;assert.equal((await mergeReviewed({publication,review,reviewerSessionId:'reviewer'},'test-token')).status,'manual',`optional check ${conclusion}`);assert.equal(merges,0);
  }
  optionalStatus='in_progress';optionalConclusion='neutral';assert.equal((await mergeReviewed({publication,review,reviewerSessionId:'reviewer'},'test-token')).status,'waiting');assert.equal(merges,0);
  optionalStatus='completed';
  for(const conclusion of ['neutral','skipped']){
   optionalConclusion=conclusion;assert.equal((await mergeReviewed({publication,review,reviewerSessionId:'reviewer'},'test-token')).status,'merged',`optional check ${conclusion}`);
  }
  assert.equal(merges,2);
 }finally{globalThis.fetch=prior;}
});
