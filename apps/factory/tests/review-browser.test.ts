import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserComplete,browserRequirements,type BrowserObservation} from '../runtime/lib/review-browser.ts';
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
