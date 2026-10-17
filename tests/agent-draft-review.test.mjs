import test from 'node:test';
import assert from 'node:assert/strict';
import { draftIssues, editAgentDraft } from '../src/services/agentDraftReview.ts';
import { weeklyEvidence, agentScenarios } from '../src/services/agentScenarios.ts';
const now = new Date('2026-10-16T08:00:00Z');
test('manual correction of missing or invalid times becomes importable with the same shared validation', () => {
  const draft = { title: 'Read', description: '', dueDate: null, estimatedDuration: 30, priority: 'medium' };
  assert.deepEqual(draftIssues(draft, [], now), ['date']);
  const edited = editAgentDraft(draft, { dueDate: '2026-10-17T08:00:00Z' });
  assert.deepEqual(draftIssues(edited, [], now), []);
  const range = editAgentDraft(edited, { timingMode: 'range', startAt: '2026-10-17T07:00:00Z' });
  assert.equal(range.estimatedDuration, 60); assert.deepEqual(draftIssues(range, [], now), []);
  assert.ok(draftIssues(editAgentDraft(range, { startAt: range.dueDate }), [], now).includes('range'));
  assert.deepEqual(draftIssues(edited, [{title:edited.title,dueDate:new Date(edited.dueDate)}], now), ['duplicate']);
});
test('weekly review is derived from actual completed dates and never treats a due date as a completion', () => {
  const result = weeklyEvidence([{ status:'completed',completedAt:new Date('2026-10-16T01:00:00Z') },{status:'completed',completedAt:new Date('2026-10-01T00:00:00Z')},{status:'completed'},{status:'pending',dueDate:now}],now);
  assert.equal(result.completed,1);assert.equal(result.open,1);assert.equal(result.missingCompletionDate,1);
  assert.equal(agentScenarios.length,6);assert.equal(new Set(agentScenarios.map(item=>item.id)).size,6);
});
