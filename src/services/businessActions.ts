import type { BusinessData } from './businessRepository.ts';
import type { Task, Achievement } from '../types/index.ts';
import { grantTaskReward, revokeTaskReward } from './petRewards.ts';
import { applyPetInteraction, decodeInteractions, prepareInteraction } from './petInteractions.ts';

export function completeBusinessTask(data: BusinessData, id: string, now: Date): BusinessData {
  const task = data.tasks.find(task => task.id === id);
  if (!task || task.status === 'completed') return data;
  const achievements = data.achievements.some(value => value.type === 'first_task') ? data.achievements : [...data.achievements, {
    id: '8', type: 'first_task' as const, name: 'First Step', description: 'Complete your first task', unlockedAt: now, icon: 'fa-solid fa-flag-checkered',
  } as Achievement];
  return { ...data, tasks: data.tasks.map(task => task.id === id ? { ...task, status: 'completed', completedAt: now } as Task : task),
    pet: data.pet ? grantTaskReward(data.pet, id, now) : null, achievements };
}
export function reopenBusinessTask(data: BusinessData, id: string, now: Date): BusinessData {
  if (!data.tasks.some(task => task.id === id && task.status === 'completed')) return data;
  return { ...data, tasks: data.tasks.map(task => {
    if (task.id !== id) return task;
    const { completedAt: _completedAt, ...rest } = task;
    return { ...rest, status: 'in-progress' } as Task;
  }), pet: data.pet ? revokeTaskReward(data.pet, id, now) : null };
}
export function interactBusinessPet(data: BusinessData, action: 'feed' | 'play', now: Date): BusinessData {
  if (!data.pet) throw new Error('Pet data is unavailable.');
  const interactions = prepareInteraction(decodeInteractions(data.settings.petInteractions), action, now);
  if (!interactions) throw new Error(action === 'feed' ? "I'm full now! Let me rest for a while~" : "I'm tired from playing! Let me rest for a while~");
  return { ...data, pet: applyPetInteraction(data.pet, action, now), settings: { ...data.settings, petInteractions: interactions } };
}
export function markBusinessOverdue(data: BusinessData, now: Date): BusinessData {
  const overdue = data.tasks.filter(task => task.status !== 'completed' && task.status !== 'overdue' && task.dueDate < now);
  if (!overdue.length) return data;
  // Preserve the existing once-per-detection-batch rule until C02 defines another policy.
  return { ...data, tasks: data.tasks.map(task => overdue.some(value => value.id === task.id) ? { ...task, status: 'overdue' } as Task : task),
    pet: data.pet ? { ...data.pet, health: Math.max(0, data.pet.health - 20), happiness: Math.max(0, data.pet.happiness - 20),
      experience: Math.max(0, data.pet.experience - 10), lastInteraction: now } : null };
}
