import { mineRepository, MiningIncompleteError } from './runtime.mjs';
import { includeSource, verifyScope, model, scope as expected } from './github.mjs';
import { getToken } from '@vercel/connect';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runName = process.argv[2];
if (!runName || !/^[a-z0-9-]+$/.test(runName)) throw new Error('Provide a run name: pnpm --filter @jira-clone/fx-sandbox-experiment mine baseline');
const env = parseEnv(await readFile(path.join(root, 'apps/factory/.env.local'), 'utf8'));
const oidc = env.VERCEL_OIDC_TOKEN;
if (!oidc) throw new Error('Run vercel env pull .env.local --scope demo-software-factory from apps/factory first.');
const claims = verifyScope(oidc);
// Local process only: never fall back to personal fx configuration or API keys.
process.env.VERCEL_OIDC_TOKEN = oidc;
delete process.env.AI_GATEWAY_API_KEY;
delete process.env.VERCEL_TOKEN;
const secrets = [oidc];
function safe(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of secrets) text = text.split(secret).join('[REDACTED]');
  return text;
}
const out = path.join(root, 'factory/mining/runs', runName);
await mkdir(out, { recursive: false });
async function credits() {
  let response;
  for (let attempt=0;attempt<3;attempt++) {
    response = await fetch('https://ai-gateway.vercel.sh/v1/credits', {headers:{Authorization:`Bearer ${oidc}`},signal:AbortSignal.timeout(10000)});
    if (response.status < 500) break;
  }
  if (!response.ok) throw new Error(`Gateway scope check failed: HTTP ${response.status}`);
  const data = await response.json();
  return {checkedAt:new Date().toISOString(),balance:data.balance,totalUsed:data.total_used};
}
const billingBefore = await credits();
await writeFile(path.join(out,'billing-before.json'), JSON.stringify(billingBefore,null,2));
const prompt = await readFile(path.resolve(root, process.argv[3] || 'factory/mining/prompt.md'), 'utf8');
const sourceRef = process.argv[4];
const sha = execFileSync('git', ['rev-parse', sourceRef || 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const deleted = new Set(execFileSync('git', ['ls-files','--deleted','-z'], {cwd:root,encoding:'utf8'}).split('\0'));
const files = execFileSync('git', sourceRef ? ['ls-tree', '-r', '--name-only', '-z', sha] : ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).filter(file => (sourceRef || !deleted.has(file)) && includeSource(file));
const entries = await Promise.all([...new Set(files)].map(async file => ({ file, content: sourceRef ? execFileSync('git',['show',`${sha}:${file}`],{cwd:root,maxBuffer:5000000}) : await readFile(path.join(root, file)) })));
const manifest = entries.map(({file,content}) => ({ file, sha256:createHash('sha256').update(content).digest('hex'), bytes:content.length }));
await writeFile(path.join(out, 'prompt.md'), prompt);
await writeFile(path.join(out, 'context.md'), entries.filter(entry=>entry.file.endsWith('.md')).map(entry=>`# FILE: ${entry.file}\n\n${entry.content.toString('utf8')}\n`).join('\n'));
await writeFile(path.join(out, 'inputs.json'), JSON.stringify({ revision:sha, source:sourceRef ? 'git-revision' : 'working-tree', model, ...expected, capturedAt:new Date().toISOString(), files:manifest }, null, 2));
const ghToken = await getToken('github/jira-clone', { subject: { type: 'app' } });
secrets.push(ghToken);
const started = Date.now();
try {
  console.log(JSON.stringify({run:runName,model,team:claims.owner,project:claims.project,files:entries.length}));
  const result = await mineRepository({oidc,githubToken:ghToken,entries,revision:sha,source:sourceRef ? 'git-revision' : 'working-tree',prompt,progress:phase=>console.log(phase)});
  await writeFile(path.join(out,'segments.json'),safe(result.segments));
  await writeFile(path.join(out,'runtime.json'),safe(result.runtime));
  await writeFile(path.join(out,'result.md'),safe(result.report));
  await writeFile(path.join(out,'result.json'),safe(result));
  await writeFile(path.join(out,'github-reads.json'),safe(result.githubReads));
  console.log(JSON.stringify({run:runName,elapsedMs:Date.now()-started,finishReason:result.finishReason,githubReads:result.githubReads.length,usage:result.usage}));
} catch(error) {
  if (error instanceof MiningIncompleteError) {
    await writeFile(path.join(out,'result.json'),safe(error.result));
    await writeFile(path.join(out,'segments.json'),safe(error.result.segments));
    await writeFile(path.join(out,'github-reads.json'),safe(error.result.githubReads));
  }
  await writeFile(path.join(out,'error.txt'),safe(`${error.name}: ${error.message}`));
  console.error(safe(`${error.name}: ${error.message}`));
  process.exitCode=1;
} finally {
  await writeFile(path.join(out,'billing-after.json'), JSON.stringify(await credits(),null,2));
}
