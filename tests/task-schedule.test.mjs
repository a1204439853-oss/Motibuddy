import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeTasks } from '../src/services/taskData.ts';
import { taskMinutes, compareTaskDuration, timeRangePatch } from '../src/services/taskSchedule.ts';
import { calendarDay, weekStart, shiftDay } from '../src/services/calendarSchedule.ts';
import { agentRequestSchema, validateAgentResult } from '../src/services/agentContracts.ts';
import { applyAgentBatch, prepareAgentBatch, taskFingerprint } from '../src/services/agentActions.ts';

const task = (id, start, end, extra = {}) => ({ id, title: id, priority: 'medium', status: 'pending', createdAt: new Date(2026, 9, 16), dueDate: new Date(2026, 9, 17, end), ...(start === null ? {} : { timingMode: 'range', startAt: new Date(2026, 9, 17, start) }), ...extra });
test('old deadline tasks and new range dates survive JSON decoding; invalid ranges fail closed', () => {
  const original = [task('old', null, 11), task('range', 9, 11)];
  const decoded = decodeTasks(JSON.parse(JSON.stringify(original)));
  assert.equal(decoded[0].timingMode, undefined); assert.equal(+decoded[1].startAt, +original[1].startAt);
  assert.equal(taskMinutes(decoded[1]), 120);
  for (const invalid of [{ ...original[1], startAt: undefined }, { ...original[1], startAt: original[1].dueDate }, { ...original[1], timingMode: 'deadline' }, { ...original[1], timingMode: 'unknown' }]) assert.throws(() => decodeTasks([invalid]));
  assert.throws(() => timeRangePatch('range', '2026-10-17T12:00', '2026-10-17T11:00'));
});
test('duration sorting uses actual range length and leaves unspecified estimates last in both directions', () => {
  const values = [task('unknown', null, 11), task('long', 9, 12, { estimatedDuration: 1 }), task('short', null, 11, { estimatedDuration: 20 })];
  assert.deepEqual([...values].sort((a, b) => compareTaskDuration(a, b)).map(task => task.id), ['short', 'long', 'unknown']);
  assert.deepEqual([...values].sort((a, b) => compareTaskDuration(a, b, 'desc')).map(task => task.id), ['long', 'short', 'unknown']);
});
test('calendar separates point deadlines, assigns overlapping ranges lanes and splits midnight without duplication', () => {
  const day = new Date(2026, 9, 17);
  const overnight = task('night', 23, 1, { dueDate: new Date(2026, 9, 18, 1) });
  const values = [task('deadline', null, 11), task('A', 9, 11), task('B', 10, 12), task('C', 12, 13), overnight];
  const result = calendarDay(values, day);
  assert.equal(result.deadlines.length, 1); assert.equal(result.events.length, 4);
  assert.equal(result.events[0].lanes, 2); assert.notEqual(result.events[0].lane, result.events[1].lane);
  assert.equal(result.events[2].lanes, 1);
  assert.equal(result.events[3].end, 1440); assert.equal(result.events[3].continuesAfter, true);
  const next = calendarDay(values, shiftDay(day, 1));
  assert.equal(next.events.length, 1); assert.equal(next.events[0].start, 0); assert.equal(next.events[0].end, 60);
  assert.equal(calendarDay(values, shiftDay(day, 2)).events.length, 0);
  assert.equal(weekStart(day).getDay(), 1);
});
test('assist can propose creation or chat; suggestions are disclosed and confirmed ranges import atomically', async () => {
  const now = new Date('2026-10-16T08:00:00Z');
  const request = agentRequestSchema.parse({ mode: 'assist', locale: 'zh-CN', now: now.toISOString(), timeZone: 'Asia/Shanghai', instruction: '明天去跑步', availableMinutes: 30, energy: 'normal', tasks: [], completeMissing: true });
  const value = { mode: 'create', summary: '待确认', drafts: [{ title: '跑步', description: '', dueDate: null, estimatedDuration: null, priority: 'medium' }], questions: [], warnings: [] };
  const proposed = validateAgentResult(value, request);
  assert.equal(proposed.drafts[0].dueDate, '2026-10-17T08:00:00.000Z'); assert.equal(proposed.drafts[0].estimatedDuration, 30); assert.match(proposed.warnings[0], /建议补全/);
  assert.equal(value.drafts[0].dueDate, null);
  assert.equal(validateAgentResult({ mode: 'chat', summary: '已有此任务', questions: [], warnings: [] }, request).mode, 'chat');
  const batch = await prepareAgentBatch([{ ...proposed.drafts[0], timingMode: 'range', startAt: '2026-10-17T07:00:00Z' }]);
  const before = { tasks: [], pet: null, achievements: [], settings: {} };
  const saved = applyAgentBatch(before, batch, now);
  assert.equal(before.tasks.length, 0); assert.equal(saved.tasks[0].estimatedDuration, 60); assert.equal(saved.tasks[0].timingMode, 'range');
  assert.deepEqual(applyAgentBatch(saved, batch, now), saved);
  assert.notEqual(taskFingerprint(saved.tasks), taskFingerprint([{ ...saved.tasks[0], startAt: new Date('2026-10-17T06:00:00Z') }]));
});
