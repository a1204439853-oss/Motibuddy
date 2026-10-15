import test from 'node:test';
import assert from 'node:assert/strict';
import { grantTaskReward, revokeTaskReward } from '../src/services/petRewards.ts';
import { applyPetInteraction } from '../src/services/petInteractions.ts';
import { decodePet } from '../src/services/petData.ts';
const now = new Date('2026-10-15T01:00:00Z');
const pet = (overrides = {}) => decodePet({
  id: 'pet-A', userId: 'A', name: 'Buddy', type: 'cat', level: 1, experience: 0,
  health: 50, happiness: 50, hunger: 60, energy: 60,
  lastInteraction: now, lastFed: now, createdAt: now, ...overrides,
}, 'A');

test('a reward and its receipt survive a JSON restart and cannot be applied twice', () => {
  const awarded = grantTaskReward(pet(), 'task-A', now);
  const restarted = decodePet(JSON.parse(JSON.stringify(awarded)), 'A');
  assert.deepEqual(grantTaskReward(restarted, 'task-A', now), restarted);
  assert.equal(restarted.experience, 10);
  assert.ok(restarted.taskRewardReceipts['task-A']);
});

test('undo after feeding and another completion compensates only the selected reward', () => {
  const first = grantTaskReward(pet(), 'task-A', now);
  const fed = applyPetInteraction(first, 'feed', now);
  const second = grantTaskReward(fed, 'task-B', now);
  const undone = revokeTaskReward(decodePet(JSON.parse(JSON.stringify(second)), 'A'), 'task-A', now);
  assert.equal(undone.health, 60);
  assert.equal(undone.happiness, 70);
  assert.equal(undone.hunger, 35);
  assert.equal(undone.energy, 70);
  assert.equal(undone.experience, 10);
  assert.ok(undone.taskRewardReceipts['task-B']);
  assert.equal(undone.taskRewardReceipts['task-A'], undefined);
});

test('level-up preserves surplus XP and undo respects a later completion at that level', () => {
  const first = grantTaskReward(pet({ experience: 45 }), 'task-A', now);
  assert.equal(first.level, 2);
  assert.equal(first.experience, 5);
  const second = grantTaskReward(first, 'task-B', now);
  const undone = revokeTaskReward(second, 'task-A', now);
  assert.equal(undone.level, 2);
  assert.equal(undone.experience, 5);
  const bothUndone = revokeTaskReward(undone, 'task-B', now);
  assert.equal(bothUndone.level, 1);
  assert.equal(bothUndone.experience, 45);
});

test('legacy completed tasks without receipts are reopened without invented stat deductions', () => {
  const original = pet();
  assert.deepEqual(revokeTaskReward(original, 'legacy-task', now), original);
});

test('receipt records actual capped deltas rather than deducting an unearned full reward', () => {
  const awarded = grantTaskReward(pet({ health: 98, happiness: 99, hunger: 1, energy: 2 }), 'task-A', now);
  assert.equal(awarded.taskRewardReceipts['task-A'].health, 2);
  assert.equal(awarded.taskRewardReceipts['task-A'].happiness, 1);
  assert.equal(awarded.taskRewardReceipts['task-A'].hunger, -1);
  assert.equal(awarded.taskRewardReceipts['task-A'].energy, -2);
  const undone = revokeTaskReward(awarded, 'task-A', now);
  assert.equal(undone.health, 98);
  assert.equal(undone.hunger, 1);
});

test('undo is idempotent and a deliberate recompletion receives one new reward', () => {
  const once = revokeTaskReward(grantTaskReward(pet(), 'task-A', now), 'task-A', now);
  assert.deepEqual(revokeTaskReward(once, 'task-A', now), once);
  assert.equal(grantTaskReward(once, 'task-A', now).experience, 10);
});

test('reward receipt IDs do not use inherited object properties', () => {
  const awarded = grantTaskReward(pet(), 'toString', now);
  assert.equal(awarded.experience, 10);
  assert.equal(Object.hasOwn(awarded.taskRewardReceipts, 'toString'), true);
  assert.equal(revokeTaskReward(awarded, 'toString', now).experience, 0);
});

test('invalid persisted reward receipts are rejected rather than applied', () => {
  assert.throws(() => pet({ taskRewardReceipts: { invalid: { version: 1, health: 999 } } }));
});
