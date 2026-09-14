import { defineState } from "eve/context";
import type { WorkPublication } from "./work-github";
import type { CommandEvidence } from "./mining-state";
export interface VerificationFinding { severity: "blocking"; path: string; message: string; evidence: string }
export interface WorkState {
 sandboxStarted:boolean; prepared:boolean; revision:string;
 jiraManifest:string; jiraNuxtConfig:string; jiraLockfile:string; baseline:Array<{file:string;sha256:string}>; commands:CommandEvidence[];
 pull:null|{number:number;url:string;title:string;body:string;baseSha:string;headSha:string;targetBranch?:string;files:Array<{filename:string;previous_filename?:string;status:string;patch?:string}>};
 publication:null|WorkPublication;
 operationId:string; activeBrief:string; targetBranch:string; targetHeadSha:string; parentPrNumber?:number; mergeTarget:boolean;
 completedOperations:Record<string,unknown>; basePrepared:boolean; verificationFindings:VerificationFinding[];
 contextGaps:string[]; recorded:boolean; verifiedDigest:string|null; reviewVerified:boolean;
}
export const workState=defineState<WorkState>("factory.work",()=>({sandboxStarted:false,prepared:false,revision:"",jiraManifest:"",jiraNuxtConfig:"",jiraLockfile:"",baseline:[],commands:[],pull:null,publication:null,operationId:"",activeBrief:"",targetBranch:"main",targetHeadSha:"",mergeTarget:false,completedOperations:{},basePrepared:false,verificationFindings:[],contextGaps:[],recorded:false,verifiedDigest:null,reviewVerified:false}));
