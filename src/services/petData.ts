import { z } from 'zod';
import type { Pet } from '../types/index.ts';

const date = z.preprocess(value => typeof value === 'string' ? new Date(value) : value, z.date());
const stat = z.number().finite().min(0).max(100);
const schema = z.object({
  id: z.string().min(1), userId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  name: z.string().min(1), type: z.enum(['cat', 'dog', 'panda', 'bird']),
  level: z.number().int().positive(), experience: z.number().finite().nonnegative(),
  health: stat, happiness: stat, hunger: stat, energy: stat,
  lastInteraction: date, lastFed: date, createdAt: date,
  taskRewardReceipts: z.record(z.object({
    version: z.literal(1), health: z.number().finite().min(-100).max(100),
    happiness: z.number().finite().min(-100).max(100), hunger: z.number().finite().min(-100).max(100),
    energy: z.number().finite().min(-100).max(100), experience: z.number().finite().nonnegative(),
    grantedAt: z.string().datetime(),
  })).optional(),
}).passthrough();

export function decodePet(value: unknown, userId: string): Pet {
  const pet = schema.parse(value);
  if (pet.userId !== userId) throw new Error('Pet ownership does not match this account.');
  return pet as Pet;
}

/** Stable comparison of persisted values, including compatible extra fields. */
export function petFingerprint(value: unknown): string {
  function canonical(item: unknown): unknown {
    if (item instanceof Date) return item.toISOString();
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, field]) => [key, canonical(field)]));
    }
    return item;
  }
  return JSON.stringify(canonical(value));
}
