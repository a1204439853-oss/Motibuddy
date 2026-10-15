export interface SessionStamp { userId: string; token: string }
interface Cache {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

export function readSessionStamp(cache: Cache): SessionStamp | null {
  try {
    const stamp = JSON.parse(cache.getItem('activeSession') ?? 'null');
    if (!stamp || typeof stamp.token !== 'string' || !stamp.token || stamp.token.length > 128 || typeof stamp.userId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(stamp.userId) || stamp.userId !== cache.getItem('currentUserId')) return null;
    return { userId: stamp.userId, token: stamp.token };
  } catch { return null; }
}

/** Invalidate disposable cross-window state; never delete legacy migration sources. */
export function clearRuntimeSession(cache: Cache): void {
  for (const key of ['activeSession', 'currentUserId', 'widget_data', 'widget_pet_data', 'interaction_data', 'pet_show_completed', 'pet_show_overdue', 'task_overdue']) cache.removeItem(key);
}
