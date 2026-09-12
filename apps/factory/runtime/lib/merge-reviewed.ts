import { getToken } from '@vercel/connect';
import { repository } from './github.mjs';
import { mergeEligibility,type MergeFile,type MergeReview,type MergeDecision } from './merge-policy.ts';

export interface MergeInput {
 publication:{number:number;headSha:string;targetHeadSha:string;targetBranch:string;ownerSessionId:string};
 review:MergeReview;reviewerSessionId:string;
}
// GitHub remains the final authority: exact candidate SHA, green checks, no forced merges.
export async function mergeReviewed(input:MergeInput, token?:string):Promise<MergeDecision>{
 token ||= await getToken('github/jira-clone',{subject:{type:'app'}});
 async function api(path:string,method='GET',body?:unknown,graphql=false){
  const response=await fetch(graphql?'https://api.github.com/graphql':`https://api.github.com/repos/${repository}/${path}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`GitHub merge check returned HTTP ${response.status}`);
  const result=await response.json();if(result.errors)throw new Error('GitHub refused the draft transition');return result;
 }
 try{
  const p=input.publication;const pr=await api(`pulls/${p.number}`);
  if(pr.merged&&pr.head.sha===p.headSha)return{status:'merged',reason:'Reviewed candidate was already merged.',commitSha:pr.merge_commit_sha};
  const current=()=>pr.state==='open'&&pr.head.sha===p.headSha&&pr.base.ref===p.targetBranch&&pr.base.sha===p.targetHeadSha&&pr.head.repo?.full_name===repository&&pr.base.repo?.full_name===repository;
  if(!current())return{status:'manual',reason:'PR or target changed since the independent review.'};
  const files:MergeFile[]=await api(`pulls/${p.number}/files?per_page=100`);
  if(files.length!==pr.changed_files)return{status:'manual',reason:'Changed-file inventory is incomplete.'};
  const decision=mergeEligibility({files,review:input.review,headSha:p.headSha,baseSha:p.targetHeadSha,targetBranch:p.targetBranch,workerSessionId:p.ownerSessionId,reviewerSessionId:input.reviewerSessionId});
  if(decision)return decision;
  const [checks,status]=await Promise.all([api(`commits/${p.headSha}/check-runs?per_page=100&filter=latest`),api(`commits/${p.headSha}/status?per_page=100`)]);
  if(checks.total_count!==checks.check_runs.length||status.total_count!==status.statuses.length)return{status:'manual',reason:'Check inventory is incomplete.'};
  if(checks.check_runs.some((c:any)=>c.status==='completed'&&(!['success','neutral','skipped'].includes(c.conclusion)||(c.name==='check'&&c.app?.slug==='github-actions'&&c.conclusion!=='success')))||status.statuses.some((s:any)=>['failure','error'].includes(s.state)))return{status:'manual',reason:'GitHub checks did not pass.'};
  if(!checks.check_runs.some((c:any)=>c.name==='check'&&c.app?.slug==='github-actions'&&c.status==='completed'&&c.conclusion==='success'))return{status:'waiting',reason:'Waiting for the repository check workflow on the reviewed commit.'};
  if(!checks.check_runs.length&&!status.statuses.length||checks.check_runs.some((c:any)=>c.status!=='completed')||status.statuses.some((s:any)=>s.state!=='success'))return{status:'waiting',reason:'Waiting for all GitHub checks to pass.'};
  if(pr.mergeable===null)return{status:'waiting',reason:'GitHub is calculating mergeability.'};
  if(pr.mergeable===false||!['clean','unstable','blocked'].includes(pr.mergeable_state))return{status:'manual',reason:'Candidate cannot be safely merged into its reviewed target.'};
  // Publication creates drafts; readiness is a code-owned decision after the gate passes.
  if(pr.draft)await api('', 'POST',{query:'mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{id}}}',variables:{id:pr.node_id}},true);
  const latest=await api(`pulls/${p.number}`);
  if(latest.mergeable_state!=='clean')return{status:'waiting',reason:'Waiting for GitHub merge requirements to be satisfied.'};
  if(latest.head.sha!==p.headSha||latest.base.sha!==p.targetHeadSha||latest.base.ref!==p.targetBranch||latest.state!=='open')return{status:'manual',reason:'Candidate or target advanced before merge.'};
  const result=await api(`pulls/${p.number}/merge`,'PUT',{sha:p.headSha,merge_method:'merge'});
  return result.merged?{status:'merged',reason:'Low-risk candidate merged after independent verification and green GitHub checks.',commitSha:result.sha}:{status:'manual',reason:'GitHub refused to merge the candidate.'};
 }catch(error){return{status:'manual',reason:error instanceof Error?error.message:'Merge could not be verified.'};}
}
