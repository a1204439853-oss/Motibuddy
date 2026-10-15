import test from 'node:test';
import assert from 'node:assert/strict';
import { PetRepository } from '../src/services/petRepository.ts';
import { decodePet, petFingerprint } from '../src/services/petData.ts';
import { SessionEpoch } from '../src/services/sessionEpoch.ts';

const pet = (changes = {}) => ({
  id: 'pet-A', userId: 'A', name: 'Buddy', type: 'cat', level: 1, experience: 10,
  health: 50, happiness: 60, hunger: 50, energy: 70,
  lastInteraction: '2026-10-15T01:00:00.000Z', lastFed: '2026-10-15T01:00:00.000Z',
  createdAt: '2026-10-14T01:00:00.000Z', ...changes,
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function fixture({ primary, account, shared } = {}) {
  const files = new Map();
  const legacy = new Map();
  if (primary !== undefined) files.set('A', JSON.stringify(primary));
  if (account !== undefined) legacy.set('pet_A', typeof account === 'string' ? account : JSON.stringify(account));
  if (shared !== undefined) legacy.set('currentPet', typeof shared === 'string' ? shared : JSON.stringify(shared));
  const events = [];
  const adapter = {
    read: async id => files.has(id) ? { status: 'ready', value: decodePet(JSON.parse(files.get(id)), id) } : { status: 'missing' },
    write: async (id, value) => { events.push('pet'); files.set(id, JSON.stringify(value)); },
    readArchive: async id => files.has('archive-' + id) ? { status: 'ready', value: JSON.parse(files.get('archive-' + id)) } : { status: 'missing' },
    writeArchive: async (id, value) => { events.push('archive'); files.set('archive-' + id, JSON.stringify(value)); },
    getLegacy: key => legacy.get(key) ?? null,
  };
  return { files, legacy, events, adapter, repo: new PetRepository(adapter) };
}

test('legacy migration saves original cache values before the primary and leaves both source keys intact', async () => {
  const f = fixture({ account: pet(), shared: pet() });
  const sources = new Map(f.legacy);
  const loaded = await f.repo.load('A');
  assert.equal(loaded.status, 'ready');
  assert.ok(loaded.pet.lastFed instanceof Date);
  assert.deepEqual(f.events, ['archive', 'pet', 'archive']);
  assert.deepEqual(f.legacy, sources);
  const archive = JSON.parse(f.files.get('archive-A'));
  assert.equal(archive.schemaVersion, 1);
  assert.equal(archive.completed, true);
  assert.equal(archive.entries.find(entry => entry.source === 'account-cache').raw, sources.get('pet_A'));
  await f.repo.update('A', current => ({ ...current, happiness: 75 }), () => true);
  const restarted = new PetRepository(f.adapter);
  assert.equal((await restarted.load('A')).pet.happiness, 75);
});

test('different file/account/session copies require a choice without guessing by timestamps', async () => {
  const f = fixture({ primary: pet(), account: pet({ happiness: 20 }), shared: pet({ happiness: 90 }) });
  const original = f.files.get('A');
  const loaded = await f.repo.load('A');
  assert.equal(loaded.status, 'conflict');
  assert.equal(loaded.candidates.length, 3);
  assert.equal(f.files.get('A'), original);
  assert.ok(!f.events.includes('pet'));
  assert.equal(JSON.parse(f.files.get('archive-A')).entries.length, 3);
});

test('an explicit legacy choice becomes authoritative and is not overwritten by retained stale cache keys', async () => {
  const f = fixture({ primary: pet(), account: pet({ happiness: 20 }) });
  const conflict = await f.repo.load('A');
  await f.repo.resolve('A', 'account-cache', conflict.revision, () => true);
  assert.equal((await f.repo.load('A')).pet.happiness, 20);
  await f.repo.update('A', current => ({ ...current, happiness: 35 }), () => true);
  assert.equal((await new PetRepository(f.adapter).load('A')).pet.happiness, 35);
  assert.equal(JSON.parse(f.legacy.get('pet_A')).happiness, 20);
  assert.ok(JSON.parse(f.files.get('archive-A')).entries.some(entry => entry.source === 'file'));
});

test('choosing the file retains all legacy copies in the migration archive', async () => {
  const f = fixture({ primary: pet(), account: pet({ id: 'different', name: 'Other' }) });
  const conflict = await f.repo.load('A');
  await f.repo.resolve('A', 'file', conflict.revision, () => true);
  assert.equal((await f.repo.load('A')).pet.id, 'pet-A');
  assert.equal(JSON.parse(f.files.get('archive-A')).entries.find(entry => entry.source === 'account-cache').raw, f.legacy.get('pet_A'));
});

test('changed records invalidate a stale recovery choice', async () => {
  const f = fixture({ primary: pet(), account: pet({ happiness: 20 }) });
  const conflict = await f.repo.load('A');
  f.files.set('A', JSON.stringify(pet({ happiness: 80 })));
  await assert.rejects(f.repo.resolve('A', 'account-cache', conflict.revision, () => true), /changed/);
  assert.equal(JSON.parse(f.files.get('A')).happiness, 80);
});

test('backup failure prevents any migration into the primary', async () => {
  const f = fixture({ account: pet() });
  f.adapter.writeArchive = async () => { throw new Error('Backup unavailable'); };
  await assert.rejects(new PetRepository(f.adapter).load('A'), /Backup unavailable/);
  assert.equal(f.files.has('A'), false);
  assert.ok(f.legacy.has('pet_A'));
});

test('invalid legacy JSON is backed up, then blocks migration instead of producing a new pet', async () => {
  const f = fixture({ account: '[{' });
  await assert.rejects(f.repo.load('A'), /Legacy pet data is invalid/);
  assert.equal(f.files.has('A'), false);
  assert.equal(JSON.parse(f.files.get('archive-A')).entries[0].raw, '[{');
  await assert.rejects(f.repo.create('A', decodePet(pet(), 'A'), () => true));
});

test('a per-account key owned by someone else is neither migrated nor copied into this account backup', async () => {
  const f = fixture({ account: pet({ userId: 'B' }) });
  await assert.rejects(f.repo.load('A'), /wrong owner/);
  assert.equal(f.files.size, 0);
  assert.equal(f.legacy.size, 1);
});

test('shared caches belonging to another account or without readable ownership are preserved and ignored', async () => {
  for (const shared of [pet({ userId: 'B' }), '[{']) {
    const f = fixture({ shared });
    assert.deepEqual(await f.repo.load('A'), { status: 'ready', pet: null });
    assert.equal(f.files.size, 0);
    assert.ok(f.legacy.has('currentPet'));
  }
});

test('a corrupt primary cannot be replaced by a valid but stale cache', async () => {
  const f = fixture({ account: pet() });
  f.files.set('A', '[{');
  await assert.rejects(f.repo.load('A'));
  assert.equal(f.files.get('A'), '[{');
  assert.deepEqual(f.events, []);
});

test('a missing acknowledged primary is not resurrected from old cache data', async () => {
  const f = fixture({ account: pet() });
  await f.repo.load('A');
  f.files.delete('A');
  await assert.rejects(f.repo.load('A'), /saved pet is missing/);
  assert.equal(f.files.has('A'), false);
});

test('interruption after the primary commit but before the completion marker can be retried safely', async () => {
  const f = fixture({ account: pet() });
  const write = f.adapter.writeArchive;
  let fail = true;
  f.adapter.writeArchive = async (id, archive) => {
    if (archive.completed && fail) { fail = false; throw new Error('Completion interrupted'); }
    await write(id, archive);
  };
  const repo = new PetRepository(f.adapter);
  await assert.rejects(repo.load('A'), /Completion interrupted/);
  assert.ok(f.files.has('A'));
  assert.equal(JSON.parse(f.files.get('archive-A')).completed, false);
  assert.equal((await repo.load('A')).status, 'ready');
  assert.equal(JSON.parse(f.files.get('archive-A')).completed, true);
  assert.equal(f.legacy.size, 1);
});

test('queued updates recompute against the latest saved pet instead of overwriting whole stale snapshots', async () => {
  const f = fixture({ primary: pet() });
  await Promise.all(Array.from({ length: 10 }, () => f.repo.update('A', current => ({ ...current, experience: current.experience + 1 }), () => true)));
  assert.equal((await f.repo.load('A')).pet.experience, 20);
});

test('creation commits to the same authority used by login and cannot overwrite an existing pet', async () => {
  const f = fixture();
  await f.repo.create('A', decodePet(pet(), 'A'), () => true);
  assert.equal(f.legacy.size, 0);
  assert.equal((await f.repo.load('A')).pet.name, 'Buddy');
  await assert.rejects(f.repo.create('A', decodePet(pet({ id: 'replacement' }), 'A'), () => true), /already has pet data/);
  assert.equal(JSON.parse(f.files.get('A')).id, 'pet-A');
});

test('invalidated sessions cannot start a queued write', async () => {
  const f = fixture({ primary: pet() });
  let active = true;
  const operation = f.repo.update('A', current => ({ ...current, experience: 99 }), () => active);
  active = false;
  await assert.rejects(operation, /session has changed/);
  assert.deepEqual(f.events, []);
});

test('logout during the migration backup prevents a subsequent primary write', async () => {
  const f = fixture({ account: pet() });
  const started = deferred(), finish = deferred();
  let active = true;
  const write = f.adapter.writeArchive;
  f.adapter.writeArchive = async (...args) => { await write(...args); started.resolve(); await finish.promise; };
  const operation = new PetRepository(f.adapter).load('A', () => active);
  const failure = assert.rejects(operation, /session has changed/);
  await started.promise;
  active = false;
  finish.resolve();
  await failure;
  assert.equal(f.files.has('A'), false);
  assert.ok(f.files.has('archive-A'));
});

test('an already accepted old write remains on its owner and cannot return a publishable success after logout', async () => {
  const f = fixture({ primary: pet() });
  await f.repo.load('A');
  const started = deferred(), finish = deferred();
  const write = f.adapter.write;
  let active = true;
  f.adapter.write = async (...args) => { started.resolve(); await finish.promise; await write(...args); };
  const operation = new PetRepository(f.adapter).update('A', current => ({ ...current, experience: 55 }), () => active);
  const failure = assert.rejects(operation, /session has changed/);
  await started.promise;
  active = false;
  finish.resolve();
  await failure;
  assert.equal(JSON.parse(f.files.get('A')).experience, 55);
  assert.equal(f.files.has('B'), false);
});

test('signing into the same account again invalidates its previous lifecycle token', async () => {
  const f = fixture({ primary: pet() });
  const epoch = new SessionEpoch();
  const old = epoch.begin();
  epoch.begin();
  await assert.rejects(f.repo.update('A', current => ({ ...current, experience: 99 }), () => epoch.isCurrent(old)), /session has changed/);
  assert.equal(JSON.parse(f.files.get('A')).experience, 10);
});

test('updates reject changed owners, identities and malformed dates without changing the primary', async () => {
  const f = fixture({ primary: pet() });
  const original = f.files.get('A');
  for (const changes of [{ userId: 'B' }, { id: 'replacement' }, { lastFed: 'invalid' }, { health: 999 }]) {
    await assert.rejects(f.repo.update('A', current => ({ ...current, ...changes }), () => true));
    assert.equal(f.files.get('A'), original);
  }
});

test('equivalent field order and date serialization do not produce a false conflict', async () => {
  const reversed = Object.fromEntries(Object.entries(pet()).reverse());
  const f = fixture({ primary: pet(), account: reversed });
  assert.equal((await f.repo.load('A')).status, 'ready');
  assert.equal(petFingerprint(pet()), petFingerprint(decodePet(reversed, 'A')));
});

test('changes to a previously migrated legacy source require review and are not silently ignored', async () => {
  const f = fixture({ account: pet() });
  await f.repo.load('A');
  f.legacy.set('pet_A', JSON.stringify(pet({ happiness: 99 })));
  const loaded = await f.repo.load('A');
  assert.equal(loaded.status, 'conflict');
  assert.equal(JSON.parse(f.files.get('A')).happiness, 60);
  assert.equal(JSON.parse(f.files.get('archive-A')).entries.filter(entry => entry.source === 'account-cache').length, 2);
});

test('migration archives with the wrong owner or unsupported schema fail closed', async () => {
  for (const archive of [{ schemaVersion: 1, userId: 'B', completed: false, entries: [] }, { schemaVersion: 2, userId: 'A', completed: false, entries: [] }]) {
    const f = fixture({ primary: pet() });
    f.files.set('archive-A', JSON.stringify(archive));
    await assert.rejects(f.repo.load('A'));
    assert.deepEqual(f.events, []);
  }
});
