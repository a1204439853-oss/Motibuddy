/** A lifecycle token, not a security credential. Invalidate synchronously on logout. */
export class SessionEpoch {
  private version = 0;
  begin(): number { return ++this.version; }
  isCurrent(version: number): boolean { return this.version === version; }
  assertCurrent(version: number): void {
    if (!this.isCurrent(version)) throw new Error('The account session has changed. Please sign in again.');
  }
}
