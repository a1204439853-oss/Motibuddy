import { z } from 'zod';
import type { BusinessData } from './businessRepository.ts';

const iso = z.string().datetime({ offset: true });
export const focusConfigSchema = z.object({ focusMinutes: z.number().int().min(1).max(180), breakMinutes: z.number().int().min(1).max(60), cycles: z.number().int().min(1).max(12) }).strict();
export const focusSessionSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), startedAt: iso, updatedAt: iso,
  config: focusConfigSchema, phase: z.enum(['focus', 'break', 'complete']),
  phaseStartedAt: iso, phaseEndAt: iso, focusMs: z.number().int().nonnegative(),
  completedCycles: z.number().int().min(0).max(12), quoteOffset: z.number().int().min(0).max(4),
  endedAt: iso.optional(), reason: z.enum(['completed', 'exited', 'interrupted']).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.completedCycles > value.config.cycles || value.focusMs > value.config.focusMinutes * value.config.cycles * 60000 || +new Date(value.updatedAt) < +new Date(value.startedAt) || +new Date(value.phaseEndAt) < +new Date(value.phaseStartedAt) || (!!value.endedAt !== !!value.reason) || (value.phase === 'complete') !== !!value.endedAt) ctx.addIssue({ code: 'custom', message: 'Invalid focus progress' });
});
export const focusJournalSchema = z.object({ version: z.literal(1), history: z.array(focusSessionSchema).max(50000), active: focusSessionSchema.nullable() }).strict().superRefine((value, ctx) => {
  if (new Set(value.history.map(session => session.id)).size !== value.history.length || value.history.some(session => !session.endedAt) || value.active && (value.active.endedAt || value.history.some(session => session.id === value.active!.id))) ctx.addIssue({ code: 'custom', message: 'Invalid focus history' });
});
export type FocusConfig = z.infer<typeof focusConfigSchema>;
export type FocusSession = z.infer<typeof focusSessionSchema>;
export type FocusJournal = z.infer<typeof focusJournalSchema>;
export const emptyFocusJournal = (): FocusJournal => ({ version: 1, history: [], active: null });
export function decodeFocusJournal(value: unknown): FocusJournal { return value === undefined ? emptyFocusJournal() : focusJournalSchema.parse(value); }

export function startFocus(config: FocusConfig, now: Date, id = crypto.randomUUID(), quoteOffset = 0): FocusSession {
  const parsed = focusConfigSchema.parse(config);
  return focusSessionSchema.parse({ id, config: parsed, startedAt: now.toISOString(), updatedAt: now.toISOString(), phase: 'focus', phaseStartedAt: now.toISOString(), phaseEndAt: new Date(+now + parsed.focusMinutes * 60000).toISOString(), focusMs: 0, completedCycles: 0, quoteOffset });
}
/** At most one transition per observation: never invent unattended cycles after sleep/restart. */
export function advanceFocus(session: FocusSession, date: Date): FocusSession {
  if (session.endedAt) return session;
  const now = Math.max(+date, +new Date(session.updatedAt)), end = +new Date(session.phaseEndAt);
  const next = { ...session, updatedAt: new Date(now).toISOString() };
  if (session.phase === 'focus') next.focusMs += Math.max(0, Math.min(now, end) - +new Date(session.updatedAt));
  if (now < end) return next;
  if (session.phase === 'focus') {
    next.completedCycles++;
    next.phase = 'break';
    next.phaseStartedAt = next.updatedAt;
    next.phaseEndAt = new Date(now + session.config.breakMinutes * 60000).toISOString();
  } else if (session.phase === 'break' && session.completedCycles < session.config.cycles) {
    next.phase = 'focus'; next.phaseStartedAt = next.updatedAt;
    next.phaseEndAt = new Date(now + session.config.focusMinutes * 60000).toISOString();
  } else { next.phase = 'complete'; next.endedAt = next.updatedAt; next.reason = 'completed'; }
  return focusSessionSchema.parse(next);
}
export function finishFocus(session: FocusSession, now: Date, reason: 'exited' | 'interrupted'): FocusSession {
  if (session.endedAt) return session;
  // Recovery credits only the last durable checkpoint, never time while the app was closed.
  const next = reason === 'interrupted' ? session : advanceFocus(session, now);
  return { ...next, phase: 'complete', endedAt: next.updatedAt, reason: next.reason ?? reason };
}
export function saveFocusProgress(data: BusinessData, incoming: FocusSession): BusinessData {
  const session = focusSessionSchema.parse(incoming), journal = decodeFocusJournal(data.settings.focusSpace);
  if (journal.history.some(old => old.id === session.id)) return data;
  if (journal.active && journal.active.id !== session.id) throw new Error('Another focus session is already active');
  if (journal.active && (session.focusMs < journal.active.focusMs || session.completedCycles < journal.active.completedCycles || +new Date(session.updatedAt) < +new Date(journal.active.updatedAt) || session.startedAt !== journal.active.startedAt || JSON.stringify(session.config) !== JSON.stringify(journal.active.config))) throw new Error('Stale focus progress');
  const focusSpace = focusJournalSchema.parse(session.endedAt ? { ...journal, active: null, history: [...journal.history, session] } : { ...journal, active: session });
  return { ...data, settings: { ...data.settings, focusSpace } };
}
export function focusTotals(journal: FocusJournal) {
  const sessions = [...journal.history, ...(journal.active ? [journal.active] : [])];
  return { focusMs: sessions.reduce((sum, session) => sum + session.focusMs, 0), completedCycles: sessions.reduce((sum, session) => sum + session.completedCycles, 0), entries: sessions.length, lastStartedAt: sessions[sessions.length - 1]?.startedAt ?? null };
}
