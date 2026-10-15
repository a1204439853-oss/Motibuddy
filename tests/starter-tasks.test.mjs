import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterTasks, ensureStarterTasks } from '../src/services/starterTasks.ts';
import { BusinessRepository } from '../src/services/businessRepository.ts';

const now = new Date('2026-10-15T10:00:00Z');
const user = { id: 'new-account', starterTasksVersion: 1 };
const clone = value => JSON.parse(JSON.stringify(value));
function fixture(data = { tasks: [], pet: null, achievements: [], settings: { theme: 'default' } }) {
  let stored = { schemaVersion: 1, userId: user.id, revision: 1, operations: [], data: clone(data) };
  let commits = 0, fail = false, loseReply = false;
  const repository = new BusinessRepository({
    read: async () => clone(stored),
    initialize: async () => assert.fail('onboarding must not bypass migration'),
    commit: async (owner, expected, operationId, next) => {
      assert.equal(owner, stored.userId); assert.equal(expected, stored.revision);
      if (fail) throw new Error('disk full');
      stored = { ...stored, revision: expected + 1, data: clone(next), operations: [...stored.operations, { id: operationId, baseRevision: expected }] };
      commits++;
      if (loseReply) throw new Error('reply lost');
      return clone(stored);
    },
  });
  return { repository, get stored() { return clone(stored); }, get commits() { return commits; },
    set fail(value) { fail = value; }, set loseReply(value) { loseReply = value; } };
}
test('only explicitly new registrations receive examples; old empty accounts stay empty', async () => {
  const f = fixture();
  const result = await ensureStarterTasks(f.repository, { id: user.id }, await f.repository.read(user.id), 'zh-CN', () => true, now);
  assert.equal(result.data.tasks.length, 0); assert.equal(f.commits, 0);
});
test('first sign-in saves three editable examples and completion marker in one account transaction', async () => {
  const f = fixture();
  const result = await ensureStarterTasks(f.repository, user, await f.repository.read(user.id), 'zh-CN', () => true, now);
  assert.equal(f.commits, 1); assert.equal(result.data.tasks.length, 3);
  assert.equal(result.data.settings.starterTasksVersion, 1); assert.equal(result.data.settings.theme, 'default');
  assert.equal(result.data.pet, null); assert.deepEqual(result.data.achievements, []);
  assert.ok(result.data.tasks.every(task => task.title.startsWith('[示例]') && task.status === 'pending' && task.dueDate > now));
});
test('concurrent first sign-ins do not duplicate examples or the seed commit', async () => {
  const f = fixture(), stale = await f.repository.read(user.id);
  await Promise.all([ensureStarterTasks(f.repository, user, stale, 'en-US', () => true, now), ensureStarterTasks(f.repository, user, stale, 'zh-CN', () => true, now)]);
  assert.equal(f.commits, 1); assert.equal(f.stored.data.tasks.length, 3);
});
test('deleting every example and signing in again never resurrects examples', async () => {
  const f = fixture();
  await ensureStarterTasks(f.repository, user, await f.repository.read(user.id), 'zh-CN', () => true, now);
  await f.repository.transact(user.id, data => ({ ...data, tasks: [] }), () => true);
  await ensureStarterTasks(f.repository, user, await f.repository.read(user.id), 'en-US', () => true, now);
  assert.equal(f.stored.data.tasks.length, 0); assert.equal(f.commits, 2);
});
test('an account handled by a newer onboarding version is never reseeded by this version', async () => {
  const f = fixture({ tasks: [], pet: null, achievements: [], settings: { starterTasksVersion: 2 } });
  await ensureStarterTasks(f.repository, user, await f.repository.read(user.id), 'zh-CN', () => true, now);
  assert.equal(f.commits, 0); assert.equal(f.stored.data.tasks.length, 0); assert.equal(f.stored.data.settings.starterTasksVersion, 2);
});
test('failed seed writes preserve the empty account and retry without duplicates', async () => {
  const f = fixture(), before = f.stored; f.fail = true;
  await assert.rejects(ensureStarterTasks(f.repository, user, await f.repository.read(user.id), 'en-US', () => true, now));
  assert.deepEqual(f.stored, before); f.fail = false;
  await ensureStarterTasks(f.repository, user, await f.repository.read(user.id), 'en-US', () => true, now);
  assert.equal(f.stored.data.tasks.length, 3); assert.equal(f.commits, 1);
});
test('lost acknowledgement is confirmed with the durable receipt and does not reseed', async () => {
  const f = fixture(); f.loseReply = true;
  await ensureStarterTasks(f.repository, user, await f.repository.read(user.id), 'en-US', () => true, now);
  await ensureStarterTasks(f.repository, user, await f.repository.read(user.id), 'zh-CN', () => true, now);
  assert.equal(f.commits, 1); assert.ok(f.stored.data.tasks.every(task => task.title.startsWith('[Example]')));
});
test('pre-existing tasks are retained and an obsolete or foreign session cannot seed', async () => {
  const tasks = createStarterTasks('en-US', now).slice(0, 1); tasks[0].title = 'My real task';
  const f = fixture({ tasks, pet: null, achievements: [], settings: {} });
  await ensureStarterTasks(f.repository, user, await f.repository.read(user.id), 'zh-CN', () => true, now);
  assert.deepEqual(f.stored.data.tasks, clone(tasks));
  const g = fixture();
  await assert.rejects(ensureStarterTasks(g.repository, user, await g.repository.read(user.id), 'zh-CN', () => false, now));
  await assert.rejects(ensureStarterTasks(g.repository, { ...user, id: 'other-account' }, await g.repository.read(user.id), 'zh-CN', () => true, now));
  assert.equal(g.commits, 0);
});
