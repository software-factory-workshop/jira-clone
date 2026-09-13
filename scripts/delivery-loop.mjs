#!/usr/bin/env node
// API-only driver. The same loop can be resumed by the cockpit or another invocation.
//
// FACTORY_TOKEN must be a Vercel OIDC machine bearer for the factory, not a
// Vercel REST personal token. FACTORY_PROTECTION_BYPASS, when the deployment
// needs it, is sent as a header and never written to the checkpoint. For a
// Vercel-protected deployment prefer --vercel-cwd <linked project dir>: the
// authenticated Vercel CLI supplies its own bypass and the bearer goes through
// stdin, never argv. The checkpoint stores IDs only.
//
// Recovery: worker stopped before publishing (baseline failure) -> fix the
// baseline, then --continue (same owner, same publication operation).
// Worker published -> --revision <brief.md>. Reviewer stopped -> start a new
// review from the cockpit or API. "Resume acceptance is unconfirmed" -> inspect
// the owner session by hand; nothing was resent.
import { readFile,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
const {values}=parseArgs({options:{base:{type:'string'},task:{type:'string'},state:{type:'string'},resume:{type:'string'},revision:{type:'string'},once:{type:'boolean',default:false},'vercel-cwd':{type:'string'},continue:{type:'boolean',default:false}}});
if(!values.state)throw new Error('--state <checkpoint.json> is required; it stores IDs only, never credentials.');
let checkpoint;
try{checkpoint=JSON.parse(await readFile(values.state,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const base=(values.base||checkpoint?.base)?.replace(/\/$/,'');if(!base)throw new Error('--base is required on first use');
const vercelCwd=values['vercel-cwd']||checkpoint?.vercelCwd;
const token=process.env.FACTORY_TOKEN;if(!token)throw new Error('Set FACTORY_TOKEN to the factory machine bearer token.');
async function api(path,body){
 const endpoint=`/factory/delivery${path}`;
 if(vercelCwd){
  const args=['curl',endpoint,'--deployment',base,'--scope','demo-software-factory','--','--silent','--show-error','--fail-with-body','--header','@-','--request',body===undefined?'GET':'POST',...(body===undefined?[]:['--data',JSON.stringify(body)])];
  const raw=await new Promise((resolve,reject)=>{const child=spawn('vercel',args,{cwd:vercelCwd,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('close',code=>code===0?resolve(stdout):reject(new Error(`Vercel API transport failed (${code}): ${stdout.slice(-1200)}`)));child.stdin.end(`Authorization: Bearer ${token}\nContent-Type: application/json\nOrigin: ${base}\n`);});
  return JSON.parse(raw);
 }
 const response=await fetch(`${base}${endpoint}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Origin:base,...(process.env.FACTORY_PROTECTION_BYPASS?{'x-vercel-protection-bypass':process.env.FACTORY_PROTECTION_BYPASS}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.json();if(!response.ok)throw new Error(`HTTP ${response.status}: ${JSON.stringify(value)}`);return value;
}
async function save(value){checkpoint={...checkpoint,...value,base,...(vercelCwd?{vercelCwd}:{})};await writeFile(values.state,JSON.stringify(checkpoint,null,2)+'\n',{mode:0o600});}
let id=values.resume||checkpoint?.id;
if(!id){if(!values.task)throw new Error('--task <request.json> is required for a new delivery.');const task=JSON.parse(await readFile(values.task,'utf8'));await save({request:{...task,operationId:checkpoint?.request?.operationId||task.operationId||randomUUID()}});const created=await api('',checkpoint.request);id=created.id;await save({id});}
if(values.continue){const operationId=checkpoint?.pendingResume||randomUUID();await save({pendingResume:operationId});await api(`/${id}/resume`,{operationId});await save({pendingResume:null});}
if(values.revision){const brief=await readFile(values.revision,'utf8');const request=checkpoint?.pendingRevision?.brief===brief?checkpoint.pendingRevision:{operationId:randomUUID(),brief};await save({pendingRevision:request});await api(`/${id}/revise`,request);await save({pendingRevision:null});}
let previous='';
for(;;){const state=await api(`/${id}`);await save({lastPhase:state.phase,sessionId:state.sessionId,childSessionId:state.childSessionId,publication:state.publication});const summary=JSON.stringify({id,phase:state.phase,cycle:state.cycle,sessionId:state.sessionId,childSessionId:state.childSessionId,publication:state.publication,error:state.error,review:state.review});if(summary!==previous){console.log(summary);previous=summary;}
 if(values.once||['human_review','ready','blocked','cancelled','needs_revision','merged'].includes(state.phase))break;
 await new Promise(resolve=>setTimeout(resolve,5000));
}
