import { z } from 'zod';
import type { Achievement, Pet, Task } from '../types/index.ts';
import { decodeTasks } from './taskData.ts';
import { decodePet, petFingerprint } from './petData.ts';
import { decodeInteractions } from './petInteractions.ts';
import { WriteBarrier } from './writeBarrier.ts';
import { validateProductSettings } from './productData.ts';
import {validateCompanionSettings} from './companionRecords.ts';
import {chatHistorySchema} from './assistantHistory.ts';

export interface BusinessData {
  tasks: Task[];
  pet: Pet | null;
  achievements: Achievement[];
  settings: Record<string, unknown>;
}
export interface BusinessSnapshot {
  schemaVersion: 1; userId: string; revision: number; data: BusinessData;
  operations: { id: string; baseRevision: number }[];
}
const achievements = z.array(z.object({
  id: z.string().min(1), type: z.string(), name: z.string(), description: z.string(), icon: z.string(),
  unlockedAt: z.preprocess(value => typeof value === 'string' ? new Date(value) : value, z.date()),
}).passthrough()).refine(values => new Set(values.map(value => value.id)).size === values.length);

export function decodeBusinessData(value: unknown, owner: string): BusinessData {
  const data = z.object({ tasks: z.unknown(), pet: z.unknown(), achievements: z.unknown(), settings: z.record(z.unknown()) }).strict().parse(value);
  if (data.settings.petInteractions !== undefined) decodeInteractions(data.settings.petInteractions);
  validateProductSettings(data.settings);
  validateCompanionSettings(data.settings);
  if(data.settings.chatHistory!==undefined)chatHistorySchema.parse(data.settings.chatHistory);
  return {
    tasks: decodeTasks(data.tasks), pet: data.pet === null ? null : decodePet(data.pet, owner),
    achievements: achievements.parse(data.achievements) as Achievement[], settings: data.settings,
  };
}
export function decodeBusinessSnapshot(value: unknown, owner: string): BusinessSnapshot {
  const snapshot = z.object({
    schemaVersion: z.literal(1), userId: z.literal(owner), revision: z.number().int().positive().safe(), data: z.unknown(),
    operations: z.array(z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), baseRevision: z.number().int().nonnegative().safe() })).max(128),
  }).strict().parse(value);
  if (new Set(snapshot.operations.map(operation => operation.id)).size !== snapshot.operations.length || snapshot.operations.some(operation => operation.baseRevision >= snapshot.revision)) throw new Error('Invalid operation history.');
  return { ...snapshot, data: decodeBusinessData(snapshot.data, owner) };
}

export interface BusinessPersistence {
  read(owner: string): Promise<unknown | null>;
  initialize(owner: string, data: BusinessData): Promise<unknown>;
  commit(owner: string, expected: number, operationId: string, data: BusinessData): Promise<unknown>;
}

/** Queue all account transformations together; publish only acknowledged whole snapshots. */
export class BusinessRepository {
  private tails = new Map<string, Promise<unknown>>();
  private listeners = new Set<(snapshot: BusinessSnapshot) => void>();
  private persistence: BusinessPersistence;
  private writes: WriteBarrier;
  constructor(persistence: BusinessPersistence, writes = new WriteBarrier()) { this.persistence = persistence; this.writes = writes; }
  subscribe = (listener: (snapshot: BusinessSnapshot) => void) => {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  };
  private publish(snapshot: BusinessSnapshot) {
    for (const listener of this.listeners) {
      // UI failures cannot turn a committed transaction into an apparent save failure.
      try { listener(snapshot); } catch (error) { console.error('Committed snapshot subscriber failed', error); }
    }
    return snapshot;
  }
  private serial<T>(owner: string, action: () => Promise<T>): Promise<T> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(owner)) return Promise.reject(new Error('Invalid account.'));
    const previous = this.tails.get(owner) ?? Promise.resolve();
    const operation = this.writes.run(() => previous.catch(() => undefined).then(action));
    this.tails.set(owner, operation);
    void operation.finally(() => { if (this.tails.get(owner) === operation) this.tails.delete(owner); }).catch(() => undefined);
    return operation;
  }
  async read(owner: string): Promise<BusinessSnapshot | null> {
    const value = await this.persistence.read(owner);
    return value === null ? null : decodeBusinessSnapshot(value, owner);
  }
  initialize(owner: string, data: BusinessData, isActive: () => boolean): Promise<BusinessSnapshot> {
    const captured = decodeBusinessData(data, owner);
    return this.serial(owner, async () => {
      if (!isActive()) throw new Error('The account session has changed.');
      const saved = decodeBusinessSnapshot(await this.persistence.initialize(owner, captured), owner);
      if (!isActive()) throw new Error('The account session has changed.');
      return this.publish(saved);
    });
  }
  transact(owner: string, change: (data: BusinessData) => BusinessData, isActive: () => boolean, operationId: string = crypto.randomUUID()): Promise<BusinessSnapshot> {
    return this.serial(owner, async () => {
      if (!isActive()) throw new Error('The account session has changed.');
      const previous = await this.read(owner);
      if (!previous) throw new Error('Account data must be migrated before editing.');
      if (!isActive()) throw new Error('The account session has changed.');
      if (previous.operations.some(receipt => receipt.id === operationId)) return this.publish(previous);
      const data = decodeBusinessData(change(decodeBusinessData(previous.data, owner)), owner);
      if (petFingerprint(data) === petFingerprint(previous.data)) return this.publish(previous);
      if (!isActive()) throw new Error('The account session has changed.');
      let saved: BusinessSnapshot;
      try {
        saved = decodeBusinessSnapshot(await this.persistence.commit(owner, previous.revision, operationId, data), owner);
      } catch (error) {
        // Lost IPC acknowledgement is an unknown outcome. Read the durable receipt, never resend.
        const refreshed = await this.read(owner).catch(() => null);
        const committed = refreshed?.operations.some(receipt => receipt.id === operationId && receipt.baseRevision === previous.revision);
        if (!committed) {
          if (refreshed && isActive()) this.publish(refreshed);
          throw new Error('The save could not be confirmed. Refresh the saved progress before retrying.');
        }
        saved = refreshed!;
      }
      if (!isActive()) throw new Error('The account session has changed.');
      return this.publish(saved);
    });
  }
}
