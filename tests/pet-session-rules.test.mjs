import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionEpoch } from '../src/services/sessionEpoch.ts';
import { clearRuntimeSession, readSessionStamp } from '../src/services/runtimeSession.ts';
import { decodeInteractions, prepareInteraction, applyPetInteraction } from '../src/services/petInteractions.ts';

test('logout/new sign-in invalidates old epochs even when the same user signs in', () => {
  const epoch = new SessionEpoch();
  const first = epoch.begin();
  assert.equal(epoch.isCurrent(first), true);
  const second = epoch.begin();
  assert.throws(() => epoch.assertCurrent(first));
  epoch.assertCurrent(second);
});

test('runtime cleanup removes disposable session data and keeps users, legacy pets, and preferences', () => {
  const entries = new Map([
    ['users', '[{"id":"A"}]'], ['currentPet', 'legacy shared pet'], ['pet_A', 'legacy account pet'], ['theme', 'dark'],
    ['activeSession', '{"userId":"A","token":"old"}'], ['currentUserId', 'A'], ['widget_data', '{}'],
    ['widget_pet_data', '{}'], ['interaction_data', '{}'], ['pet_show_completed', 'true'],
  ]);
  clearRuntimeSession({ getItem: key => entries.get(key) ?? null, removeItem: key => entries.delete(key) });
  assert.deepEqual([...entries.keys()], ['users', 'currentPet', 'pet_A', 'theme']);
});

test('cross-window sessions require both an active account and a well-formed token', () => {
  const entries = new Map([['currentUserId', 'A'], ['activeSession', '{"userId":"A","token":"new"}']]);
  const cache = { getItem: key => entries.get(key) ?? null };
  assert.deepEqual(readSessionStamp(cache), { userId: 'A', token: 'new' });
  entries.set('currentUserId', 'B');
  assert.equal(readSessionStamp(cache), null);
  entries.set('activeSession', '[{');
  assert.equal(readSessionStamp(cache), null);
  entries.delete('activeSession');
  assert.equal(readSessionStamp(cache), null);
  entries.set('currentUserId', '../other');
  entries.set('activeSession', '{"userId":"../other","token":"new"}');
  assert.equal(readSessionStamp(cache), null);
});

test('feeding and playing share validated two-hour limits that survive serialization', () => {
  const now = new Date('2026-10-15T01:00:00Z');
  let data = prepareInteraction(decodeInteractions(undefined), 'feed', now);
  data = prepareInteraction(decodeInteractions(JSON.parse(JSON.stringify(data))), 'feed', now);
  assert.equal(prepareInteraction(data, 'feed', now), null);
  assert.equal(prepareInteraction(data, 'play', now).playCount2Hour, 1);
  assert.equal(prepareInteraction(data, 'feed', new Date('2026-10-15T03:00:00Z')).feedCount2Hour, 1);
  assert.equal(prepareInteraction(data, 'feed', new Date('2026-10-15T00:00:00Z')), null);
});

test('invalid interaction records are rejected rather than resetting the limit', () => {
  for (const value of [null, {}, { ...decodeInteractions(undefined), feedCount2Hour: -1 }, { ...decodeInteractions(undefined), playCount2Hour: 3 }, { ...decodeInteractions(undefined), feedWindowStart: 'bad-date' }]) {
    assert.throws(() => decodeInteractions(value));
  }
});

test('interaction commands apply deltas to the latest pet and keep its identity and bounds', () => {
  const now = new Date('2026-10-15T01:00:00Z');
  const original = { id: 'A', health: 40, happiness: 95, hunger: 10, energy: 95 };
  const fed = applyPetInteraction(original, 'feed', now);
  const played = applyPetInteraction(fed, 'play', now);
  assert.equal(fed.hunger, 0);
  assert.equal(fed.energy, 100);
  assert.equal(fed.lastFed, now);
  assert.equal(played.energy, 85);
  assert.equal(played.happiness, 100);
  assert.equal(played.health, 40);
  assert.equal(played.id, original.id);
  assert.equal(original.hunger, 10);
});
