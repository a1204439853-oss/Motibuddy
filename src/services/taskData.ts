import { z } from 'zod';
import type { Task } from '../types/index.ts';

const date = z.preprocess(value => typeof value === 'string' ? new Date(value) : value, z.date());
const task = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: date,
  createdAt: date,
  completedAt: date.optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['pending', 'in-progress', 'completed', 'overdue']),
  estimatedDuration: z.number().finite().nonnegative().optional(),
  reminders: z.array(z.object({ time: date, sent: z.boolean() }).passthrough()).optional(),
}).passthrough();

const tasks = z.array(task).refine(
  values => new Set(values.map(value => value.id)).size === values.length,
  'Duplicate task IDs',
);

export function decodeTasks(value: unknown): Task[] {
  return tasks.parse(value) as Task[];
}
