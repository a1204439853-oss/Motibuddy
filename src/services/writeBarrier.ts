/** Includes queued work, not only file writes already in progress. */
export class WriteBarrier {
  private closing = false;
  private pending = new Set<Promise<unknown>>();
  run<T>(action: () => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new Error('The application is closing. No new changes were accepted.'));
    const operation = Promise.resolve().then(action);
    this.pending.add(operation);
    void operation.finally(() => { this.pending.delete(operation); }).catch(() => undefined);
    return operation;
  }
  async closeAndDrain(): Promise<void> {
    this.closing = true;
    const results = await Promise.allSettled([...this.pending]);
    if (results.some(result => result.status === 'rejected')) throw new Error('Pending changes could not be saved. Exit was cancelled.');
  }
  resume() { this.closing = false; }
}
export const applicationWrites = new WriteBarrier();
