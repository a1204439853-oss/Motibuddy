import { z } from 'zod';
import type { BusinessData } from './businessRepository.ts';
import type { Task } from '../types/index.ts';
import { agentDraftSchema, agentResultSchema, type AgentDraft, type AgentPlan } from './agentContracts.ts';
import { taskConflicts, conflictApproval } from './productData.ts';

export const agentWorkspaceSchema = z.object({
  version: z.literal(1), savedAt: z.string().datetime({ offset: true }),
  result: agentResultSchema, fingerprint: z.string().max(250000),
  availableMinutes: z.number().int().min(5).max(720),
  selected: z.array(z.number().int().min(0).max(29)).max(30).optional(),
}).strict();
export type AgentWorkspace = z.infer<typeof agentWorkspaceSchema>;
export interface AgentBatch { id: string; drafts: AgentDraft[]; fingerprint: string; confirmedConflictFingerprint?: string }

export function taskFingerprint(tasks: Task[]): string {
  return JSON.stringify(tasks.filter(task => task.status !== 'completed').map(task => ({
    id: task.id, title: task.title, description: task.description ?? '', dueDate: task.dueDate.toISOString(),
    priority: task.priority, estimatedDuration: task.estimatedDuration ?? null,
    timingMode: task.timingMode ?? 'deadline', startAt: task.startAt?.toISOString() ?? null,
  })).sort((a, b) => a.id.localeCompare(b.id)));
}

export function duplicateTaskKey(title: string, dueDate: string): string {
  return `${title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()}|${Math.floor(new Date(dueDate).getTime() / 60000)}`;
}

export async function prepareAgentBatch(drafts: AgentDraft[], id: string = crypto.randomUUID()): Promise<AgentBatch> {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error('Invalid import ID.');
  const parsed = z.array(agentDraftSchema).min(1).max(30).parse(drafts);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(parsed)));
  return { id, drafts: parsed, fingerprint: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('') };
}

/** A single pure account transformation: all tasks and the retry receipt commit together. */
export function applyAgentBatch(data: BusinessData, batch: AgentBatch, now: Date): BusinessData {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(batch.id) || !/^[a-f0-9]{64}$/.test(batch.fingerprint)) throw new Error('Invalid import ID.');
  const receipts = z.record(z.string().regex(/^[a-f0-9]{64}$/)).parse(data.settings.agentImports ?? {});
  if (receipts[batch.id]) {
    if (receipts[batch.id] !== batch.fingerprint) throw new Error('This import was already saved with different contents.');
    return data;
  }
  // Never evict old receipts and resurrect deleted tasks when an old import is retried.
  if (Object.keys(receipts).length >= 512) throw new Error('Import history is full. Export your data before continuing.');
  const drafts = z.array(agentDraftSchema).min(1).max(30).parse(batch.drafts);
  const keys = new Set(data.tasks.map(task => duplicateTaskKey(task.title, task.dueDate.toISOString())));
  const tasks = drafts.map((draft, index) => {
    if (!draft.dueDate || !Number.isFinite(+new Date(draft.dueDate))) throw new Error('Every selected task needs a valid date.');
    const key = duplicateTaskKey(draft.title, draft.dueDate);
    if (keys.has(key)) throw new Error('A task with the same title and due time already exists.');
    keys.add(key);
    const id = `agent_${batch.id}_${index}`;
    if (data.tasks.some(task => task.id === id)) throw new Error('This import needs to be reviewed before retrying.');
    return { id, title: draft.title, description: draft.description, dueDate: new Date(draft.dueDate),
      timingMode: draft.timingMode ?? 'deadline', startAt: draft.timingMode === 'range' && draft.startAt ? new Date(draft.startAt) : undefined,
      priority: draft.priority, estimatedDuration: draft.timingMode === 'range' && draft.startAt ? (new Date(draft.dueDate).getTime() - new Date(draft.startAt).getTime()) / 60000 : draft.estimatedDuration ?? undefined,
      status: new Date(draft.dueDate)<now?'overdue':'pending', createdAt: now } as Task;
  });
  for(const task of tasks){
    const overlaps=taskConflicts(task,[...data.tasks,...tasks]);
    if(overlaps.length && batch.confirmedConflictFingerprint!==taskFingerprint(data.tasks))throw new Error('Review task time conflicts before importing.');
    if(overlaps.length)task.conflictApprovals=overlaps.map(other=>conflictApproval(task,other));
  }
  return { ...data, tasks: [...tasks, ...data.tasks], settings: {
    ...data.settings, agentImports: { ...receipts, [batch.id]: batch.fingerprint }, agentWorkspace: null,
  } };
}

export function saveAgentPlan(data: BusinessData, plan: AgentPlan, fingerprint: string, availableMinutes: number, now: Date): BusinessData {
  if (taskFingerprint(data.tasks) !== fingerprint) throw new Error('Tasks changed. Generate a new plan.');
  if (new Set(plan.items.map(item => item.taskId)).size !== plan.items.length || plan.items.some(item => !data.tasks.some(task => task.id === item.taskId && task.status !== 'completed')) || plan.items.reduce((sum, item) => sum + item.minutes, 0) > availableMinutes) throw new Error('Tasks changed. Generate a new plan.');
  return { ...data, settings: { ...data.settings, agentTodayPlan: { version: 1, savedAt: now.toISOString(), fingerprint, availableMinutes, plan } } };
}
