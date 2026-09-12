import { defineState } from "eve/context";
import type { CommandEvidence } from "./mining-state";
export interface WorkState {
 sandboxStarted:boolean; prepared:boolean; revision:string;
 baseline:Array<{file:string;sha256:string}>; commands:CommandEvidence[];
 pull:null|{number:number;url:string;title:string;body:string;baseSha:string;headSha:string;files:Array<{filename:string;status:string;patch?:string}>};
 publication:null|{branch:string;number:number;url:string;headSha:string;baseSha:string};
 contextGaps:string[]; recorded:boolean; verifiedDigest:string|null; reviewVerified:boolean;
}
export const workState=defineState<WorkState>("factory.work",()=>({sandboxStarted:false,prepared:false,revision:"",baseline:[],commands:[],pull:null,publication:null,contextGaps:[],recorded:false,verifiedDigest:null,reviewVerified:false}));
