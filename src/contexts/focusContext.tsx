import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AuthContext } from './authContext';
import { businessRepository } from '@/services/storage';
import { readSessionStamp } from '@/services/runtimeSession';
import { registerExitPreparation } from '@/services/exitPreparation';
import { advanceFocus, decodeFocusJournal, emptyFocusJournal, finishFocus, focusTotals, saveFocusProgress, startFocus, type FocusConfig, type FocusJournal, type FocusSession } from '@/services/focusSession';

type FocusContextValue = { journal: FocusJournal; session: FocusSession | null; summary: FocusSession | null; loading: boolean; busy: boolean; error: boolean; start: (config: FocusConfig) => Promise<void>; exit: () => Promise<void>; retry: () => Promise<void> };
export const FocusContext = createContext<FocusContextValue>({ journal: emptyFocusJournal(), session: null, summary: null, loading: true, busy: false, error: false, start: async () => {}, exit: async () => {}, retry: async () => {} });
type Scope = { owner?: string; stamp: string; active: FocusSession | null; pending: Promise<void> | null; failed: boolean; lastSavedAt: number; savedPhase: string; loaded: boolean };
export function FocusProvider({ children }: { children: ReactNode }) {
  const { currentUser, sessionVersion } = useContext(AuthContext);
  const scope = useMemo<Scope>(() => ({ owner: currentUser?.id, stamp: JSON.stringify(readSessionStamp(localStorage)), active: null, pending: null, failed: false, lastSavedAt: 0, savedPhase: '', loaded: false }), [currentUser?.id, sessionVersion]);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const [state, setState] = useState({ scope, journal: emptyFocusJournal(), session: null as FocusSession | null, summary: null as FocusSession | null, loading: true, busy: false, error: false });
  const isCurrent = () => !!scope.owner && scopeRef.current === scope && scope.stamp === JSON.stringify(readSessionStamp(localStorage)) && readSessionStamp(localStorage)?.userId === scope.owner;
  const patch = (value: Partial<typeof state>) => { if (isCurrent()) setState(previous => ({ ...(previous.scope === scope ? previous : { scope, journal: emptyFocusJournal(), session: null, summary: null, loading: true, busy: false, error: false }), ...value })); };
  const persist = (session: FocusSession): Promise<void> => {
    let job!: Promise<void>;
    job = (async () => {
      patch({ busy: true });
      try {
        const snapshot = await businessRepository.transact(scope.owner!, data => saveFocusProgress(data, session), isCurrent);
        if (!isCurrent()) return;
        scope.lastSavedAt = Date.now();
        scope.savedPhase = `${session.phase}-${session.completedCycles}`;
        patch({ journal: decodeFocusJournal(snapshot.data.settings.focusSpace), error: false });
      } catch (error) { scope.failed = true; patch({ error: true }); throw error; }
      finally { if (scope.pending === job) scope.pending = null; patch({ busy: !!scope.pending }); }
    })();
    scope.pending = job; return job;
  };
  const complete = async (record: FocusSession) => {
    scope.active = record; patch({ session: record });
    await persist(record);
    if (isCurrent()) { scope.active = null; scope.failed = false; patch({ session: null, summary: record }); }
  };
  const exit = async () => {
    if (!isCurrent()) return;
    await scope.pending?.catch(() => {});
    if (!isCurrent() || !scope.active) return;
    await complete(finishFocus(scope.active, scope.failed ? new Date(scope.active.updatedAt) : new Date(), 'exited'));
  };
  const load = async () => {
    patch({ loading: true, error: false });
    try {
      const snapshot = await businessRepository.read(scope.owner!);
      if (!snapshot) throw new Error('Missing account');
      if (!isCurrent()) return;
      let journal = decodeFocusJournal(snapshot.data.settings.focusSpace);
      if (journal.active) {
        const recovered = finishFocus(journal.active, new Date(journal.active.updatedAt), 'interrupted');
        scope.active = recovered; await complete(recovered);
        if (!isCurrent()) return;
        const latest = await businessRepository.read(scope.owner!); journal = decodeFocusJournal(latest?.data.settings.focusSpace);
      }
      scope.loaded = true; scope.failed = false; patch({ journal, loading: false, error: false });
    } catch { scope.failed = true; patch({ loading: false, error: true }); }
  };
  useEffect(() => {
    if (scope.owner) void load();
    const unregister = registerExitPreparation(exit);
    const timer = setInterval(() => {
      if (!isCurrent() || !scope.active || scope.failed) return;
      if (scope.active.endedAt) { if (!scope.pending) void complete(scope.active).catch(() => {}); return; }
      const previous = scope.active, next = advanceFocus(previous, new Date());
      scope.active = next; patch({ session: next });
      if (!scope.pending && (`${next.phase}-${next.completedCycles}` !== scope.savedPhase || Date.now() - scope.lastSavedAt >= 10000)) {
        if (next.endedAt) void complete(next).catch(() => {});
        else void persist(next).catch(() => {});
      }
    }, 500);
    const checkpoint = () => { if (isCurrent() && scope.active && !scope.pending && !scope.failed) void persist(scope.active).catch(() => {}); };
    window.addEventListener('pagehide', checkpoint);
    document.addEventListener('visibilitychange', checkpoint);
    return () => { clearInterval(timer); unregister(); window.removeEventListener('pagehide', checkpoint); document.removeEventListener('visibilitychange', checkpoint); };
  }, [scope]);
  const start = async (config: FocusConfig) => {
    if (!isCurrent() || !scope.loaded || scope.failed || scope.active || scope.pending) return;
    const previous = state.scope === scope ? state.journal.history[state.journal.history.length - 1] : undefined;
    const record = startFocus(config, new Date(), crypto.randomUUID(), previous ? (previous.quoteOffset + previous.completedCycles + 1) % 5 : 0);
    // The dedicated screen opens only after the initial record is durable.
    await persist(record);
    if (isCurrent()) { scope.active = record; patch({ session: record, summary: null }); }
  };
  const retry = async () => {
    if (!isCurrent() || scope.pending) return;
    if (!scope.active) { await load(); return; }
    if (scope.active.endedAt) { await complete(scope.active); return; }
    const now = Date.now(), gap = Math.max(0, now - +new Date(scope.active.updatedAt));
    const resumed = { ...scope.active, updatedAt: new Date(now).toISOString(), phaseStartedAt: new Date(+new Date(scope.active.phaseStartedAt) + gap).toISOString(), phaseEndAt: new Date(+new Date(scope.active.phaseEndAt) + gap).toISOString() };
    await persist(resumed);
    if (isCurrent()) { scope.failed = false; scope.active = resumed; patch({ session: resumed, error: false }); }
  };
  const value = state.scope === scope ? state : { journal: emptyFocusJournal(), session: null, summary: null, loading: true, busy: false, error: false };
  const journal = { ...value.journal, active: value.session && !value.session.endedAt ? value.session : value.journal.active };
  return <FocusContext.Provider value={{ ...value, journal, start, exit, retry }}>{children}</FocusContext.Provider>;
}
export { focusTotals };
