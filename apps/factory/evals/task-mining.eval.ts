import { defineEval } from "eve/evals";
const questions=[
 "Mine the next useful task for this factory-first ADEO Jira project. Respect the current goal, inspect the codebase and existing GitHub issues AND pull requests, and support every proposal with repository evidence. Return at most three proposals, ranked by usefulness now, or explain why none is justified. Finish with a reflection on context quality.",
 "We want to teach how context engineering improves a software factory. Inspect what this repository actually implements and its current work, reproduce one relevant behavior, and identify the smallest next experiment that would improve task-mining usefulness. Distinguish operational infrastructure from context quality. Use GitHub and the two Vercel projects as evidence and name any unavailable access."
];
export default questions.map((question,index)=>defineEval({description:index===0?"Native Muse baseline":"Native Muse transfer probe",tags:["native","paid"],async test(t){
 await t.send(question);
 t.succeeded(); t.calledTool("prepare_context");t.calledTool("github_read");t.calledTool("record_findings");
 t.log("Use captured record_findings evidence for human usefulness review. Tool completion alone is not a quality judgment.");
}}));
