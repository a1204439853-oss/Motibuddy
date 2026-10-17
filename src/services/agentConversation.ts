export const AGENT_THINKING_LINES = [
  ['别催别催，脑子正在加热中！', "Hold on, my brain is warming up!"],
  ['正在翻箱倒柜找答案，等我一下下', "Rummaging around for an answer. Give me a moment!"],
  ['稍等哦，我去脑子里抓个小精灵', "One moment, I'm catching a little idea sprite!"],
  ['你的问题我接住啦，马上来~', "Got your question! Be right with you~"],
  ['叮！思考模式启动中', "Ding! Thinking mode activated."],
] as const;
export function thinkingLine(random = Math.random): string {
  const index = Math.max(0, Math.min(AGENT_THINKING_LINES.length - 1, Math.floor(random() * AGENT_THINKING_LINES.length)));
  return AGENT_THINKING_LINES[index][1];
}

const chineseNumber = (value: string): number => {
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const digits: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (value.includes('十')) { const [a, b] = value.split('十'); return (a ? digits[a] ?? 0 : 1) * 10 + (b ? digits[b] ?? 0 : 0); }
  return digits[value] ?? NaN;
};
/** Extract only explicit time budgets; no hidden default is presented as the user's choice. */
export function planPreferences(text: string): { minutes: number | null; energy: 'low' | 'normal' | 'high' } {
  let minutes: number | null = null;
  const hours = text.match(/(\d+(?:\.\d+)?|[一二两三四五六七八九十]{1,3})\s*(?:个)?(半)?\s*(?:小时|hours?|hrs?)\s*(?:(\d+)\s*(?:分钟|minutes?|mins?))?/i);
  const mins = text.match(/(\d+|[一二两三四五六七八九十]{1,3})\s*(?:分钟|minutes?|mins?)/i);
  if (hours) minutes = chineseNumber(hours[1]) * 60 + (hours[2] ? 30 : 0) + Number(hours[3] ?? 0);
  else if (/半\s*(?:个)?小时/.test(text)) minutes = 30;
  else if (mins) minutes = chineseNumber(mins[1]);
  const energy = /疲惫|没精神|累|精力低|tired|low energy/i.test(text) ? 'low' : /充沛|精力好|high energy|energetic/i.test(text) ? 'high' : 'normal';
  return { minutes: minutes !== null && Number.isFinite(minutes) ? minutes : null, energy };
}

export function conversationInstruction(messages: { role: string; text: string }[], previous: unknown, latest: string): string {
  const history = messages.slice(-6).map(message => ({ role: message.role, text: message.text.slice(-350) }));
  // The latest user input is repeated at the end so long older drafts cannot truncate it.
  const context = JSON.stringify({ conversation: history, previousProposal: previous }).slice(0, 2400);
  return `${context}\nLatest user message:\n${latest.slice(0, 1400)}`;
}
