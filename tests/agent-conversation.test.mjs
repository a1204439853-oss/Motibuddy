import test from 'node:test';
import assert from 'node:assert/strict';
import { planPreferences, conversationInstruction, thinkingLine, AGENT_THINKING_LINES } from '../src/services/agentConversation.ts';
import { zhCN } from '../src/i18n/messages.ts';

test('conversation extracts explicit Chinese and English time budgets without a hidden default', () => {
  for (const [text, minutes] of [['我有30分钟',30],['半小时',30],['一个半小时',90],['一小时30分钟',90],['三十分钟',30],['I have 1.5 hours',90],['45 minutes',45]]) assert.equal(planPreferences(text).minutes, minutes, text);
  assert.equal(planPreferences('先做明天到期的事情').minutes, null);
  assert.equal(planPreferences('有点累').energy, 'low');
  assert.equal(planPreferences('今天精力充沛').energy, 'high');
});
test('conversation retains the latest clarification while bounding old context', () => {
  const input = conversationInstruction(Array.from({ length: 30 }, () => ({role:'user',text:'x'.repeat(2000)})), {drafts:['y'.repeat(10000)]}, '日期改到明天');
  assert.ok(input.length <= 4000); assert.ok(input.endsWith('日期改到明天'));
});
test('pet thinking reactions use exactly the five requested lines and have Chinese translations', () => {
  const expected = ['别催别催，脑子正在加热中！','正在翻箱倒柜找答案，等我一下下','稍等哦，我去脑子里抓个小精灵','你的问题我接住啦，马上来~','叮！思考模式启动中'];
  assert.deepEqual(AGENT_THINKING_LINES.map(pair=>pair[0]), expected);
  for (let index = 0; index < 5; index++) assert.equal(zhCN[thinkingLine(()=>index/5)], expected[index]);
  assert.equal(thinkingLine(()=>0.999999), AGENT_THINKING_LINES[4][1]);
});
