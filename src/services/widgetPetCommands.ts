import { z } from 'zod';
import type { SessionStamp } from './runtimeSession.ts';

const requestSchema = z.object({
  requestId: z.string().min(1).max(128), userId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  sessionToken: z.string().min(1).max(128), action: z.enum(['feed', 'play']),
}).strict();
export type WidgetPetRequest = z.infer<typeof requestSchema>;
export interface WidgetPetResult extends WidgetPetRequest { success: boolean; message: string }

/** Fast session deduplication; execution also forwards the request ID to durable storage. */
export class WidgetPetDispatcher {
  private ownerId: string;
  private getSession: () => SessionStamp | null;
  private execute: (action: 'feed' | 'play', requestId: string) => Promise<{ success: boolean; message: string }>;
  private requests = new Map<string, { action: string; result: Promise<WidgetPetResult>; settled: boolean }>();
  constructor(ownerId: string, getSession: () => SessionStamp | null, execute: WidgetPetDispatcher['execute']) {
    this.ownerId = ownerId;
    this.getSession = getSession;
    this.execute = execute;
  }
  async handle(value: unknown): Promise<WidgetPetResult | null> {
    const parsed = requestSchema.safeParse(value);
    if (!parsed.success) return null;
    const request = parsed.data;
    const session = this.getSession();
    if (!session || request.userId !== this.ownerId || session.userId !== request.userId || session.token !== request.sessionToken) return null;
    const key = JSON.stringify([request.userId, request.sessionToken, request.requestId]);
    const existing = this.requests.get(key);
    if (existing) {
      if (existing.action !== request.action) return { ...request, success: false, message: 'The request ID was already used for another action.' };
      return existing.result;
    }
    if (this.requests.size >= 256) {
      for (const [oldKey, entry] of this.requests) {
        if (entry.settled) { this.requests.delete(oldKey); break; }
      }
    }
    if (this.requests.size >= 256) return { ...request, success: false, message: 'Too many interactions are still pending. Please wait.' };
    const result = Promise.resolve().then(async () => {
      // Recheck immediately before execution; the renderer may have logged out while queued.
      const latest = this.getSession();
      if (!latest || latest.userId !== request.userId || latest.token !== request.sessionToken) throw new Error('The account session has changed.');
      return { ...request, ...await this.execute(request.action, request.requestId) };
    }).catch(error => ({ ...request, success: false, message: error instanceof Error ? error.message : 'Pet progress could not be saved.' }));
    const record = { action: request.action, result, settled: false };
    this.requests.set(key, record);
    void result.then(() => { record.settled = true; });
    return result;
  }
}

export interface WidgetPetTransport {
  listen(handler: (payload: unknown) => void): Promise<() => void>;
  emit(request: WidgetPetRequest): Promise<void>;
}

/** Register the reply listener first. Transport delivery alone is never a save confirmation. */
export function requestWidgetPetAction(
  transport: WidgetPetTransport, request: WidgetPetRequest, isActive: () => boolean, timeoutMs = 10000,
): Promise<WidgetPetResult> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let unlisten: (() => void) | undefined;
    const timer = setTimeout(() => finish(new Error('The result could not be confirmed. Check the refreshed pet progress before trying again.')), timeoutMs);
    function finish(error?: Error, result?: WidgetPetResult) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { unlisten?.(); } catch { /* Cleanup must not lose the confirmed result. */ }
      if (error) reject(error);
      else resolve(result!);
    }
    void Promise.resolve().then(() => transport.listen(value => {
      if (!value || typeof value !== 'object') return;
      const reply = value as WidgetPetResult;
      if (reply.requestId !== request.requestId || reply.userId !== request.userId || reply.sessionToken !== request.sessionToken || reply.action !== request.action || typeof reply.success !== 'boolean' || typeof reply.message !== 'string') return;
      if (!isActive()) finish(new Error('The account session has changed.'));
      else finish(undefined, reply);
    })).then(dispose => {
      if (finished) { dispose(); return; }
      unlisten = dispose;
      if (!isActive()) { finish(new Error('The account session has changed.')); return; }
      void Promise.resolve().then(() => transport.emit(request)).catch(() => finish(new Error('The interaction result could not be confirmed. Check pet progress before trying again.')));
    }).catch(() => finish(new Error('The interaction confirmation listener could not be started.')));
  });
}
