import test from 'node:test';
import assert from 'node:assert/strict';
import { BusinessRepository, decodeBusinessSnapshot } from '../src/services/businessRepository.ts';
import { completeBusinessTask, reopenBusinessTask, interactBusinessPet, markBusinessOverdue } from '../src/services/businessActions.ts';
import { WriteBarrier } from '../src/services/writeBarrier.ts';
import { TaskSession } from '../src/services/taskSession.ts';
import { checkLegacyBusinessCaches } from '../src/services/businessMigration.ts';

const now = new Date('2026-10-15T10:00:00Z');
const task = id => ({ id, title: id, priority: 'medium', status: 'in-progress', createdAt: new Date('2026-10-15'), dueDate: new Date('2026-10-16') });
const initial = () => ({ tasks: [task('one'), task('two')], achievements: [], settings: { theme: 'dark' },
  pet: { id: 'pet', userId: 'A', name: 'Buddy', type: 'cat', level: 1, experience: 0, health: 70, happiness: 50, hunger: 80, energy: 80, createdAt: now, lastFed: now, lastInteraction: now } });
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture() {
  let stored = { schemaVersion: 1, userId: 'A', revision: 1, operations: [], data: initial() };
  const commits = [];
  const persistence = {
    read: async () => clone(stored),
    initialize: async (_owner, data) => (stored = { ...stored, data: clone(data) }),
    commit: async (_owner, expected, id, data) => {
      assert.equal(expected, stored.revision, 'optimistic revision must be current');
      stored = { ...stored, revision: expected + 1, data: clone(data), operations: [...stored.operations, { id, baseRevision: expected }] };
      commits.push(clone(stored)); return clone(stored);
    },
  };
  return { persistence, commits, get stored() { return clone(stored); }, replace: value => { stored = clone(value); } };
}

test('completion commits the task, pet receipt and achievement in a single persistence call', async () => {
  const f = fixture(); const repository = new BusinessRepository(f.persistence);
  const saved = await repository.transact('A', data => completeBusinessTask(data, 'one', now), () => true);
  assert.equal(f.commits.length, 1); assert.equal(saved.data.tasks[0].status, 'completed');
  assert.equal(saved.data.pet.experience, 10); assert.ok(saved.data.pet.taskRewardReceipts.one);
  assert.equal(saved.data.achievements[0].type, 'first_task'); assert.equal(saved.data.settings.theme, 'dark');
  await repository.transact('A', data => completeBusinessTask(data, 'one', now), () => true);
  assert.equal(f.commits.length, 1);
});

test('failed whole-account commit leaves task, pet, limits and achievements unchanged', async () => {
  const f = fixture(); const before = f.stored;
  f.persistence.commit = async () => { throw new Error('disk full'); };
  const repository = new BusinessRepository(f.persistence);
  await assert.rejects(repository.transact('A', data => completeBusinessTask(data, 'one', now), () => true), /could not be confirmed/);
  assert.deepEqual(f.stored, before);
});

test('lost acknowledgement is resolved using the durable receipt without a second commit', async () => {
  const f = fixture(); const commit = f.persistence.commit;
  f.persistence.commit = async (...args) => { await commit(...args); throw new Error('IPC reply lost'); };
  const repository = new BusinessRepository(f.persistence);
  const saved = await repository.transact('A', data => interactBusinessPet(data, 'feed', now), () => true, 'request-one');
  assert.equal(saved.data.settings.petInteractions.feedCount2Hour, 1); assert.equal(f.commits.length, 1);
});

test('unreadable acknowledgement outcome is reported as unknown and is never automatically resent', async () => {
  const f = fixture(); const commit = f.persistence.commit; let unavailable = false;
  const read = f.persistence.read;
  f.persistence.read = async () => { if (unavailable) throw new Error('read denied'); return read(); };
  f.persistence.commit = async (...args) => { await commit(...args); unavailable = true; throw new Error('IPC reply lost'); };
  const repository = new BusinessRepository(f.persistence);
  await assert.rejects(repository.transact('A', data => interactBusinessPet(data, 'play', now), () => true));
  assert.equal(f.commits.length, 1); assert.equal(f.stored.data.settings.petInteractions.playCount2Hour, 1);
});

test('queued completion, feeding and another completion transform the newest whole snapshot', async () => {
  const f = fixture(); const repository = new BusinessRepository(f.persistence);
  await Promise.all([
    repository.transact('A', data => completeBusinessTask(data, 'one', now), () => true),
    repository.transact('A', data => interactBusinessPet(data, 'feed', now), () => true),
    repository.transact('A', data => completeBusinessTask(data, 'two', now), () => true),
  ]);
  const data = (await repository.read('A')).data;
  assert.equal(data.tasks.filter(task => task.status === 'completed').length, 2);
  assert.equal(data.pet.experience, 20); assert.equal(data.pet.hunger, 50);
  assert.equal(data.achievements.length, 1); assert.equal(data.settings.petInteractions.feedCount2Hour, 1);
  assert.deepEqual(f.commits.map(value => value.revision), [2, 3, 4]);
});

test('reopening after restart compensates its reward without erasing subsequent feeding', async () => {
  const f = fixture(); let repository = new BusinessRepository(f.persistence);
  await repository.transact('A', data => completeBusinessTask(data, 'one', now), () => true);
  await repository.transact('A', data => interactBusinessPet(data, 'feed', now), () => true);
  repository = new BusinessRepository(f.persistence);
  const data = (await repository.transact('A', data => reopenBusinessTask(data, 'one', now), () => true)).data;
  assert.equal(data.tasks[0].status, 'in-progress'); assert.equal(data.tasks[0].completedAt, undefined);
  assert.equal(data.pet.experience, 0); assert.equal(data.pet.hunger, 60);
  assert.equal(data.pet.taskRewardReceipts.one, undefined); assert.equal(data.settings.petInteractions.feedCount2Hour, 1);
});

test('feeding cannot save progress without its quota or exceed the shared limit', async () => {
  const f = fixture(); const repository = new BusinessRepository(f.persistence);
  await repository.transact('A', data => interactBusinessPet(data, 'feed', now), () => true);
  await repository.transact('A', data => interactBusinessPet(data, 'feed', now), () => true);
  const previous = f.stored;
  await assert.rejects(repository.transact('A', data => interactBusinessPet(data, 'feed', now), () => true), /full/);
  assert.deepEqual(f.stored, previous); assert.equal(f.commits.length, 2);
});

test('replayed widget request after repository restart does not spend another quota', async () => {
  const f = fixture(); let repository = new BusinessRepository(f.persistence);
  await repository.transact('A', data => interactBusinessPet(data, 'feed', now), () => true, 'widget-request');
  repository = new BusinessRepository(f.persistence);
  await repository.transact('A', () => assert.fail('duplicate must not execute the transformation'), () => true, 'widget-request');
  assert.equal(f.commits.length, 1); assert.equal(f.stored.data.settings.petInteractions.feedCount2Hour, 1);
});

test('overdue statuses and the existing batch penalty commit together and are not repeated', async () => {
  const f = fixture(); const repository = new BusinessRepository(f.persistence);
  const later = new Date('2026-10-17');
  const saved = await repository.transact('A', data => markBusinessOverdue(data, later), () => true);
  assert.ok(saved.data.tasks.every(task => task.status === 'overdue')); assert.equal(saved.data.pet.health, 50);
  await repository.transact('A', data => markBusinessOverdue(data, later), () => true);
  assert.equal(f.commits.length, 1);
});

test('queued work invalidated by logout never submits a later commit', async () => {
  const f = fixture(); const waiting = deferred(); const commit = f.persistence.commit; let active = true;
  f.persistence.commit = async (...args) => { await waiting.promise; return commit(...args); };
  const repository = new BusinessRepository(f.persistence);
  const first = repository.transact('A', data => completeBusinessTask(data, 'one', now), () => active);
  const second = repository.transact('A', data => completeBusinessTask(data, 'two', now), () => active);
  const outcomes = Promise.allSettled([first, second]);
  await new Promise(resolve => setImmediate(resolve)); active = false; waiting.resolve();
  assert.ok((await outcomes).every(outcome => outcome.status === 'rejected'));
  assert.equal(f.commits.length, 1); assert.equal(f.stored.data.tasks[1].status, 'in-progress');
});

test('revision conflict refreshes the visible snapshot without overwriting or retrying', async () => {
  const f = fixture(); const repository = new BusinessRepository(f.persistence); const published = [];
  repository.subscribe(snapshot => published.push(snapshot));
  f.persistence.commit = async () => {
    const other = f.stored; other.revision = 2; other.data.settings.theme = 'other-writer'; f.replace(other);
    throw new Error('REVISION_CONFLICT');
  };
  await assert.rejects(repository.transact('A', data => completeBusinessTask(data, 'one', now), () => true));
  assert.equal(published.at(-1).data.settings.theme, 'other-writer'); assert.equal(f.commits.length, 0);
});

test('a throwing view subscriber cannot turn a confirmed save into a failed save', async () => {
  const f = fixture(); const repository = new BusinessRepository(f.persistence);
  const oldError = console.error; console.error = () => {};
  try {
    repository.subscribe(() => { throw new Error('view crashed'); });
    assert.equal((await repository.transact('A', data => completeBusinessTask(data, 'one', now), () => true)).revision, 2);
  } finally { console.error = oldError; }
});

test('unsupported versions, other owners and invalid operation histories fail closed', () => {
  const f = fixture();
  for (const modified of [ { schemaVersion: 2 }, { userId: 'B' }, { operations: [{ id: 'one', baseRevision: 1 }] } ]) {
    assert.throws(() => decodeBusinessSnapshot({ ...f.stored, ...modified }, 'A'));
  }
});

test('exit barrier waits for previously admitted work and blocks new writes', async () => {
  const barrier = new WriteBarrier(); const pending = deferred(); const operation = barrier.run(() => pending.promise);
  let closed = false; const close = barrier.closeAndDrain().then(() => { closed = true; });
  await assert.rejects(barrier.run(async () => {}), /closing/); assert.equal(closed, false);
  pending.resolve(); await operation; await close; assert.equal(closed, true);
});

test('exit barrier includes queued account changes and cancels exit if a save fails', async () => {
  const f = fixture(); const waiting = deferred(); const commit = f.persistence.commit;
  f.persistence.commit = async (...args) => { await waiting.promise; return commit(...args); };
  const barrier = new WriteBarrier(); const repository = new BusinessRepository(f.persistence, barrier);
  const first = repository.transact('A', data => completeBusinessTask(data, 'one', now), () => true);
  const second = repository.transact('A', data => completeBusinessTask(data, 'two', now), () => true);
  const close = barrier.closeAndDrain(); waiting.resolve();
  await Promise.all([first, second, close]); assert.equal(f.commits.length, 2);
  barrier.resume();
  const failure = barrier.run(async () => { throw new Error('disk full'); });
  const failedClose = barrier.closeAndDrain(); await assert.rejects(failure); await assert.rejects(failedClose, /cancelled/);
  barrier.resume(); await barrier.run(async () => {});
});

test('task UI publishes completion only after the atomic account commit is acknowledged', async () => {
  const f = fixture(); const wait = deferred(); const commit = f.persistence.commit;
  f.persistence.commit = async (...args) => { await wait.promise; return commit(...args); };
  const repository = new BusinessRepository(f.persistence);
  const session = new TaskSession('A', { load: async () => initial().tasks, save: async () => assert.fail('separate task write') });
  await session.load();
  const operation = session.commit(async () => (await repository.transact('A', data => completeBusinessTask(data, 'one', now), session.isCurrent)).data.tasks);
  assert.equal(session.getSnapshot().tasks[0].status, 'in-progress'); assert.equal(session.getSnapshot().isSaving, true);
  wait.resolve(); await operation; assert.equal(session.getSnapshot().tasks[0].status, 'completed');
});

test('a late initial task load cannot replace a newer committed account snapshot', async () => {
  const waiting = deferred();
  const session = new TaskSession('A', { load: () => waiting.promise, save: async () => {} });
  const loading = session.load();
  const latest = initial(); latest.tasks[0].status = 'completed';
  session.acceptCommitted(latest.tasks);
  waiting.resolve(initial().tasks); await loading;
  assert.equal(session.getSnapshot().status, 'ready');
  assert.equal(session.getSnapshot().tasks[0].status, 'completed');
});

test('retained task or settings caches cannot be silently discarded during account migration', () => {
  const data = initial();
  const matching = new Map([['tasks_A', JSON.stringify(data.tasks)], ['settings_A', JSON.stringify(data.settings)]]);
  assert.doesNotThrow(() => checkLegacyBusinessCaches('A', data, key => matching.get(key) ?? null));
  matching.set('tasks_A', JSON.stringify([task('old-progress')]));
  assert.throws(() => checkLegacyBusinessCaches('A', data, key => matching.get(key) ?? null), /copies differ/);
  assert.throws(() => checkLegacyBusinessCaches('A', data, key => key === 'tasks' ? JSON.stringify([task('unowned')]) : null), /Unassigned/);
  assert.doesNotThrow(() => checkLegacyBusinessCaches('B', data, key => key === 'tasks_A' ? 'broken' : null));
});

test('exit drainage includes every task command queued at the account authority', async () => {
  const f = fixture(); const waiting = deferred(); const commit = f.persistence.commit;
  f.persistence.commit = async (...args) => { await waiting.promise; return commit(...args); };
  const barrier = new WriteBarrier(); const repository = new BusinessRepository(f.persistence, barrier);
  const session = new TaskSession('A', { load: async () => initial().tasks, save: async () => {} });
  await session.load();
  const finish = id => session.commit(async () => (await repository.transact('A', data => completeBusinessTask(data, id, now), session.isCurrent)).data.tasks, false);
  const first = finish('one'); const second = finish('two');
  const close = barrier.closeAndDrain(); waiting.resolve();
  await Promise.all([first, second, close]);
  assert.equal(f.commits.length, 2); assert.ok(session.getSnapshot().tasks.every(task => task.status === 'completed'));
});
