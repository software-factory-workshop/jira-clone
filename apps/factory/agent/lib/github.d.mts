export interface SourceEntry { file: string; content: Buffer }
export const repository: string;
export const scope: { team: string; teamId: string; projectId: string };
export const model: string;
export function verifyScope(oidc: string): unknown;
export function loadRepository(token: string, signal?: AbortSignal): Promise<{ revision: string; entries: SourceEntry[] }>;
export function manifestFor(entries: SourceEntry[]): Array<{file:string;bytes:number;sha256:string}>;
export function includeSource(file:string):boolean;
export function readGithub(input:unknown, token:string, signal?:AbortSignal):Promise<{repository:string;resource:string;capturedAt:string;complete:boolean;items:unknown[]}>;
