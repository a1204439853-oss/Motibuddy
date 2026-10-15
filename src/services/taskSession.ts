import type { Task } from '../types/index.ts';
import { decodeTasks } from './taskData.ts';

export interface TaskPersistence {
  load(userId: string): Promise<Task[]>;
  save(tasks: Task[], userId: string): Promise<void>;
}

export interface TaskSnapshot {
  tasks: Task[];
  status: 'loading' | 'ready' | 'error';
  loadError: string | null;
  saveError: string | null;
  isSaving: boolean;
}

/** One account's task lifecycle. No automatic writes while loading or after a read failure. */
export class TaskSession {
  private snapshot: TaskSnapshot = {
    tasks: [], status: 'loading', loadError: null, saveError: null, isSaving: false,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private active = false;
  private pending = 0;
  private queue: Promise<unknown> = Promise.resolve();
  readonly userId: string | null;
  private readonly persistence: TaskPersistence;
  private readonly isOwnerCurrent: () => boolean;

  constructor(
    userId: string | null,
    persistence: TaskPersistence,
    isOwnerCurrent: () => boolean = () => true,
  ) {
    this.userId = userId;
    this.persistence = persistence;
    this.isOwnerCurrent = isOwnerCurrent;
  }

  getSnapshot = (): TaskSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(updates: Partial<TaskSnapshot>) {
    this.snapshot = { ...this.snapshot, ...updates };
    this.listeners.forEach(listener => listener());
  }
  isCurrent = (): boolean => this.active && this.isOwnerCurrent();
  deactivate = () => { this.active = false; this.generation++; };
  acceptCommitted = (tasks: Task[]) => {
    if (!this.isCurrent()) return;
    if (this.snapshot.status === 'loading') this.generation++;
    this.publish({ tasks: decodeTasks(tasks), status: 'ready', loadError: null });
  };

  load = async (): Promise<void> => {
    if (this.pending) return;
    this.active = true;
    const generation = ++this.generation;
    this.publish({ tasks: [], status: 'loading', loadError: null, saveError: null });
    if (!this.userId) {
      this.publish({ status: 'ready' });
      return;
    }
    try {
      const tasks = decodeTasks(await this.persistence.load(this.userId));
      if (this.isCurrent() && generation === this.generation) this.publish({ tasks, status: 'ready' });
    } catch {
      if (this.isCurrent() && generation === this.generation) {
        this.publish({ status: 'error', loadError: 'Tasks could not be read. Existing data has been preserved. Restore a backup or retry after fixing the file access problem.' });
      }
    }
  };

  mutate = (change: (tasks: Task[]) => Task[]): Promise<void> => {
    return this.commit(async () => {
      const tasks = decodeTasks(change(decodeTasks(this.snapshot.tasks)));
      if (JSON.stringify(tasks) !== JSON.stringify(this.snapshot.tasks)) await this.persistence.save(tasks, this.userId!);
      return tasks;
    });
  };

  /** Let the account authority commit associated pet/achievement changes in the same write. */
  commit = (save: () => Promise<Task[]>, queueLocally = true): Promise<void> => {
    if (!this.userId || !this.isCurrent() || this.snapshot.status !== 'ready') {
      return Promise.reject(new Error('Tasks are not available for editing. Please load this account’s data first.'));
    }
    const generation = this.generation;
    this.pending++;
    this.publish({ isSaving: true, saveError: null });
    const execute = async () => {
      if (!this.isCurrent() || generation !== this.generation) throw new Error('The account session has changed.');
      const tasks = decodeTasks(await save());
      if (!this.isCurrent() || generation !== this.generation) throw new Error('The account session has changed.');
      this.publish({ tasks, saveError: null });
    };
    // The whole-account authority already queues its transactions. Admit those immediately
    // so exit drainage also sees task commands still waiting behind another account write.
    const operation = queueLocally ? this.queue.catch(() => undefined).then(execute) : execute();
    this.queue = operation;
    return operation.catch(error => {
      if (this.isCurrent() && generation === this.generation) {
        this.publish({ saveError: 'The save could not be confirmed. Refresh the saved progress before retrying.' });
      }
      throw error;
    }).finally(() => {
      this.pending--;
      if (this.isCurrent()) this.publish({ isSaving: this.pending > 0 });
    });
  };
}
