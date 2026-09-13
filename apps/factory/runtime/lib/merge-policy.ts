import { hostReviewLimitations } from './review-policy.ts';
import type { FactoryDecisionAudit } from './cedar/operation-runner.ts';

export interface MergeFile { filename:string;previous_filename?:string;status:string;patch?:string }
export interface MergeReview {
 headSha:string;baseSha:string;targetBranch:string;verdict:string;
 findings:Array<{severity:string}>;limitations:string[];
 verification?:{prepared:boolean;repositoryChecksPassed:boolean;candidateUnchanged:boolean};
}
export type MergeDecision={status:'merged'|'manual'|'waiting';reason:string;commitSha?:string;authorization?:FactoryDecisionAudit};
const cosmeticProperty=/^(?:color|background-color|border(?:-(?:top|right|bottom|left))?-color|outline-color|text-decoration-color|font-weight)\s*:\s*[#\w\s(),.%/-]+;$/;
function cosmetic(file:MergeFile){
 if(file.status!=='modified'||!/^apps\/(?:jira|factory)\/app\/.*\.css$/.test(file.filename)||!file.patch)return false;
 const changes=file.patch.split('\n').filter(line=>/^[+-]/.test(line)&&!/^([+]{3}|[-]{3})/.test(line));
 return changes.length>0&&changes.length<=40&&changes.every(line=>cosmeticProperty.test(line.slice(1).trim()));
}
export function lowRiskFiles(files:MergeFile[]):boolean{
 if(!files.length||files.length>10)return false;
 return files.every(file=>{
  if(file.previous_filename||!['added','modified'].includes(file.status))return false;
  const path=file.filename;
  if(path.split('/').some(part=>['AGENTS.md','CLAUDE.md','SKILL.md'].includes(part)))return false;
  if(/^docs\/.+\.md$/.test(path)&&!/(?:policy|permission|security|auth|skill|instruction|runbook)/i.test(path))return true;
  return cosmetic(file);
 });
}
export function mergeEligibility(input:{files:MergeFile[];review:MergeReview;headSha:string;baseSha:string;targetBranch:string;workerSessionId:string;reviewerSessionId:string}):MergeDecision|null{
 const r=input.review;
 if(!input.reviewerSessionId||input.workerSessionId===input.reviewerSessionId)return{status:'manual',reason:'An independent reviewer is required.'};
 if(r.headSha!==input.headSha||r.baseSha!==input.baseSha||r.targetBranch!==input.targetBranch)return{status:'manual',reason:'Review does not match the candidate and current target.'};
 if(input.targetBranch!=='main')return{status:'manual',reason:'Child PRs require the branch owner to integrate them.'};
 if(!r.verification?.prepared||!r.verification.repositoryChecksPassed||!r.verification.candidateUnchanged)return{status:'manual',reason:'Independent verification is missing or candidate changed after verification.'};
 if(r.findings.some(f=>f.severity==='blocking')||!['approve','incomplete'].includes(r.verdict))return{status:'manual',reason:'The review requests changes.'};
 if(!lowRiskFiles(input.files))return{status:'manual',reason:'Change is outside the small documentation and cosmetic CSS policy.'};
 const allowed=hostReviewLimitations(input.files);
 if(r.limitations.some(item=>!allowed.includes(item))||(r.verdict==='incomplete'&&!r.limitations.length))return{status:'manual',reason:'Review evidence is incomplete beyond the permitted browser exception.'};
 return null;
}
