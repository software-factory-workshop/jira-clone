import { Client } from 'eve/client';
import { getVercelOidcToken } from '@vercel/oidc';
import { readStationRegistry } from './station-registry';
export type RootAgent = 'task-miner' | 'worker' | 'reviewer';
export function factoryOrigin() { return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'; }
export async function serviceHeaders():Promise<Record<string,string>> {
 if(!process.env.VERCEL) return {'content-type':'application/json'};
 const token=await getVercelOidcToken();
 return {'content-type':'application/json',authorization:`Bearer ${token}`,'x-vercel-trusted-oidc-idp-token':token};
}
export async function rootRequest(root:RootAgent,path:string,body:unknown) {
 const response=await fetch(`${factoryOrigin()}/${root}${path}`,{method:'POST',headers:await serviceHeaders(),body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});
 const result=await response.json();if(!response.ok)throw new Error(result.error?.message||result.error||`Agent request failed (${response.status})`);return result;
}
export async function recordedRoot(id:string):Promise<RootAgent|undefined> {
 const value=(await readStationRegistry()).registry.sessions[id];
 return value==='task-miner'||value==='worker'||value==='reviewer'?value:undefined;
}
export function rootSession(root:RootAgent,id:string) {
 const client=new Client({host:`${factoryOrigin()}/${root}`,headers:serviceHeaders,redirect:'error'});
 const session=client.sessions.attach(id);
 let snapshot:ReturnType<typeof session.snapshot>|undefined;
 const read=()=>snapshot??=session.snapshot({signal:AbortSignal.timeout(15000)});
 return {
  getStreamTailIndex:async()=> (await read()).events.length-1,
  getEventStream:async(_options?:unknown)=>new ReadableStream({async start(controller){try{for(const event of (await read()).events)controller.enqueue(event);controller.close();}catch(error){controller.error(error);}}}),
  cancel:async(options?:{tasks?:boolean})=>session.cancel(options),
  send:async(message:string,options?:{auth?:{attributes?:Readonly<Record<string,unknown>>}})=>rootRequest(root,`/factory/session/${encodeURIComponent(id)}/continue`,{message,revision:options?.auth?.attributes?.factoryRevision}),
 };
}

export async function factorySession<T>(id:string,fallback:(id:string)=>T){const root=await recordedRoot(id);return root?rootSession(root,id):fallback(id);}
