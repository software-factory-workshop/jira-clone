export interface SourceEntry { file: string; content: Uint8Array }
export interface MiningResult {
  report: string;
  revision: string;
  repository: string;
  model: string;
  team: string;
  capturedAt: string;
  elapsedMs: number;
  files: { file: string; bytes: number; sha256: string }[];
  githubReads: { resource: string; complete: boolean; capturedAt: string; items: unknown[] }[];
  usage: unknown;
  finishReason: string;
  segments: unknown[];
}
export function mineRepository(options: { oidc: string; githubToken: string; entries: SourceEntry[]; revision: string; prompt: string; signal?: AbortSignal; source?: 'git-revision' | 'working-tree'; executionSurface?: 'cockpit' | 'calibration'; progress?: (phase: string) => void }): Promise<MiningResult>;
