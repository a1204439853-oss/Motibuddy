import type { AgentDraft } from './agentContracts.ts';
import type { Task } from '../types/index.ts';
import { duplicateTaskKey } from './agentActions.ts';
export function draftIssues(draft: AgentDraft, tasks: Task[], now = new Date()): ('title' | 'date' | 'range' | 'duration' | 'duplicate')[] {
  const issues: ReturnType<typeof draftIssues> = [];
  if (!draft.title.trim() || draft.title.trim().length > 200) issues.push('title');
  const end = draft.dueDate ? +new Date(draft.dueDate) : NaN;
  if (!Number.isFinite(end)) issues.push('date');
  if (draft.timingMode === 'range' && (!draft.startAt || !Number.isFinite(+new Date(draft.startAt)) || +new Date(draft.startAt) >= end)) issues.push('range');
  if (draft.timingMode !== 'range' && draft.estimatedDuration !== null && (!Number.isInteger(draft.estimatedDuration) || draft.estimatedDuration < 1 || draft.estimatedDuration > 1440)) issues.push('duration');
  if (draft.dueDate && tasks.some(task => duplicateTaskKey(task.title, task.dueDate.toISOString()) === duplicateTaskKey(draft.title, draft.dueDate!))) issues.push('duplicate');
  return issues;
}
export function editAgentDraft(draft: AgentDraft, patch: Partial<AgentDraft>): AgentDraft {
  const next = { ...draft, ...patch };
  if (next.timingMode !== 'range') next.startAt = null;
  else if (next.startAt && next.dueDate) {
    const minutes = Math.round((+new Date(next.dueDate) - +new Date(next.startAt)) / 60000);
    next.estimatedDuration = minutes >= 1 && minutes <= 1440 ? minutes : null;
  }
  return next;
}
