import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { readdir, mkdir, copyFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const build = spawnSync('pnpm', ['exec', 'eve', 'build'], { stdio: 'inherit', env: process.env });
if (build.status !== 0) process.exit(build.status || 1);

// Eve 0.52.5's Nitro build relocates harness-acp into _libs but omits its
// import.meta.url-relative bootstrap assets. Preserve the four exact assets
// next to every relocated module, then verify byte equality before deployment.
const require = createRequire(import.meta.url);
const minerRequire = createRequire(require.resolve('@jira-clone/task-miner/runtime'));
const fxRequire = createRequire(minerRequire.resolve('@ai-sdk/harness-fx/package.json'));
const bridge = join(dirname(fxRequire.resolve('@ai-sdk/harness-acp/package.json')), 'dist/bridge');
// The pinned eve/nuxt module supplies this directory for its generated service.
const output = resolve(process.env.EVE_INTERNAL_BUILD_OUTPUT_DIRECTORY || (process.env.VERCEL ? '.vercel/output' : '.output'));
let copied = 0;
// readdir includes the hidden .well-known Workflow copy; ordinary globs omit it.
for (const entry of await readdir(output, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || entry.name !== 'ai-sdk__harness-acp.mjs') continue;
  const module = join(entry.parentPath, entry.name);
  assert((await readFile(module, 'utf8')).includes('./bridge/'), 'Recheck the ACP asset workaround after upgrading Eve.');
  const destination = join(dirname(module), 'bridge');
  await mkdir(destination, { recursive: true });
  for (const name of ['package.json', 'pnpm-lock.yaml', 'index.mjs', 'host-tool-mcp.mjs']) {
    await copyFile(join(bridge, name), join(destination, name));
    assert.deepEqual(await readFile(join(destination, name)), await readFile(join(bridge, name)));
  }
  copied++;
}
assert(copied >= (process.env.VERCEL ? 2 : 1), 'Missing Eve or Workflow ACP bundle; review the packaging contract instead of shipping unchecked.');
console.log(`[task-mining] Verified ACP bootstrap assets in ${copied} runtime bundle(s).`);
