import {defineTool} from 'eve/tools';
import {z} from 'zod';
import {workState} from '../../../lib/work-state';
import {requireStation} from '../../../lib/station-access';
import {collectChanges} from '../../../lib/work-changes';
import {reviewBrowser,browserRequirements} from '../../../lib/review-browser';
export default defineTool({description:'Start a local browser target from the unchanged pinned candidate. Use before browser extension tools; does not claim that browser acceptance checks passed.',inputSchema:z.object({app:z.enum(['jira','factory'])}),
 async execute({app},ctx){
  requireStation(ctx,'reviewer');const state=workState.get();if(!state.prepared||!state.pull)throw new Error('Prepare the exact PR first.');
  if(!browserRequirements(state.pull.files).includes(app))throw new Error('This app has no changed browser source in the review.');
  const sandbox=await ctx.getSandbox();if((await collectChanges(sandbox,state.baseline,true,state.jiraManifest)).length)throw new Error('Candidate changed; browser verification requires the unchanged reviewed source.');
  const origin=`http://127.0.0.1:${app==='jira'?3001:3000}`;
  if(!reviewBrowser.get().targets[origin]){
   await sandbox.spawn({command:`export PATH="$HOME/.local/bin:$PATH"; cd /workspace/repo/apps/${app}; pnpm exec nuxt dev --host 127.0.0.1 --port ${app==='jira'?3001:3000}`});
   reviewBrowser.update(s=>({...s,targets:{...s.targets,[origin]:state.pull!.headSha}}));
  }
  return{origin,headSha:state.pull.headSha,sessionId:ctx.session.id,instructions:'Wait for the local server with browser tools. Exercise the changed acceptance criteria, take snapshots before and after interactions, use keyboard navigation and activation, inspect focus, and capture a screenshot. Report actual failures or missing coverage; tool use alone is not a passing assessment.'};
 }
});
