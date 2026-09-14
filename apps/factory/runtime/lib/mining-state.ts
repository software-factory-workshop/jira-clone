import { defineState } from "eve/context";
import type { WorkOrderAdmission } from "../../shared/cockpit.ts";
export interface CommandEvidence { command: string; exitCode: number; stdout: string; stderr: string; capturedAt: string; truncated: boolean }
export interface ReadReceipt { resource:string; capturedAt:string; complete:boolean; items:unknown[]; projectId?:string; gap?:string }
export interface MiningState {
  sandboxStarted: boolean; prepared: boolean; recorded: boolean; revision: string; startedAt: string;
  files: Array<{file:string;bytes:number;sha256:string}>;
  commands: CommandEvidence[]; githubReads: ReadReceipt[]; vercelReads: ReadReceipt[]; contextGaps:string[]; admission?: WorkOrderAdmission;
}
export const miningState = defineState<MiningState>("native-mining.context", () => ({ sandboxStarted:false, prepared:false, recorded:false, revision:"", startedAt:new Date().toISOString(), files:[], commands:[], githubReads:[], vercelReads:[], contextGaps:[] }));
export { commandEvidence } from "./command-evidence.ts";
