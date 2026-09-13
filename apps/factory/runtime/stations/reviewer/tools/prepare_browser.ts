import {defineTool} from 'eve/tools';
import {useLogger} from 'evlog/eve';
import {z} from 'zod';
import {workState} from '../../../lib/work-state';
import {requireStation} from '../../../lib/station-access';
import {collectChanges} from '../../../lib/work-changes';
import {reviewBrowser,browserRequirements} from '../../../lib/review-browser';
export default defineTool({description:'Start a local browser target from the unchanged pinned candidate. Use before browser extension tools; does not claim that browser acceptance checks passed.',inputSchema:z.object({app:z.enum(['jira','factory'])}),
 async execute({app},ctx){
  requireStation(ctx,'reviewer');const log=useLogger(ctx);const state=workState.get();if(!state.prepared||!state.pull)throw new Error('Prepare the exact PR first.');
  if(!browserRequirements(state.pull.files).includes(app))throw new Error('This app has no changed browser source in the review.');
  const sandbox=await ctx.getSandbox();if((await collectChanges(sandbox,state.baseline,true,state.jiraManifest,state.jiraNuxtConfig,state.jiraLockfile)).length)throw new Error('Candidate changed; browser verification requires the unchanged reviewed source.');
  const origin=`http://127.0.0.1:${app==='jira'?3001:3000}`;
  if(!reviewBrowser.get().targets[origin]){
   await sandbox.spawn({command:`export PATH="$HOME/.local/bin:$PATH"; cd /workspace/repo/apps/${app}; pnpm exec nuxt dev --host 127.0.0.1 --port ${app==='jira'?3001:3000}`});
   reviewBrowser.update(s=>({...s,targets:{...s.targets,[origin]:state.pull!.headSha}}));
  }
  log.set({factory:{station:"reviewer",stage:"prepare_browser",outcome:"ready",app,port:app==='jira'?3001:3000,headSha:state.pull.headSha}});
  return{origin,headSha:state.pull.headSha,sessionId:ctx.session.id,instructions:'Wait for the local server with browser tools. On one review route, take a before screenshot, take an accessibility snapshot, exercise the changed acceptance criteria, navigate and activate controls with the keyboard, inspect visible focus, take a snapshot after the interaction, and take an after screenshot on that same route. The host records the frames and publishes a visual before/after packet into the PR when storage is available. Report actual failures or missing coverage; this visual packet is supplementary evidence and tool use alone is not a passing assessment.'};
 }
});
