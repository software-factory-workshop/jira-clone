import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifyNativeOutput } from './verify-native-output.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const eveCli = fileURLToPath(new URL('../../bin/eve.js', import.meta.resolve('eve')));
const names = ['task-miner', 'worker', 'reviewer'];
const selected = process.argv[2];
if (selected && !names.includes(selected)) throw new Error('Unknown factory agent');
for (const name of selected ? [selected] : names) {
  const cwd = resolve(root, 'agents', name);
  const result = spawnSync(process.execPath, [eveCli, 'build'], {
    cwd, stdio: 'inherit',
    env: { ...process.env, EVE_PUBLIC_ROUTE_PREFIX: `/${name}`, EVE_INTERNAL_AGENT_WORKSPACE_MEMBER: '1' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (process.env.VERCEL === '1') {
    await verifyNativeOutput(process.env.EVE_INTERNAL_BUILD_OUTPUT_DIRECTORY || resolve(cwd, '.vercel/output'));
  }
}
