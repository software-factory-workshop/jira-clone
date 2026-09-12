import { test } from 'node:test';
import assert from 'node:assert/strict';
import { githubInput } from './github-input.mjs';

test('inventory ignores the irrelevant string-null number observed from fx', () => {
  assert.deepEqual(githubInput.parse({resource:'issues', number:'null'}), {resource:'issues', number:'null'});
  assert.deepEqual(githubInput.parse({resource:'pulls', number:null}), {resource:'pulls', number:null});
});

test('comment reads require an actual positive issue number', () => {
  for (const number of [undefined, null, 'null', '1', 0, -1, 1.5]) {
    assert.equal(githubInput.safeParse({resource:'issue_comments', number}).success, false);
  }
  assert.deepEqual(githubInput.parse({resource:'issue_comments', number:1}), {resource:'issue_comments', number:1});
});

test('no input can select another repository or a write endpoint', () => {
  assert.equal(githubInput.safeParse({resource:'create_issue'}).success, false);
  assert.deepEqual(githubInput.parse({resource:'issues', repository:'another/repo'}), {resource:'issues'});
});
