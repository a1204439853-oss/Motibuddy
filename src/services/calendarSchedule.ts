import type { Task } from '../types/index.ts';
export function localDay(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
export function shiftDay(date: Date, days: number): Date { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
export function weekStart(date: Date): Date { const day = localDay(date); return shiftDay(day, -((day.getDay() + 6) % 7)); }
export type CalendarEvent = { task: Task; start: number; end: number; lane: number; lanes: number; continuesBefore: boolean; continuesAfter: boolean };
/** Split ranges at local midnight, then allocate overlaps separate lanes. Deadlines have no invented duration. */
export function calendarDay(tasks: Task[], day: Date): { deadlines: Task[]; events: CalendarEvent[] } {
  const begin = localDay(day), finish = shiftDay(begin, 1);
  const deadlines = tasks.filter(task => task.timingMode !== 'range' && task.dueDate >= begin && task.dueDate < finish).sort((a, b) => +a.dueDate - +b.dueDate);
  const minutes = (date: Date) => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const events = tasks.filter(task => task.timingMode === 'range' && task.startAt && task.startAt < finish && task.dueDate > begin).map(task => ({
    task, start: task.startAt! < begin ? 0 : minutes(task.startAt!), end: task.dueDate >= finish ? 1440 : minutes(task.dueDate),
    lane: 0, lanes: 1, continuesBefore: task.startAt! < begin, continuesAfter: task.dueDate > finish,
  })).sort((a, b) => a.start - b.start || b.end - a.end);
  let group: CalendarEvent[] = [], ends: number[] = [], groupEnd = -1;
  const complete = () => { for (const event of group) event.lanes = ends.length; group = []; ends = []; };
  for (const event of events) {
    if (event.start >= groupEnd) complete();
    let lane = ends.findIndex(end => end <= event.start);
    if (lane === -1) lane = ends.length;
    ends[lane] = event.end; event.lane = lane; group.push(event); groupEnd = Math.max(groupEnd, event.end);
  }
  complete(); return { deadlines, events };
}
