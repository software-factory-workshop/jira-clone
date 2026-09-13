import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserComplete,browserOrigin,browserRequirements,type BrowserObservation,visualComparisonComplete,visualObservationComplete} from '../runtime/lib/review-browser.ts';
import {hostReviewLimitations} from '../runtime/lib/review-policy.ts';
const evidence:BrowserObservation={origin:'http://127.0.0.1:3001',headSha:'candidate',sessionId:'reviewer',snapshot:true,interaction:true,keyboard:true,screenshot:true,afterInteraction:true,eventIds:['1','2','3','4','5']};
test('browser evidence must include real interaction, keyboard and observed result for this candidate and session',()=>{
 assert.equal(browserComplete(evidence,'candidate','reviewer'),true);
 for(const field of ['snapshot','interaction','keyboard','screenshot','afterInteraction'] as const)assert.equal(browserComplete({...evidence,[field]:false},'candidate','reviewer'),false);
 assert.equal(browserComplete(evidence,'other-head','reviewer'),false);
 assert.equal(browserComplete(evidence,'candidate','worker'),false);
 assert.equal(browserComplete(undefined,'candidate','reviewer'),false);
});
test('both changed apps need evidence; host missing-browser fallback remains by default',()=>{
 const files=[{filename:'apps/jira/app/pages/index.vue'},{filename:'apps/factory/app/pages/index.vue'}];
 assert.deepEqual(browserRequirements(files),['jira','factory']);
 assert.equal(hostReviewLimitations(files).length,2);
 assert.deepEqual(hostReviewLimitations(files,true),[]);
 assert.deepEqual(browserRequirements([{filename:'docs/check.md'}]),[]);
});
test('visual evidence requires before and after frames for the same route and exact reviewer session',()=>{
 const withFrames:BrowserObservation={...evidence,route:'/issues',frames:{before:{phase:'before',url:'http://127.0.0.1:3001/issues',route:'/issues',dataUrl:'data:image/png;base64,AA==',capturedAt:'2026-09-13T12:00:00.000Z',eventId:'before'},after:{phase:'after',url:'http://127.0.0.1:3001/issues',route:'/issues',dataUrl:'data:image/png;base64,AA==',capturedAt:'2026-09-13T12:01:00.000Z',eventId:'after'}}};
 assert.equal(visualObservationComplete(withFrames,'candidate','reviewer'),true);
 assert.equal(visualObservationComplete({...withFrames,frames:{...withFrames.frames,after:{...withFrames.frames.after!,route:'/board'}}},'candidate','reviewer'),false);
 assert.equal(visualObservationComplete(withFrames,'other-head','reviewer'),false);
});
test('visual comparison binds the before frame to base and after frame to candidate',()=>{
 const baseSha='a'.repeat(40);const headSha='b'.repeat(40);
 const before:BrowserObservation={...evidence,origin:browserOrigin('jira','base'),headSha:baseSha,source:'base',route:'/issues',frames:{before:{phase:'before',source:'base',sourceSha:baseSha,url:'http://127.0.0.1:3101/issues',route:'/issues',dataUrl:'data:image/png;base64,AA==',capturedAt:'2026-09-13T12:00:00.000Z',eventId:'before'}}};
 const after:BrowserObservation={...evidence,origin:browserOrigin('jira','head'),headSha,source:'head',route:'/issues',frames:{after:{phase:'after',source:'head',sourceSha:headSha,url:'http://127.0.0.1:3001/issues',route:'/issues',dataUrl:'data:image/png;base64,AA==',capturedAt:'2026-09-13T12:01:00.000Z',eventId:'after'}}};
 assert.equal(visualComparisonComplete(before,after,baseSha,headSha,'reviewer'),true);
 assert.equal(visualComparisonComplete({...before,headSha:headSha},after,baseSha,headSha,'reviewer'),false);
 assert.equal(visualComparisonComplete(before,{...after,route:'/board',frames:{after:{...after.frames!.after!,route:'/board'}}},baseSha,headSha,'reviewer'),false);
 assert.equal(visualComparisonComplete({...before,frames:{before:{...before.frames!.before!,sourceSha:headSha}}},after,baseSha,headSha,'reviewer'),false);
});
