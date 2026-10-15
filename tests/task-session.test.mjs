import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskSession } from '../src/services/taskSession.ts';

const task = (id = 'one') => ({ id, title: id, priority: 'medium', status: 'in-progress', createdAt: new Date('2026-10-15'), dueDate: new Date('2026-10-16') });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('empty tasks stay empty and loading never writes demo tasks', async () => {
  let writes = 0;
  const session = new TaskSession('A', { load: async () => [], save: async () => { writes++; } });
  await session.load();
  await session.load();
  assert.deepEqual(session.getSnapshot().tasks, []);
  assert.equal(session.getSnapshot().status, 'ready');
  assert.equal(writes, 0);
});

test('read errors block edits and all automatic writes, and support a deliberate retry', async () => {
  let fail = true, writes = 0;
  const session = new TaskSession('A', {
    load: async () => { if (fail) throw new Error('Corrupt file'); return [task()]; },
    save: async () => { writes++; },
  });
  await session.load();
  assert.equal(session.getSnapshot().status, 'error');
  await assert.rejects(session.mutate(() => []));
  assert.equal(writes, 0);
  fail = false;
  await session.load();
  assert.equal(session.getSnapshot().status, 'ready');
  assert.equal(session.getSnapshot().tasks.length, 1);
  assert.equal(writes, 0);
});

test('malformed task data is not accepted as a successful load', async () => {
  const session = new TaskSession('A', { load: async () => [{ ...task(), dueDate: 'invalid' }], save: async () => assert.fail('Unexpected save') });
  await session.load();
  assert.equal(session.getSnapshot().status, 'error');
});

test('writes do not publish success until persistence confirms the commit', async () => {
  const saved = deferred();
  const session = new TaskSession('A', { load: async () => [], save: () => saved.promise });
  await session.load();
  const operation = session.mutate(() => [task()]);
  assert.deepEqual(session.getSnapshot().tasks, []);
  assert.equal(session.getSnapshot().isSaving, true);
  saved.resolve();
  await operation;
  assert.equal(session.getSnapshot().tasks.length, 1);
  assert.equal(session.getSnapshot().isSaving, false);
});

test('save failure preserves committed state, reports failure, and permits retry', async () => {
  let fail = true;
  const session = new TaskSession('A', {
    load: async () => [task()],
    save: async () => { if (fail) throw new Error('Read-only disk'); },
  });
  await session.load();
  await assert.rejects(session.mutate(() => []));
  assert.equal(session.getSnapshot().tasks.length, 1);
  assert.ok(session.getSnapshot().saveError);
  fail = false;
  await session.mutate(() => []);
  assert.deepEqual(session.getSnapshot().tasks, []);
  assert.equal(session.getSnapshot().saveError, null);
});

test('rapid edits use the latest committed list rather than overwriting with stale lists', async () => {
  const writes = [];
  const session = new TaskSession('A', { load: async () => [], save: async tasks => { writes.push(tasks.map(task => task.id)); } });
  await session.load();
  await Promise.all([
    session.mutate(tasks => [...tasks, task('one')]),
    session.mutate(tasks => [...tasks, task('two')]),
    session.mutate(tasks => [...tasks, task('three')]),
  ]);
  assert.deepEqual(writes, [['one'], ['one', 'two'], ['one', 'two', 'three']]);
});

test('late loads from an obsolete account are discarded', async () => {
  const slow = deferred();
  let active = 'A';
  const a = new TaskSession('A', { load: () => slow.promise, save: async () => assert.fail('Unexpected write') }, () => active === 'A');
  const loading = a.load();
  active = 'B';
  a.deactivate();
  const b = new TaskSession('B', { load: async () => [task('B')], save: async () => {} }, () => active === 'B');
  await b.load();
  slow.resolve([task('A')]);
  await loading;
  assert.deepEqual(a.getSnapshot().tasks, []);
  assert.equal(b.getSnapshot().tasks[0].id, 'B');
});

test('queued stale edits are rejected; an already accepted write stays bound to its original account', async () => {
  const started = deferred(), saved = deferred();
  const owners = [];
  let active = true;
  const a = new TaskSession('A', { load: async () => [], save: async (_tasks, userId) => {
    owners.push(userId); started.resolve(); await saved.promise;
  } }, () => active);
  await a.load();
  const first = a.mutate(() => [task('first')]);
  const second = a.mutate(tasks => [...tasks, task('second')]);
  // Attach rejection handlers before allowing the asynchronous operations to settle.
  const failures = Promise.all([assert.rejects(first), assert.rejects(second)]);
  await started.promise;
  active = false;
  a.deactivate();
  saved.resolve();
  await failures;
  assert.deepEqual(owners, ['A']);
  assert.deepEqual(a.getSnapshot().tasks, []);
});

test('StrictMode setup/cleanup/setup cannot publish the obsolete first load', async () => {
  const old = deferred();
  let calls = 0;
  const session = new TaskSession('A', { load: () => ++calls === 1 ? old.promise : Promise.resolve([task('new')]), save: async () => {} });
  const first = session.load();
  session.deactivate();
  await session.load();
  old.resolve([task('old')]);
  await first;
  assert.equal(session.getSnapshot().tasks[0].id, 'new');
});

test('logged-out sessions never load or save shared fallback files', async () => {
  const session = new TaskSession(null, { load: async () => assert.fail('Unexpected read'), save: async () => assert.fail('Unexpected write') });
  await session.load();
  await assert.rejects(session.mutate(() => [task()]));
  assert.deepEqual(session.getSnapshot().tasks, []);
});

test('retry cannot replace a pending commit with an older read result', async () => {
  const saved = deferred();
  let reads = 0;
  const session = new TaskSession('A', { load: async () => { reads++; return []; }, save: () => saved.promise });
  await session.load();
  const saving = session.mutate(() => [task()]);
  await session.load();
  assert.equal(reads, 1);
  saved.resolve();
  await saving;
  assert.equal(session.getSnapshot().tasks.length, 1);
});
