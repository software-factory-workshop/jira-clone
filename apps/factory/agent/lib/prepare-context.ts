import { loadRepository, manifestFor } from "./github.mjs";
import { commandEvidence } from "./command-evidence.ts";
interface Sandbox {
  writeBinaryFile(input:{path:string;content:Uint8Array}):PromiseLike<unknown>;
  writeTextFile(input:{path:string;content:string}):PromiseLike<unknown>;
  run(input:{command:string}):PromiseLike<{exitCode:number;stdout:string;stderr:string}>;
}
export async function prepareRepository(sandbox:Sandbox,token:string,signal?:AbortSignal, snapshot?:{revision:string;entries:Array<{file:string;content:Buffer}>}) {
  const {revision,entries}=snapshot ?? await loadRepository(token,signal);
  const files=manifestFor(entries);
  for(let i=0;i<entries.length;i+=8) await Promise.all(entries.slice(i,i+8).map(entry=>sandbox.writeBinaryFile({path:`repo/${entry.file}`,content:entry.content})));
  await sandbox.writeTextFile({path:"repo/.mining-snapshot.json",content:JSON.stringify({revision,files,exclusions:["factory/mining/","packages/fx-sandbox-experiment/","Git history","credentials"],node:"24.21.0",pnpm:"10.33.4"},null,2)});
  const setup='set -eu; mkdir -p "$HOME/.local/bin"; npm install --prefix "$HOME/.local" --no-audit --no-fund node@24.21.0 pnpm@10.33.4; ln -sf "$HOME/.local/node_modules/node/bin/node" "$HOME/.local/bin/node"; ln -sf "$HOME/.local/node_modules/pnpm/bin/pnpm.cjs" "$HOME/.local/bin/pnpm"; export PATH="$HOME/.local/bin:$PATH"; cd /workspace/repo; node --version; pnpm --version; pnpm install --frozen-lockfile';
  const result=await sandbox.run({command:setup});
  return {revision,files,commands:[commandEvidence(setup,result)],prepared:result.exitCode===0,contextGaps:result.exitCode===0?[]:[`Dependency setup failed with exit ${result.exitCode}; inspect command evidence before proposing reproducibility-dependent work.`]};
}
