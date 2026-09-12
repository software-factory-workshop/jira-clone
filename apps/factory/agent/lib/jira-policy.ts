import { isDeepStrictEqual } from "node:util";
export const jiraTestCommand = "node --test tests/*.test.ts";
export function validateJiraManifest(baseline:string,candidate:string|null) {
 if(candidate===null)throw new Error("Jira manifest cannot be removed.");
 const before=JSON.parse(baseline), after=JSON.parse(candidate);
 if(!after.scripts||after.scripts.test!==jiraTestCommand)throw new Error("Only the exact Jira test script is allowed.");
 const expected=structuredClone(before);expected.scripts={...expected.scripts,test:jiraTestCommand};
 if(!isDeepStrictEqual(expected,after))throw new Error("Protected Jira manifest fields changed.");
}
export function jiraManifest(entries:Array<{file:string;content:Buffer}>) { return entries.find(e=>e.file==="apps/jira/package.json")?.content.toString()||""; }
export function verificationCommands(jiraChanged:boolean) {return ["pnpm typecheck","pnpm test",...(jiraChanged?["pnpm --filter @jira-clone/jira test"]:[]),"pnpm build"];}
