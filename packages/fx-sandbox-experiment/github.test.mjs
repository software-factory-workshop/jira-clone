import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyScope, scope, readGithub, loadRepository, includeSource } from './github.mjs';

test('scope preflight rejects wrong teams, projects and missing or expired expiry', () => {
  const valid = { owner: scope.team, owner_id: scope.teamId, project_id: scope.projectId, exp: Date.now() / 1000 + 3600 };
  const token = claims => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
  assert.doesNotThrow(() => verifyScope(token(valid)));
  for (const change of [{ owner: 'personal' }, { owner_id: 'team_other' }, { project_id: 'prj_other' }, { exp: undefined }, { exp: 0 }]) assert.throws(() => verifyScope(token({ ...valid, ...change })));
});

test('inventory follows pages and never treats a failed read as an empty backlog', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    return calls.length === 1 ? new Response(JSON.stringify([{ number: 1, state: 'closed' }]), { headers: { link: '<next>; rel="next"' } }) : new Response('[]');
  });
  const result = await readGithub({ resource: 'issues' }, 'test-token');
  assert.equal(result.complete, true);
  assert.equal(result.items[0].state, 'closed');
  assert.equal(calls.length, 2);
  assert(calls.every(url => url.startsWith('https://api.github.com/repos/software-factory-workshop/jira-clone/issues?state=all')));
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => new Response('unavailable', { status: 503 }));
  await assert.rejects(readGithub({ resource: 'pulls' }, 'test-token'), /HTTP 503/);
});

test('snapshot uses immutable commit tree and blobs; refuses truncated trees', async t => {
  const commit = 'a'.repeat(40), tree = 'b'.repeat(40), blob = 'c'.repeat(40);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    if (url.endsWith('commits/main')) return Response.json({ sha: commit, commit: { tree: { sha: tree } } });
    if (url.includes('/git/trees/')) return Response.json({ truncated: false, tree: [
      { type: 'blob', mode: '100644', path: 'AGENTS.md', sha: blob, size: 4 },
      { type: 'blob', mode: '100644', path: '.env.local', sha: blob, size: 4 },
      { type: 'blob', mode: '120000', path: 'escape.md', sha: blob, size: 4 },
    ] });
    return Response.json({ encoding: 'base64', content: Buffer.from('goal').toString('base64') });
  });
  const result = await loadRepository('test-token');
  assert.equal(result.revision, commit);
  assert.deepEqual(result.entries.map(entry => entry.file), ['AGENTS.md']);
  assert(calls[1].includes(tree));
  assert(calls[2].endsWith(blob));
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async url => Response.json(url.endsWith('commits/main') ? { sha: commit, commit: { tree: { sha: tree } } } : { truncated: true, tree: [] }));
  await assert.rejects(loadRepository('test-token'), /incomplete/);
  assert.equal(includeSource('factory/mining/runs/result.md'), false);
  assert.equal(includeSource('vendor/design-system.tgz'), false);
  assert.equal(includeSource('apps/factory/agents/worker/agent/instructions.ts'), true);
});
