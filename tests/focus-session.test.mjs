import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceFocus, startFocus, finishFocus, saveFocusProgress, focusTotals, decodeFocusJournal, focusConfigSchema } from '../src/services/focusSession.ts';
import { BusinessRepository } from '../src/services/businessRepository.ts';
const now = new Date('2026-10-16T08:00:00Z'), config = { focusMinutes: 1, breakMinutes: 1, cycles: 2 };
const at = seconds => new Date(+now + seconds * 1000);
const data = () => ({ tasks: [], pet: null, achievements: [], settings: {} });
test('focus counts partial seconds exactly, excludes breaks and changes quotes on the next focus cycle', () => {
  let state = startFocus(config, now, 'one');
  state = advanceFocus(state, at(25)); assert.equal(state.focusMs, 25000); assert.equal(state.completedCycles, 0);
  state = advanceFocus(state, at(60)); assert.equal(state.phase, 'break'); assert.equal(state.focusMs, 60000); assert.equal(state.completedCycles, 1);
  state = advanceFocus(state, at(90)); assert.equal(state.focusMs, 60000);
  state = advanceFocus(state, at(120)); assert.equal(state.phase, 'focus'); assert.equal(state.completedCycles, 1);
  state = advanceFocus(state, at(180)); state = advanceFocus(state, at(240));
  assert.equal(state.phase, 'complete'); assert.equal(state.focusMs, 120000); assert.equal(state.completedCycles, 2);
  assert.deepEqual(advanceFocus(state, at(10000)), state);
});
test('exiting preserves a partial focus; restarting does not count offline time or invent cycles after a long sleep', () => {
  let state = advanceFocus(startFocus(config, now, 'one'), at(17));
  const recovered = finishFocus(JSON.parse(JSON.stringify(state)), at(10000), 'interrupted');
  assert.equal(recovered.focusMs, 17000); assert.equal(recovered.endedAt, at(17).toISOString());
  const exited = finishFocus(state, at(27), 'exited'); assert.equal(exited.focusMs, 27000); assert.equal(exited.completedCycles, 0);
  const slept = advanceFocus(state, at(10000)); assert.equal(slept.focusMs, 60000); assert.equal(slept.phase, 'break'); assert.equal(slept.completedCycles, 1);
  assert.equal(+new Date(slept.phaseStartedAt), +at(10000));
  assert.equal(advanceFocus(state, at(10)).focusMs, 17000);
});
test('saved records are idempotent, monotonic and preserve all unrelated account data', () => {
  const start = startFocus(config, now, 'one'), progress = advanceFocus(start, at(30));
  const initial = { ...data(), settings: { theme: 'old' } };
  let saved = saveFocusProgress(initial, start); saved = saveFocusProgress(saved, progress);
  assert.throws(() => saveFocusProgress(saved, start)); assert.equal(saved.settings.theme, 'old');
  const ended = finishFocus(progress, at(40), 'exited'); saved = saveFocusProgress(saved, ended);
  assert.deepEqual(saveFocusProgress(saved, ended), saved); assert.deepEqual(saveFocusProgress(saved, progress), saved);
  assert.deepEqual(focusTotals(decodeFocusJournal(JSON.parse(JSON.stringify(saved.settings.focusSpace)))), { focusMs: 40000, completedCycles: 0, entries: 1, lastStartedAt: now.toISOString() });
  assert.equal(initial.settings.focusSpace, undefined);
});
test('failed atomic writes retain the old totals; the same completed record can be retried once', async () => {
  let stored = { schemaVersion: 1, userId: 'owner', revision: 1, operations: [], data: data() }, fail = true;
  const copy = value => JSON.parse(JSON.stringify(value));
  const repository = new BusinessRepository({ read: async () => copy(stored), initialize: async () => assert.fail(), commit: async (_owner, revision, id, value) => {
    if (fail) throw Error('test disk full'); assert.equal(revision, stored.revision);
    stored = { ...stored, revision: revision + 1, data: copy(value), operations: [...stored.operations, { id, baseRevision: revision }] }; return copy(stored);
  } });
  const ended = finishFocus(startFocus(config, now, 'one'), at(35), 'exited');
  await assert.rejects(repository.transact('owner', old => saveFocusProgress(old, ended), () => true));
  assert.equal(stored.data.settings.focusSpace, undefined); fail = false;
  await repository.transact('owner', old => saveFocusProgress(old, ended), () => true);
  await repository.transact('owner', old => saveFocusProgress(old, ended), () => true);
  assert.equal(stored.data.settings.focusSpace.history.length, 1); assert.equal(stored.data.settings.focusSpace.history[0].focusMs, 35000);
});
test('focus configuration, corrupt history and concurrent active sessions fail closed', () => {
  for (const value of [{ ...config, focusMinutes: 0 }, { ...config, cycles: 1.5 }, { ...config, breakMinutes: 61 }]) assert.equal(focusConfigSchema.safeParse(value).success, false);
  const start = startFocus(config, now, 'one'); const saved = saveFocusProgress(data(), start);
  assert.throws(() => saveFocusProgress(saved, startFocus(config, now, 'other')));
  assert.throws(() => decodeFocusJournal({ version: 1, history: [start], active: null }));
  assert.throws(() => saveFocusProgress(data(), { ...start, focusMs: 999999999 }));
});
