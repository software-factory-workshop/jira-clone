import type { SourceEntry } from './runtime.mjs';
export const repository: string;
export const scope: { team: string; teamId: string; projectId: string };
export const model: string;
export function verifyScope(oidc: string): unknown;
export function loadRepository(token: string, signal?: AbortSignal): Promise<{ revision: string; entries: SourceEntry[] }>;
