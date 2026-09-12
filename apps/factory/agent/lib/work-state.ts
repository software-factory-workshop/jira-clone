import { defineState } from "eve/context";
import type { WorkPublication } from "./work-github";
import type { CommandEvidence } from "./mining-state";
export interface WorkState {
 sandboxStarted:boolean; prepared:boolean; revision:string;
 baseline:Array<{file:string;sha256:string}>; commands:CommandEvidence[];
 pull:null|{number:number;url:string;title:string;body:string;baseSha:string;headSha:string;targetBranch?:string;files:Array<{filename:string;status:string;patch?:string}>};
 publication:null|WorkPublication;
 operationId:string; activeBrief:string; targetBranch:string; targetHeadSha:string; parentPrNumber?:number; mergeTarget:boolean;
 completedOperations:Record<string,unknown>;
 contextGaps:string[]; recorded:boolean; verifiedDigest:string|null; reviewVerified:boolean;
}
export const workState=defineState<WorkState>("factory.work",()=>({sandboxStarted:false,prepared:false,revision:"",baseline:[],commands:[],pull:null,publication:null,operationId:"",activeBrief:"",targetBranch:"main",targetHeadSha:"",mergeTarget:false,completedOperations:{},contextGaps:[],recorded:false,verifiedDigest:null,reviewVerified:false}));
