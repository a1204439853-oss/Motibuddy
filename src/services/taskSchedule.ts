import type { Task } from '../types/index.ts';

export function taskMinutes(task: Pick<Task, 'timingMode' | 'startAt' | 'dueDate' | 'estimatedDuration'>): number | null {
  if (task.timingMode === 'range' && task.startAt) return (task.dueDate.getTime() - task.startAt.getTime()) / 60000;
  return task.estimatedDuration && task.estimatedDuration > 0 ? task.estimatedDuration : null;
}
export function compareTaskDuration(a: Task, b: Task, direction: 'asc' | 'desc' = 'asc'): number {
  const left = taskMinutes(a), right = taskMinutes(b);
  // Unspecified durations always go last in either direction.
  if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
  return (direction === 'asc' ? left - right : right - left) || a.dueDate.getTime() - b.dueDate.getTime();
}
export function timeRangePatch(mode: 'deadline' | 'range', start: string, end: string) {
  const dueDate = new Date(end), startAt = mode === 'range' ? new Date(start) : undefined;
  if (!Number.isFinite(dueDate.getTime()) || (mode === 'range' && (!startAt || !Number.isFinite(startAt.getTime()) || startAt >= dueDate))) throw new Error('End time must be after start time');
  return { timingMode: mode, startAt, dueDate };
}
