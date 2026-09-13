import {defineTool} from 'eve/tools';
import {useLogger} from 'evlog/eve';
import {z} from 'zod';
import {workState} from '../../../lib/work-state';
import {requireStation} from '../../../lib/station-access';
import {collectChanges} from '../../../lib/work-changes';
import {browserOrigin,browserRequirements,reviewBrowser,type BrowserReviewApp,type BrowserReviewSource} from '../../../lib/review-browser';

function shellQuote(value:string){return `'${value.replaceAll("'","'\\''")}'`;}
function safeRelativePath(value:string){if(!value||value.startsWith('/')||value.split('/').includes('..'))throw new Error('The PR contains an unsafe browser source path.');return value;}
function parentPath(value:string){const index=value.lastIndexOf('/');return index>0?value.slice(0,index):'.';}
function baseWorkspaceCommand(files:Array<{filename:string;previous_filename?:string;status:string}>){
 const overlays=files.map(file=>{
  const filename=safeRelativePath(file.filename);const source=file.status==='renamed'&&file.previous_filename?safeRelativePath(file.previous_filename):filename;
  const candidate=`/workspace/review-base/${filename}`;const base=`/workspace/base/${source}`;const target=`/workspace/review-base/${source}`;
  return `${source===filename?'':`rm -f ${shellQuote(candidate)}\n`}if [ -f ${shellQuote(base)} ]; then mkdir -p ${shellQuote(`/workspace/review-base/${parentPath(source)}`)}; cp -p ${shellQuote(base)} ${shellQuote(target)}; else rm -f ${shellQuote(target)}; fi`;
 }).join('\n');
 return `set -eu
rm -rf /workspace/review-base
mkdir -p /workspace/review-base
tar -C /workspace/repo --exclude='node_modules' --exclude='*/node_modules' --exclude='.nuxt' --exclude='*/.nuxt' --exclude='.output' --exclude='*/.output' --exclude='.eve' --exclude='*/.eve' -cf - . | tar -C /workspace/review-base -xf -
${overlays}
export PATH="$HOME/.local/bin:$PATH"
cd /workspace/review-base
pnpm install --frozen-lockfile`;
}

async function ensureBaseWorkspace(sandbox:{run(input:{command:string}):PromiseLike<{exitCode:number;stdout:string;stderr:string}>},state:NonNullable<ReturnType<typeof workState.get>>){
 const current=reviewBrowser.get().baseWorkspaceSha;
 if(current&&current!==state.pull!.baseSha)throw new Error('The browser base is already bound to another PR base. Start a fresh reviewer session.');
 if(current)return;
 const result=await sandbox.run({command:baseWorkspaceCommand(state.pull!.files)});
 if(result.exitCode!==0)throw new Error(`Could not prepare the PR base browser: ${(result.stderr||result.stdout).trim().slice(-700)}`);
 reviewBrowser.update(s=>({...s,baseWorkspaceSha:state.pull!.baseSha}));
}

async function ensureServer(sandbox:{spawn(input:{command:string}):PromiseLike<unknown>},app:BrowserReviewApp,source:BrowserReviewSource,sha:string){
 const origin=browserOrigin(app,source);const existing=reviewBrowser.get().targets[origin];
 if(existing&&existing!==sha)throw new Error(`The ${source} browser target is already bound to another revision.`);
 if(!existing){const port=Number(new URL(origin).port);const root=source==='base'?'/workspace/review-base':'/workspace/repo';await sandbox.spawn({command:`export PATH="$HOME/.local/bin:$PATH"; cd ${root}/apps/${app}; pnpm exec nuxt dev --host 127.0.0.1 --port ${port}`});}
 reviewBrowser.update(s=>({...s,targets:{...s.targets,[origin]:sha},sources:{...(s.sources||{}),[origin]:source}}));
}

export default defineTool({description:'Start base and candidate local browser targets for an unchanged exact PR review. The base target supplies the before design and the candidate target supplies the after design; this does not claim that browser acceptance checks passed.',inputSchema:z.object({app:z.enum(['jira','factory'])}),
 async execute({app},ctx){
  requireStation(ctx,'reviewer');const log=useLogger(ctx);const state=workState.get();if(!state.prepared||!state.pull)throw new Error('Prepare the exact PR first.');
  if(!browserRequirements(state.pull.files).includes(app))throw new Error('This app has no changed browser source in the review.');
  const sandbox=await ctx.getSandbox();if((await collectChanges(sandbox,state.baseline,true,state.jiraManifest,state.jiraNuxtConfig,state.jiraLockfile)).length)throw new Error('Candidate changed; browser verification requires the unchanged reviewed source.');
  await ensureBaseWorkspace(sandbox,state);
  await ensureServer(sandbox,app,'base',state.pull.baseSha);await ensureServer(sandbox,app,'head',state.pull.headSha);
  log.set({factory:{station:"reviewer",stage:"prepare_browser",outcome:"ready",app,beforePort:Number(new URL(browserOrigin(app,'base')).port),afterPort:Number(new URL(browserOrigin(app,'head')).port),baseSha:state.pull.baseSha,headSha:state.pull.headSha}});
  const beforeOrigin=browserOrigin(app,'base');const afterOrigin=browserOrigin(app,'head');
  return{origin:afterOrigin,beforeOrigin,afterOrigin,baseSha:state.pull.baseSha,headSha:state.pull.headSha,sessionId:ctx.session.id,instructions:`Wait for both local servers with browser tools. Open ${beforeOrigin} first, navigate to one route changed by this PR, and take a before screenshot plus an accessibility snapshot without interacting. Keep that exact path. Then open ${afterOrigin} at the same path; exercise the changed acceptance criteria, navigate and activate controls with the keyboard, inspect visible focus, take a snapshot after the interaction, and take an after screenshot. The host records the before frame from the exact PR base and the after frame from the exact candidate head, then publishes a visual comparison packet into the PR when storage is available. Report actual failures or missing coverage; this visual packet is supplementary evidence and tool use alone is not a passing assessment.`};
 }
});
