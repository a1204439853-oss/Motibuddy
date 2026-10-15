import { z } from 'zod';
import type { Pet } from '../types/index.ts';
import type { JsonRead } from './jsonFileStore.ts';
import { decodePet, petFingerprint } from './petData.ts';

export type PetSource = 'file' | 'account-cache' | 'shared-cache';
export interface PetCandidate { source: PetSource; pet: Pet }
export type PetLoad = { status: 'ready'; pet: Pet | null } | {
  status: 'conflict'; candidates: PetCandidate[]; revision: string;
};
const sourceSchema = z.enum(['file', 'account-cache', 'shared-cache']);
const archiveSchema = z.object({
  schemaVersion: z.literal(1), userId: z.string(), completed: z.boolean(),
  entries: z.array(z.object({ source: sourceSchema, raw: z.string(), capturedAt: z.string().datetime() })),
});
export type PetArchive = z.infer<typeof archiveSchema>;
export function decodePetArchive(value: unknown, userId: string): PetArchive {
  const archive = archiveSchema.parse(value);
  if (archive.userId !== userId) throw new Error('Pet backup belongs to another account.');
  return archive;
}
export interface PetPersistence {
  read(userId: string): Promise<JsonRead<Pet>>;
  write(userId: string, pet: Pet): Promise<void>;
  readArchive(userId: string): Promise<JsonRead<PetArchive>>;
  writeArchive(userId: string, archive: PetArchive): Promise<void>;
  getLegacy(key: string): string | null;
}

/** One owner-bound authority. Old cache keys are retained as recovery sources. */
export class PetRepository {
  private persistence: PetPersistence;
  private queues = new Map<string, Promise<unknown>>();
  constructor(persistence: PetPersistence) { this.persistence = persistence; }

  private serial<T>(userId: string, action: () => Promise<T>): Promise<T> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId)) return Promise.reject(new Error('Invalid account.'));
    const previous = this.queues.get(userId) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(action);
    this.queues.set(userId, operation);
    void operation.finally(() => {
      if (this.queues.get(userId) === operation) this.queues.delete(userId);
    }).catch(() => undefined);
    return operation;
  }
  private assertActive(isActive: () => boolean) {
    if (!isActive()) throw new Error('The account session has changed. Please sign in again.');
  }

  private async inspect(userId: string, isActive: () => boolean) {
    this.assertActive(isActive);
    // A corrupt primary fails closed; a stale cache must never silently replace it.
    const primary = await this.persistence.read(userId);
    const savedArchive = await this.persistence.readArchive(userId);
    this.assertActive(isActive);
    const archive = savedArchive.status === 'ready' ? decodePetArchive(savedArchive.value, userId) : {
      schemaVersion: 1 as const, userId, completed: false, entries: [],
    };
    const candidates: PetCandidate[] = [];
    const sources: { source: PetSource; raw: string }[] = [];
    if (primary.status === 'ready') {
      const pet = decodePet(primary.value, userId);
      candidates.push({ source: 'file', pet });
      sources.push({ source: 'file', raw: JSON.stringify(pet) });
    }
    const perAccount = this.persistence.getLegacy(`pet_${userId}`);
    if (perAccount !== null) sources.push({ source: 'account-cache', raw: perAccount });
    const shared = this.persistence.getLegacy('currentPet');
    if (shared !== null) {
      try {
        if (JSON.parse(shared)?.userId === userId) sources.push({ source: 'shared-cache', raw: shared });
      } catch { /* Unowned shared data is preserved in place, never adopted by another user. */ }
    }
    const legacy = sources.filter(entry => entry.source !== 'file');
    // An acknowledged migration keeps the file authoritative over unchanged stale caches.
    const knownLegacy = legacy.every(entry => archive.entries.some(old => old.source === entry.source && old.raw === entry.raw));
    if (archive.completed && knownLegacy) {
      if (primary.status === 'missing') throw new Error('The saved pet is missing. Restore its backup before continuing.');
      return { primary, archive, sources, candidates, authoritative: true };
    }
    // Validate known ownership before archiving a per-account key.
    for (const entry of legacy) {
      let raw: unknown;
      try { raw = JSON.parse(entry.raw); }
      catch { raw = undefined; }
      if (raw && typeof raw === 'object' && 'userId' in raw && raw.userId !== userId) {
        throw new Error('A legacy pet has the wrong owner. Existing records have been preserved.');
      }
    }
    let changed = false;
    for (const entry of sources) {
      if (!archive.entries.some(old => old.source === entry.source && old.raw === entry.raw)) {
        archive.entries.push({ ...entry, capturedAt: new Date().toISOString() });
        changed = true;
      }
    }
    if (changed) {
      archive.completed = false;
      this.assertActive(isActive);
      await this.persistence.writeArchive(userId, archive);
      this.assertActive(isActive);
    }
    // Backup precedes decoding/migration, so even malformed legacy JSON is recoverable.
    for (const entry of legacy) {
      try { candidates.push({ source: entry.source, pet: decodePet(JSON.parse(entry.raw), userId) }); }
      catch { throw new Error('Legacy pet data is invalid. A backup was kept; repair it before signing in.'); }
    }
    return { primary, archive, sources, candidates, authoritative: false };
  }

  private async loadNow(userId: string, isActive: () => boolean): Promise<PetLoad> {
    const inspected = await this.inspect(userId, isActive);
    if (inspected.authoritative) return { status: 'ready', pet: inspected.candidates[0].pet };
    const unique = inspected.candidates.filter((entry, index, list) =>
      list.findIndex(other => petFingerprint(other.pet) === petFingerprint(entry.pet)) === index);
    if (unique.length > 1) return { status: 'conflict', candidates: unique, revision: petFingerprint(inspected.sources) };
    if (!unique.length) {
      if (inspected.archive.entries.length) throw new Error('Pet recovery records exist. Restore the saved pet before creating another.');
      return { status: 'ready', pet: null };
    }
    const pet = unique[0].pet;
    this.assertActive(isActive);
    if (inspected.primary.status === 'missing') await this.persistence.write(userId, pet);
    this.assertActive(isActive);
    if (inspected.archive.entries.length && !inspected.archive.completed) {
      await this.persistence.writeArchive(userId, { ...inspected.archive, completed: true });
      this.assertActive(isActive);
    }
    return { status: 'ready', pet };
  }

  load(userId: string, isActive: () => boolean = () => true): Promise<PetLoad> {
    return this.serial(userId, () => this.loadNow(userId, isActive));
  }

  resolve(userId: string, source: PetSource, revision: string, isActive: () => boolean): Promise<Pet> {
    return this.serial(userId, async () => {
      const inspected = await this.inspect(userId, isActive);
      if (petFingerprint(inspected.sources) !== revision) throw new Error('Pet records changed. Sign in again to review the latest copies.');
      const selected = inspected.candidates.find(entry => entry.source === source);
      if (!selected) throw new Error('The selected pet copy is unavailable.');
      this.assertActive(isActive);
      await this.persistence.write(userId, selected.pet);
      this.assertActive(isActive);
      // A failure here blocks login. The next attempt still has the original archive.
      await this.persistence.writeArchive(userId, { ...inspected.archive, completed: true });
      this.assertActive(isActive);
      return selected.pet;
    });
  }

  create(userId: string, value: Pet, isActive: () => boolean): Promise<Pet> {
    const pet = decodePet(value, userId);
    return this.serial(userId, async () => {
      const loaded = await this.loadNow(userId, isActive);
      if (loaded.status !== 'ready' || loaded.pet) throw new Error('This account already has pet data. Restore or review it before creating another.');
      this.assertActive(isActive);
      await this.persistence.write(userId, pet);
      this.assertActive(isActive);
      return pet;
    });
  }

  update(userId: string, change: (current: Pet) => Pet, isActive: () => boolean): Promise<Pet> {
    return this.serial(userId, async () => {
      const loaded = await this.loadNow(userId, isActive);
      if (loaded.status !== 'ready' || !loaded.pet) throw new Error('Pet data is unavailable. Sign in again to recover it.');
      const pet = decodePet(change(decodePet(loaded.pet, userId)), userId);
      if (pet.id !== loaded.pet.id) throw new Error('An update cannot replace a pet identity.');
      this.assertActive(isActive);
      if (petFingerprint(pet) === petFingerprint(loaded.pet)) return loaded.pet;
      await this.persistence.write(userId, pet);
      this.assertActive(isActive);
      return pet;
    });
  }
}
