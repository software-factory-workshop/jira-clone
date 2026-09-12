import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { documentSchema,emptyDocument,CockpitConflict,type CockpitDocument } from '../../shared/cockpit';
const pathname='factory/cockpit-v1.json';
export async function readCockpit() {
 const response=await get(pathname,{access:'private',useCache:false});
 if(!response)return {document:emptyDocument(),etag:undefined};
 if(response.statusCode!==200||!response.stream)throw new Error('Cockpit storage could not be read.');
 return {document:documentSchema.parse(await new Response(response.stream).json()),etag:response.blob.etag};
}
export async function updateCockpit<T>(change:(document:CockpitDocument)=>T):Promise<T> {
 for(let attempt=0;attempt<5;attempt++) {
  const {document,etag}=await readCockpit();const result=change(document);
  try {await put(pathname,JSON.stringify(document),{access:'private',addRandomSuffix:false,allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{}),contentType:'application/json'});return result;}
  catch(error){if(!(error instanceof BlobPreconditionFailedError)&&!(error instanceof Error&&error.message.includes('already exists')))throw error;}
 }
 throw new CockpitConflict('The cockpit is busy. Retry the save.');
}
