import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAgentBatch, applyAgentBatch, duplicateTaskKey, taskFingerprint, saveAgentPlan } from '../src/services/agentActions.ts';
import { BusinessRepository } from '../src/services/businessRepository.ts';

const now = new Date('2026-10-15T10:00:00Z');
const draft = (title = 'Ship task') => ({ title, description: '', dueDate: '2026-10-20T12:00:00+08:00', priority: 'medium', estimatedDuration: 20 });
const data = () => ({ tasks: [], pet: null, achievements: [], settings: { language: 'zh-CN' } });
function fixture() {
  let stored = { schemaVersion: 1, userId: 'owner', revision: 1, operations: [], data: data() };
  let failure = false, loseReply = false;
  const clone = value => JSON.parse(JSON.stringify(value));
  const repository = new BusinessRepository({ read: async () => clone(stored), initialize: async () => assert.fail(),
    commit: async (owner, revision, id, next) => {
      if (failure) throw new Error('disk full');
      assert.equal(owner, 'owner'); assert.equal(revision, stored.revision);
      stored = { ...stored, revision: revision + 1, operations: [...stored.operations, { id, baseRevision: revision }], data: clone(next) };
      if (loseReply) throw new Error('reply lost');
      return clone(stored);
    } });
  return { repository, get stored() { return clone(stored); }, set failure(value) { failure = value; }, set loseReply(value) { loseReply = value; } };
}

test('a whole batch creates tasks and receipt in one transaction without changing unrelated state', async () => {
  const f = fixture(), batch = await prepareAgentBatch([draft(), draft('Second')]);
  await f.repository.transact('owner', old => applyAgentBatch(old, batch, now), () => true);
  assert.equal(f.stored.revision, 2); assert.equal(f.stored.data.tasks.length, 2);
  assert.equal(f.stored.data.settings.agentImports[batch.id], batch.fingerprint);
  assert.equal(f.stored.data.settings.language, 'zh-CN'); assert.equal(f.stored.data.settings.agentWorkspace, null);
  assert.ok(f.stored.data.tasks.every(task => task.status === 'pending'));
});
test('a write failure preserves every task and draft; retry creates the batch once', async () => {
  const f = fixture(), batch = await prepareAgentBatch([draft(), draft('Second')]);
  const before = f.stored; f.failure = true;
  await assert.rejects(f.repository.transact('owner', old => applyAgentBatch(old, batch, now), () => true));
  assert.deepEqual(f.stored, before); f.failure = false;
  await f.repository.transact('owner', old => applyAgentBatch(old, batch, now), () => true);
  await f.repository.transact('owner', old => applyAgentBatch(old, batch, now), () => true);
  assert.equal(f.stored.data.tasks.length, 2); assert.equal(f.stored.revision, 2);
});
test('lost acknowledgement does not duplicate an import', async () => {
  const f = fixture(), batch = await prepareAgentBatch([draft()]); f.loseReply = true;
  await f.repository.transact('owner', old => applyAgentBatch(old, batch, now), () => true, `agent_${batch.id}`);
  assert.equal(f.stored.data.tasks.length, 1); assert.equal(f.stored.revision, 2);
});
test('an expired session cannot import tasks', async () => {
  const f = fixture(), batch = await prepareAgentBatch([draft()]);
  await assert.rejects(f.repository.transact('owner', old => applyAgentBatch(old, batch, now), () => false));
  assert.equal(f.stored.revision, 1);
});
test('a missing date rejects the entire batch', async () => {
  const original = data();
  for (const dueDate of [null]) {
    const batch = await prepareAgentBatch([draft(), { ...draft('Invalid'), dueDate }]);
    assert.throws(() => applyAgentBatch(original, batch, now)); assert.equal(original.tasks.length, 0);
  }
});
test('duplicates within a batch and against saved tasks are rejected', async () => {
  const batch = await prepareAgentBatch([draft()]);
  const saved = applyAgentBatch(data(), batch, now);
  const duplicate = await prepareAgentBatch([{ ...draft(), title: '  SHIP  task ' }]);
  assert.throws(() => applyAgentBatch(saved, duplicate, now));
  const repeated = await prepareAgentBatch([draft(), draft()]);
  assert.throws(() => applyAgentBatch(data(), repeated, now));
  assert.equal(duplicateTaskKey('Ａ Task', '2026-10-20T12:00:00+08:00'), duplicateTaskKey('a task', '2026-10-20T04:00:30Z'));
});
test('an old retry never resurrects deleted imported tasks; changed payloads are rejected', async () => {
  const batch = await prepareAgentBatch([draft()]);
  const saved = applyAgentBatch(data(), batch, now); saved.tasks = [];
  assert.equal(applyAgentBatch(saved, batch, now), saved);
  const changed = await prepareAgentBatch([draft('Changed')], batch.id);
  assert.throws(() => applyAgentBatch(saved, changed, now));
});
test('daily plans preserve priorities and cannot save after tasks change or exceed budget', async () => {
  const batch = await prepareAgentBatch([draft()]); const saved = applyAgentBatch(data(), batch, now);
  const plan = { mode: 'plan', summary: 'Start small', items: [{ taskId: saved.tasks[0].id, minutes: 20, reason: 'Due soon', firstStep: 'Open file' }], warnings: [], questions: [] };
  const fp = taskFingerprint(saved.tasks);
  const result = saveAgentPlan(saved, plan, fp, 30, now);
  assert.deepEqual(result.tasks, saved.tasks); assert.equal(result.settings.agentTodayPlan.plan.items.length, 1);
  assert.throws(() => saveAgentPlan(saved, plan, fp, 5, now));
  saved.tasks[0].title = 'Edited'; assert.throws(() => saveAgentPlan(saved, plan, fp, 30, now));
});
