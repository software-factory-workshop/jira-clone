import type { CommandEvidence } from "./mining-state.ts";
export function commandEvidence(command:string,result:{exitCode:number;stdout:string;stderr:string;truncated?:boolean}):CommandEvidence {
  return { command,exitCode:result.exitCode,stdout:result.stdout.slice(-12000),stderr:result.stderr.slice(-12000),capturedAt:new Date().toISOString(),truncated:result.truncated===true||result.stdout.length>12000||result.stderr.length>12000 };
}
