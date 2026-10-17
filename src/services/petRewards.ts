import type { Pet, TaskRewardReceipt } from '../types/index.ts';

const bound = (value: number) => Math.max(0, Math.min(100, value));
const totalExperience = (pet: Pet) => 25 * pet.level * (pet.level - 1) + pet.experience;
export function grantExperience(pet: Pet, amount: number): Pet {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('Invalid experience reward');
  return { ...pet, ...progression(totalExperience(pet) + amount) };
}
function progression(total: number): { level: number; experience: number } {
  const level = Math.max(1, Math.floor((1 + Math.sqrt(1 + 8 * Math.max(0, total) / 50)) / 2));
  return { level, experience: Math.max(0, total - 25 * level * (level - 1)) };
}
function ownsReceipt(pet: Pet, taskId: string): boolean {
  return Object.prototype.hasOwnProperty.call(pet.taskRewardReceipts ?? {}, taskId);
}

export function grantTaskReward(pet: Pet, taskId: string, now: Date): Pet {
  if (ownsReceipt(pet, taskId)) return pet;
  const next: Pet = {
    ...pet, health: bound(pet.health + 10), happiness: bound(pet.happiness + 20),
    hunger: bound(pet.hunger - 5), energy: bound(pet.energy - 10),
    ...progression(totalExperience(pet) + 10), lastInteraction: now,
  };
  // Preserve the existing level-up attribute rule, but retain surplus experience.
  if (next.level > pet.level) Object.assign(next, { health: 80, happiness: 70, energy: 90 });
  const receipt: TaskRewardReceipt = {
    version: 1, health: next.health - pet.health, happiness: next.happiness - pet.happiness,
    hunger: next.hunger - pet.hunger, energy: next.energy - pet.energy,
    experience: 10, grantedAt: now.toISOString(),
  };
  next.taskRewardReceipts = { ...pet.taskRewardReceipts, [taskId]: receipt };
  return next;
}

/** Compensate this reward only; never restore an old snapshot over later interactions. */
export function revokeTaskReward(pet: Pet, taskId: string, now: Date): Pet {
  // Old completed tasks have no trustworthy receipt. Reopen them without guessing a penalty.
  if (!ownsReceipt(pet, taskId)) return pet;
  const receipt = pet.taskRewardReceipts![taskId];
  const receipts = { ...pet.taskRewardReceipts };
  delete receipts[taskId];
  return {
    ...pet, health: bound(pet.health - receipt.health), happiness: bound(pet.happiness - receipt.happiness),
    hunger: bound(pet.hunger - receipt.hunger), energy: bound(pet.energy - receipt.energy),
    ...progression(Math.max(0, totalExperience(pet) - receipt.experience)),
    lastInteraction: now, taskRewardReceipts: receipts,
  };
}
