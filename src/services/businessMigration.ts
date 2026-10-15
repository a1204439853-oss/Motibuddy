import type { BusinessData } from './businessRepository.ts';
import { decodeTasks } from './taskData.ts';
import { petFingerprint } from './petData.ts';

/** Retained task/settings caches must never disappear behind a new empty authority. */
export function checkLegacyBusinessCaches(owner: string, data: BusinessData, read: (key: string) => string | null) {
  for (const kind of ['tasks', 'settings'] as const) {
    const raw = read(`${kind}_${owner}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      const value = kind === 'tasks' ? decodeTasks(parsed) : parsed;
      if (petFingerprint(value) !== petFingerprint(data[kind])) throw new Error(`Saved ${kind} copies differ. Existing sources were preserved; review them before migration.`);
    }
    const shared = read(kind);
    if (shared !== null) {
      const parsed = JSON.parse(shared);
      const empty = kind === 'tasks' ? Array.isArray(parsed) && parsed.length === 0
        : parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0;
      if (!empty) throw new Error(`Unassigned legacy ${kind} need an account-specific recovery plan before migration.`);
    }
  }
}
