import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, copyFile, rename, unlink, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { JsonFileStore } from '../src/services/jsonFileStore.ts';
import { decodeTasks } from '../src/services/taskData.ts';
import { PetRepository, decodePetArchive } from '../src/services/petRepository.ts';
import { decodePet } from '../src/services/petData.ts';
import { grantTaskReward } from '../src/services/petRewards.ts';

const task = (id = 'one') => ({
  id, title: `Task ${id}`, priority: 'medium', status: 'in-progress',
  createdAt: '2026-10-15T01:00:00.000Z', dueDate: '2026-10-16T01:00:00.000Z',
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'motibuddy-storage-test-'));
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith('motibuddy-storage-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = {
    exists: async path => {
      try { await stat(path); return true; }
      catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    },
    read: path => readFile(path, 'utf8'), write: (path, text) => writeFile(path, text, 'utf8'),
    copy: copyFile, rename, remove: unlink,
  };
  return { path: join(directory, 'tasks_accountA.json'), files, store: new JsonFileStore(files) };
}

test('missing and deliberately empty task files stay distinct and are never initialized by reading', async t => {
  const { path, files, store } = await fixture(t);
  assert.deepEqual(await store.read(path, decodeTasks), { status: 'missing' });
  assert.equal(await files.exists(path), false);
  await store.write(path, [], decodeTasks);
  assert.deepEqual(await store.read(path, decodeTasks), { status: 'ready', value: [] });
});

test('truncated JSON is rejected and neither primary nor backup is overwritten', async t => {
  const { path, files, store } = await fixture(t);
  await files.write(path, '[{"id":');
  await files.write(path + '.bak', JSON.stringify([task()]));
  await assert.rejects(store.read(path, decodeTasks), { code: 'INVALID_DATA' });
  await assert.rejects(store.write(path, [], decodeTasks), { code: 'INVALID_DATA' });
  assert.equal(await files.read(path), '[{"id":');
  assert.deepEqual(JSON.parse(await files.read(path + '.bak')), [task()]);
});

test('valid JSON with invalid shape, date, enum, or duplicate IDs is rejected without replacement', async t => {
  const { path, files, store } = await fixture(t);
  for (const value of [{}, null, [task(), task()], [{ ...task(), dueDate: 'bad-date' }], [{ ...task(), priority: 'unknown' }]]) {
    const text = JSON.stringify(value);
    await files.write(path, text);
    await assert.rejects(store.read(path, decodeTasks), { code: 'INVALID_DATA' });
    await assert.rejects(store.write(path, [], decodeTasks), { code: 'INVALID_DATA' });
    assert.equal(await files.read(path), text);
  }
});

test('read failure is propagated rather than treated as missing', async t => {
  const { path, files } = await fixture(t);
  await files.write(path, '[]');
  const store = new JsonFileStore({ ...files, read: async () => { throw new Error('Access denied'); } });
  await assert.rejects(store.read(path, decodeTasks), { code: 'READ_FAILED' });
  await assert.rejects(store.write(path, [task()], decodeTasks), { code: 'READ_FAILED' });
  assert.equal(await files.read(path), '[]');
});

test('metadata access failure is propagated rather than reported as a new account', async t => {
  const { path, files } = await fixture(t);
  const store = new JsonFileStore({ ...files, exists: async () => { throw new Error('Access denied'); } });
  await assert.rejects(store.read(path, decodeTasks), { code: 'READ_FAILED' });
});

for (const suffix of ['.bak', '.tmp', '.bak.tmp']) {
  test(`missing primary with ${suffix} requires explicit recovery and preserves the recovery file`, async t => {
    const { path, files, store } = await fixture(t);
    await files.write(path + suffix, JSON.stringify([task()]));
    await assert.rejects(store.read(path, decodeTasks), { code: 'RECOVERY_REQUIRED' });
    await assert.rejects(store.write(path, [], decodeTasks), { code: 'RECOVERY_REQUIRED' });
    assert.equal(await files.exists(path), false);
    assert.deepEqual(JSON.parse(await files.read(path + suffix)), [task()]);
  });
}

test('replacement retains the previous valid commit in a backup, including repeated replacements on Windows', async t => {
  const { path, files, store } = await fixture(t);
  await store.write(path, [task('one')], decodeTasks);
  await store.write(path, [task('two')], decodeTasks);
  await store.write(path, [task('three')], decodeTasks);
  assert.equal(JSON.parse(await files.read(path))[0].id, 'three');
  assert.equal(JSON.parse(await files.read(path + '.bak'))[0].id, 'two');
  assert.equal(await files.exists(path + '.tmp'), false);
});

test('disk-full failure while staging does not modify the saved file', async t => {
  const { path, files } = await fixture(t);
  await files.write(path, JSON.stringify([task()]));
  const store = new JsonFileStore({ ...files, write: async () => { throw new Error('Disk full'); } });
  await assert.rejects(store.write(path, [task('new')], decodeTasks), { code: 'WRITE_FAILED' });
  assert.deepEqual(JSON.parse(await files.read(path)), [task()]);
});

test('backup failure prevents primary replacement', async t => {
  const { path, files } = await fixture(t);
  await files.write(path, JSON.stringify([task()]));
  const store = new JsonFileStore({ ...files, copy: async () => { throw new Error('Backup failed'); } });
  await assert.rejects(store.write(path, [task('new')], decodeTasks), { code: 'WRITE_FAILED' });
  assert.deepEqual(JSON.parse(await files.read(path)), [task()]);
});

test('replacement failure keeps the primary and a valid backup', async t => {
  const { path, files } = await fixture(t);
  await files.write(path, JSON.stringify([task()]));
  const store = new JsonFileStore({ ...files, rename: async (source, destination) => {
    if (destination === path) throw new Error('File locked');
    await files.rename(source, destination);
  } });
  await assert.rejects(store.write(path, [task('new')], decodeTasks), { code: 'WRITE_FAILED' });
  assert.deepEqual(JSON.parse(await files.read(path)), [task()]);
  assert.deepEqual(JSON.parse(await files.read(path + '.bak')), [task()]);
});

test('failed first commit preserves staged content for recovery instead of reporting a missing profile', async t => {
  const { path, files } = await fixture(t);
  const store = new JsonFileStore({ ...files, rename: async () => { throw new Error('Interrupted'); } });
  await assert.rejects(store.write(path, [task()], decodeTasks), { code: 'WRITE_FAILED' });
  await assert.rejects(store.read(path, decodeTasks), { code: 'RECOVERY_REQUIRED' });
  assert.deepEqual(JSON.parse(await files.read(path + '.tmp')), [task()]);
});

test('queued writes capture their input and complete in order; readers wait for pending writes', async t => {
  const { path, files, store } = await fixture(t);
  const input = [task('one')];
  const first = store.write(path, input, decodeTasks);
  input[0].title = 'mutated after submission';
  const second = store.write(path, [task('two')], decodeTasks);
  const read = store.read(path, decodeTasks);
  await Promise.all([first, second]);
  assert.equal((await read).value[0].id, 'two');
  assert.equal(JSON.parse(await files.read(path + '.bak'))[0].title, 'Task one');
});

test('a failed write does not poison subsequent retries', async t => {
  const { path, files } = await fixture(t);
  await files.write(path, '[]');
  let fail = true;
  const store = new JsonFileStore({ ...files, write: async (...args) => {
    if (fail) { fail = false; throw new Error('Transient failure'); }
    await files.write(...args);
  } });
  await assert.rejects(store.write(path, [task()], decodeTasks));
  await store.write(path, [task('retry')], decodeTasks);
  assert.equal((await store.read(path, decodeTasks)).value[0].id, 'retry');
});

test('dates, reminder dates, and unknown compatible fields survive a round trip', () => {
  const decoded = decodeTasks([{ ...task(), reminders: [{ time: task().dueDate, sent: false }], custom: 'preserved' }]);
  assert.ok(decoded[0].createdAt instanceof Date);
  assert.ok(decoded[0].reminders[0].time instanceof Date);
  assert.equal(decoded[0].custom, 'preserved');
  assert.deepEqual(decodeTasks(JSON.parse(JSON.stringify(decoded))), decoded);
});

function petFixture(path, store, legacy) {
  const primary = join(dirname(path), 'pet_A.json');
  const archive = join(dirname(path), 'migration_pet_A.json');
  const adapter = {
    read: () => store.read(primary, value => decodePet(value, 'A')),
    write: (_owner, value) => store.write(primary, value, value => decodePet(value, 'A')),
    readArchive: () => store.read(archive, value => decodePetArchive(value, 'A')),
    writeArchive: (_owner, value) => store.write(archive, value, value => decodePetArchive(value, 'A')),
    getLegacy: key => legacy.get(key) ?? null,
  };
  return { primary, archive, adapter, repo: new PetRepository(adapter) };
}
const samplePet = changes => ({
  id: 'pet-A', userId: 'A', name: 'Buddy', type: 'cat', level: 1, experience: 0,
  health: 50, happiness: 50, hunger: 60, energy: 60,
  lastInteraction: '2026-10-15T01:00:00.000Z', lastFed: '2026-10-15T01:00:00.000Z',
  createdAt: '2026-10-14T01:00:00.000Z', ...changes,
});

test('real JSON file adapter migrates a pet with a raw-source archive and preserves subsequent reward receipts after restart', async t => {
  const f = await fixture(t);
  const raw = JSON.stringify(samplePet());
  const legacy = new Map([['pet_A', raw]]);
  const pets = petFixture(f.path, f.store, legacy);
  await pets.repo.load('A');
  assert.equal(JSON.parse(await f.files.read(pets.archive)).entries[0].raw, raw);
  await pets.repo.update('A', current => grantTaskReward(current, 'task-one', new Date('2026-10-15T02:00:00Z')), () => true);
  const restarted = new PetRepository(pets.adapter);
  const loaded = await restarted.load('A');
  assert.equal(loaded.pet.experience, 10);
  assert.ok(loaded.pet.taskRewardReceipts['task-one']);
  assert.equal(JSON.parse(await f.files.read(pets.primary + '.bak')).experience, 0);
  assert.equal(legacy.get('pet_A'), raw);
});

test('real JSON file adapter retains the former primary in .bak when a user resolves different pet copies', async t => {
  const f = await fixture(t);
  const pets = petFixture(f.path, f.store, new Map([['pet_A', JSON.stringify(samplePet({ happiness: 20 }))]]));
  const original = JSON.stringify(samplePet({ happiness: 80 }));
  await f.files.write(pets.primary, original);
  const conflict = await pets.repo.load('A');
  assert.equal(await f.files.read(pets.primary), original);
  await pets.repo.resolve('A', 'account-cache', conflict.revision, () => true);
  assert.equal(JSON.parse(await f.files.read(pets.primary)).happiness, 20);
  assert.equal(await f.files.read(pets.primary + '.bak'), original);
});

test('real JSON staging failure of a migration archive prevents writing a new primary', async t => {
  const f = await fixture(t);
  const files = { ...f.files, write: async (path, text) => {
    if (path.endsWith('migration_pet_A.json.tmp')) throw new Error('Backup disk full');
    await f.files.write(path, text);
  } };
  const raw = JSON.stringify(samplePet());
  const pets = petFixture(f.path, new JsonFileStore(files), new Map([['pet_A', raw]]));
  await assert.rejects(pets.repo.load('A'), { code: 'WRITE_FAILED' });
  assert.equal(await f.files.exists(pets.primary), false);
});
