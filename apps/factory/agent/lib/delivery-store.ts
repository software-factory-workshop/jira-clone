import { get,put,BlobPreconditionFailedError } from '@vercel/blob';
import type { Delivery } from './delivery-state';
function path(id:string){if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid delivery ID');return `factory/delivery/${id}.json`;}
export async function readDelivery(id:string){const response=await get(path(id),{access:'private',useCache:false,headers:{'accept-encoding':'identity'}});if(!response)return null;if(response.blob.etag.startsWith('W/'))throw new Error('Storage returned a weak ETag; refusing an unsafe conditional update.');
 if(response.statusCode!==200||!response.stream)throw new Error('Delivery storage unavailable');return{state:await new Response(response.stream).json() as Delivery,etag:response.blob.etag};}
export async function updateDelivery<T>(id:string,change:(state:Delivery|null)=>{state:Delivery;result:T}):Promise<T>{
 for(let i=0;i<5;i++){const prior=await readDelivery(id);const {state,result}=change(prior?.state||null);try{await put(path(id),JSON.stringify(state),{access:'private',addRandomSuffix:false,allowOverwrite:!!prior,...(prior?{ifMatch:prior.etag}:{}),contentType:'application/json'});return result;}catch(error){if(!(error instanceof BlobPreconditionFailedError)&&!(error instanceof Error&&error.message.includes('already exists')))throw error;}}
 throw new Error('Delivery changed concurrently. Retry the operation.');
}
