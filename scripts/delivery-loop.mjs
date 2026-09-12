#!/usr/bin/env node
// API-only driver. The same loop can be resumed by the cockpit or another invocation.
import { readFile,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
const {values}=parseArgs({options:{base:{type:'string'},task:{type:'string'},state:{type:'string'},resume:{type:'string'},revision:{type:'string'},once:{type:'boolean',default:false}}});
if(!values.state)throw new Error('--state <checkpoint.json> is required; it stores IDs only, never credentials.');
let checkpoint;
try{checkpoint=JSON.parse(await readFile(values.state,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const base=(values.base||checkpoint?.base)?.replace(/\/$/,'');if(!base)throw new Error('--base is required on first use');
const token=process.env.FACTORY_TOKEN;if(!token)throw new Error('Set FACTORY_TOKEN to the factory machine bearer token.');
async function api(path,body){const response=await fetch(`${base}/factory/delivery${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Origin:base,...(process.env.FACTORY_PROTECTION_BYPASS?{'x-vercel-protection-bypass':process.env.FACTORY_PROTECTION_BYPASS}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await response.json();if(!response.ok)throw new Error(`HTTP ${response.status}: ${JSON.stringify(value)}`);return value;}
async function save(value){checkpoint={...checkpoint,...value,base};await writeFile(values.state,JSON.stringify(checkpoint,null,2)+'\n',{mode:0o600});}
let id=values.resume||checkpoint?.id;
if(!id){if(!values.task)throw new Error('--task <request.json> is required for a new delivery.');const task=JSON.parse(await readFile(values.task,'utf8'));await save({request:{...task,operationId:checkpoint?.request?.operationId||task.operationId||randomUUID()}});const created=await api('',checkpoint.request);id=created.id;await save({id});}
if(values.revision){const brief=await readFile(values.revision,'utf8');const request=checkpoint?.pendingRevision?.brief===brief?checkpoint.pendingRevision:{operationId:randomUUID(),brief};await save({pendingRevision:request});await api(`/${id}/revise`,request);await save({pendingRevision:null});}
let previous='';
for(;;){const state=await api(`/${id}/advance`,{});await save({lastPhase:state.phase,sessionId:state.sessionId,childSessionId:state.childSessionId,publication:state.publication});const summary=JSON.stringify({id,phase:state.phase,cycle:state.cycle,sessionId:state.sessionId,childSessionId:state.childSessionId,publication:state.publication,error:state.error,review:state.review});if(summary!==previous){console.log(summary);previous=summary;}
 if(values.once||['human_review','ready','blocked','cancelled','needs_revision'].includes(state.phase))break;
 await new Promise(resolve=>setTimeout(resolve,5000));
}
