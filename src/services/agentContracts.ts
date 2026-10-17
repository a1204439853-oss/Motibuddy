import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
export const agentTaskSchema = z.object({
  id: text(128), title: text(200), description: z.string().max(1000),
  dueDate: z.string().datetime({ offset: true }),
  timingMode: z.enum(['deadline', 'range']).optional(),
  startAt: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  estimatedDuration: z.number().int().min(1).max(1440).nullable(),
}).strict();
export const agentRequestSchema = z.object({
  mode: z.enum(['plan', 'create', 'chat', 'assist']), locale: z.enum(['zh-CN', 'en-US']),
  completeMissing: z.boolean().optional(),
  singleTimeAsStart:z.boolean().optional(),
  scheduled:z.boolean().optional(),
  deepThinking:z.boolean().optional(),
  webSearch:z.boolean().optional(),
  searchQuery:z.string().trim().min(1).max(128).optional(),
  news: z.boolean().optional(),
  journalConversation:z.boolean().optional(),
  personality: z.enum(['gentle','tsundere','witty','humorous','cool','soft']).optional(),
  now: z.string().datetime({ offset: true }), timeZone: text(100),
  instruction: z.string().trim().max(4000),
  availableMinutes: z.number().int().min(5).max(720),
  energy: z.enum(['low', 'normal', 'high']),
  tasks: z.array(agentTaskSchema).max(200),
  image: z.string().max(3_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.news && value.mode !== 'chat') ctx.addIssue({ code: 'custom', message: 'News is chat only' });
  if (new Set(value.tasks.map(task => task.id)).size !== value.tasks.length) ctx.addIssue({ code: 'custom', message: 'Duplicate task IDs' });
  if (value.mode === 'plan' && (!value.tasks.length || value.image)) ctx.addIssue({ code: 'custom', message: 'Plans require tasks and no image' });
  if (value.mode === 'create' && (!value.instruction && !value.image || value.tasks.length)) ctx.addIssue({ code: 'custom', message: 'Creation requires input, without existing task contents' });
  if (value.mode === 'chat' && (!value.instruction || value.tasks.length)) ctx.addIssue({ code: 'custom', message: 'Chat uses only the explicit conversation text' });
  if (value.mode === 'assist' && (!value.instruction || value.image)) ctx.addIssue({ code: 'custom', message: 'Assistance requires a message' });
});

export const agentDraftSchema = z.object({
  title: text(200), description: z.string().max(2000),
  dueDate: z.string().datetime({ offset: true }).nullable(),
  timingMode: z.enum(['deadline', 'range']).optional(),
  startAt: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  estimatedDuration: z.number().int().min(1).max(1440).nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.timingMode === 'range' && (!value.startAt || !value.dueDate || new Date(value.startAt) >= new Date(value.dueDate))) ctx.addIssue({ code: 'custom', message: 'Invalid draft time range' });
  if (value.timingMode !== 'range' && value.startAt) ctx.addIssue({ code: 'custom', message: 'Unexpected draft start time' });
});
const notes = z.array(text(600)).max(12);
export const agentResultSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('chat'), summary: text(2000), journalReady:z.boolean().optional(), questions: notes, warnings: notes }).strict(),
  z.object({
    mode: z.literal('plan'), summary: text(2000),
    items: z.array(z.object({ taskId: text(128), minutes: z.number().int().min(1).max(720), reason: text(1000), firstStep: text(1000) }).strict()).max(30),
    questions: notes, warnings: notes,
  }).strict(),
  z.object({ mode: z.literal('create'), summary: text(2000), drafts: z.array(agentDraftSchema).max(30), questions: notes, warnings: notes }).strict(),
]);
export type AgentRequest = z.infer<typeof agentRequestSchema>;
export type AgentResult = z.infer<typeof agentResultSchema>;
export type AgentDraft = z.infer<typeof agentDraftSchema>;
export type AgentPlan = Extract<AgentResult, { mode: 'plan' }>;

export function validateAgentResult(value: unknown, request: AgentRequest): AgentResult {
  let result = agentResultSchema.parse(value);
  if (request.mode === 'assist' ? !['chat', 'create'].includes(result.mode) : result.mode !== request.mode) throw new Error('Invalid agent mode');
  if(result.mode==='create'&&request.singleTimeAsStart){
    result={...result,questions:[],warnings:result.warnings.filter(w=>!/(?:请|需要|待).{0,8}(?:补全|补充|提供|填写).{0,15}(?:时间|日期)|建议补全|默认|suggested default|missing (?:deadline|end)|provide.*(?:end time|deadline)/i.test(w)),drafts:result.drafts.map((draft,index)=>{
      if(draft.timingMode==='range'&&draft.startAt&&draft.dueDate)return draft;
      const start=draft.dueDate??new Date(+new Date(request.now)+index*1800000).toISOString();
      return {...draft,timingMode:'range' as const,startAt:start,dueDate:new Date(+new Date(start)+1800000).toISOString(),estimatedDuration:30};
    })};
  }
  if (result.mode === 'create' && request.completeMissing) {
    const suggested: string[] = [];
    const drafts = result.drafts.map(draft => {
      const dueDate = draft.dueDate ?? new Date(new Date(request.now).getTime() + 86400000).toISOString();
      const rangeMinutes = draft.timingMode === 'range' && draft.startAt ? Math.max(1, Math.round((new Date(dueDate).getTime() - new Date(draft.startAt).getTime()) / 60000)) : null;
      const estimatedDuration = rangeMinutes !== null ? rangeMinutes <= 1440 ? rangeMinutes : null : draft.estimatedDuration ?? 30;
      if (!draft.dueDate || draft.timingMode !== 'range' && !draft.estimatedDuration) suggested.push(draft.title);
      return { ...draft, dueDate, estimatedDuration };
    });
    result = { ...result, drafts, warnings: [...result.warnings.slice(0, 11), ...(suggested.length ? [request.locale === 'zh-CN'
      ? `建议补全：未提供的截止时间按当前时间后 24 小时安排，未提供的预计耗时按 30 分钟安排（时间段按实际时长）。涉及：${suggested.join('、').slice(0, 300)}。均可修改，确认后才会创建。`
      : `Suggested defaults: missing deadlines use 24 hours from now; missing estimates use 30 minutes (ranges use their actual length). Tasks: ${suggested.join(', ').slice(0, 300)}. Review or edit before confirming.`] : [])] };
  }
  if (result.mode === 'plan') {
    const ids = new Set(request.tasks.map(task => task.id));
    if (new Set(result.items.map(item => item.taskId)).size !== result.items.length || result.items.some(item => !ids.has(item.taskId))) throw new Error('Invalid plan task');
    if (result.items.reduce((sum, item) => sum + item.minutes, 0) > request.availableMinutes) throw new Error('Plan exceeds time budget');
  }
  return result;
}
