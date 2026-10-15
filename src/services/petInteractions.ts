import { z } from 'zod';
import type { Pet } from '../types/index.ts';

const schema = z.object({
  feedCount2Hour: z.number().int().min(0).max(2),
  playCount2Hour: z.number().int().min(0).max(2),
  feedWindowStart: z.string().datetime().nullable(),
  playWindowStart: z.string().datetime().nullable(),
});
export type InteractionData = z.infer<typeof schema>;
export function decodeInteractions(value: unknown): InteractionData {
  return schema.parse(value === undefined ? { feedCount2Hour: 0, playCount2Hour: 0, feedWindowStart: null, playWindowStart: null } : value);
}
export function prepareInteraction(value: InteractionData, action: 'feed' | 'play', now: Date): InteractionData | null {
  const next = decodeInteractions(value);
  for (const kind of ['feed', 'play'] as const) {
    const start = kind === 'feed' ? next.feedWindowStart : next.playWindowStart;
    if (start && now.getTime() - new Date(start).getTime() >= 7200000) {
      if (kind === 'feed') { next.feedCount2Hour = 0; next.feedWindowStart = null; }
      else { next.playCount2Hour = 0; next.playWindowStart = null; }
    }
  }
  if (action === 'feed') {
    if (next.feedCount2Hour >= 2) return null;
    if (!next.feedCount2Hour) next.feedWindowStart = now.toISOString();
    next.feedCount2Hour++;
  } else {
    if (next.playCount2Hour >= 2) return null;
    if (!next.playCount2Hour) next.playWindowStart = now.toISOString();
    next.playCount2Hour++;
  }
  return next;
}
export function applyPetInteraction(pet: Pet, action: 'feed' | 'play', now: Date): Pet {
  return action === 'feed' ? {
    ...pet, hunger: Math.max(0, pet.hunger - 20), energy: Math.min(100, pet.energy + 20), lastFed: now, lastInteraction: now,
  } : {
    ...pet, happiness: Math.min(100, pet.happiness + 15), energy: Math.max(0, pet.energy - 15), lastInteraction: now,
  };
}
