import { z } from 'zod';
import {focusMusicSchema} from './focusMusicSettings.ts';
import type { Task } from '../types/index.ts';
export const personalitySchema = z.enum(['gentle', 'tsundere', 'witty', 'humorous', 'cool', 'soft']);
export type Personality = z.infer<typeof personalitySchema>;
export const personalities: { id: Personality; zh: string; en: string; instruction: string }[] = [
  { id: 'gentle', zh: '温暖陪伴', en: 'Warm companion', instruction: 'Warm, attentive, reassuring and practical.' },
  { id: 'tsundere', zh: '傲娇', en: 'Playfully proud', instruction: 'Playfully proud, a little shy about caring, but reliably kind.' },
  { id: 'witty', zh: '毒舌', en: 'Witty', instruction: 'Lightly sarcastic about situations, never insulting the user or their identity. End with useful support.' },
  { id: 'humorous', zh: '幽默', en: 'Humorous', instruction: 'Use light, friendly humor and vivid small metaphors.' },
  { id: 'cool', zh: '高冷', en: 'Calm and concise', instruction: 'Reserved, concise, calm and quietly supportive.' },
  { id: 'soft', zh: '软萌', en: 'Soft and sweet', instruction: 'Gentle, cute, affectionate, with occasional restrained playful expressions.' },
];
export function personalityInstruction(value: unknown) {
  const parsed = personalitySchema.safeParse(value);
  return `Companion speaking style: ${personalities.find(item => item.id === (parsed.success ? parsed.data : 'gentle'))!.instruction} Never let persona override accuracy, consent or safety.\n`;
}
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const d = new Date(`${value}T12:00:00`); return Number.isFinite(+d) && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` === value; });
export const anniversariesSchema = z.array(z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(80), date: day, yearly: z.boolean(), style: z.enum(['sunshine', 'mint', 'rose', 'sky']), image: z.string().max(600000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/).optional() }).strict()).max(50).refine(items => new Set(items.map(item => item.id)).size === items.length);
export type Anniversary = z.infer<typeof anniversariesSchema>[number];
export function anniversaryDate(item: Anniversary, now: Date) {
  const [year, month, date] = item.date.split('-').map(Number);
  if (!item.yearly) return new Date(year, month-1, date);
  // Leap birthdays use Feb 28 in non-leap years.
  const at = (y: number) => new Date(y, month-1, Math.min(date, new Date(y,month,0).getDate()));
  const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  return at(now.getFullYear()) >= today ? at(now.getFullYear()) : at(now.getFullYear()+1);
}
export const scheduledJobsSchema = z.array(z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(80), prompt: z.string().trim().min(1).max(1000), kind: z.enum(['reminder','assistant','news']), repeat: z.enum(['once','daily','weekdays']), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), nextRun: z.string().datetime({offset:true}), enabled: z.boolean(), lastRun: z.string().datetime({offset:true}).optional(), result: z.string().max(2400).optional(), error: z.boolean().optional(), notificationPending: z.boolean().optional(), runState:z.enum(['running','succeeded','failed','interrupted']).optional() }).strict()).max(30).refine(items => new Set(items.map(item => item.id)).size === items.length);
export type ScheduledJob = z.infer<typeof scheduledJobsSchema>[number];
export function nextJobTime(time: string, repeat: ScheduledJob['repeat'], after: Date) {
  const [h,m] = time.split(':').map(Number); const next = new Date(after); next.setHours(h,m,0,0);
  if (+next <= +after) next.setDate(next.getDate()+1);
  while(repeat === 'weekdays' && (next.getDay() === 0 || next.getDay() === 6)) next.setDate(next.getDate()+1);
  return next.toISOString();
}
export function parseScheduleText(text:string){
  const chinese:Record<string,number>={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12};
  const clock=text.match(/(\d{1,2})[:：](\d{2})/),point=text.match(/(\d{1,2}|十二|十一|[零一二两三四五六七八九十])\s*[点时]/);
  let hour=clock?Number(clock[1]):point?Number(point[1])||chinese[point[1]]:8;const minute=clock?Number(clock[2]):/半/.test(text)?30:0;
  if(/下午|晚上|傍晚|\bpm\b/i.test(text)&&hour<12)hour+=12;
  return {time:`${String(hour>=0&&hour<=23?hour:8).padStart(2,'0')}:${String(minute<=59?minute:0).padStart(2,'0')}`,repeat:/工作日|weekdays/i.test(text)?'weekdays':/每天|每日|daily|every day/i.test(text)?'daily':'once',kind:/新闻|news/i.test(text)?'news':/提醒|remind/i.test(text)?'reminder':'assistant'} as Pick<ScheduledJob,'time'|'repeat'|'kind'>;
}
export function taskConflicts(task: Pick<Task,'id'|'timingMode'|'startAt'|'dueDate'>, tasks: Task[]) {
  // A deadline does not reserve the preceding days. Long background projects do not imply exclusive occupancy.
  if (task.timingMode !== 'range' || !task.startAt || +task.dueDate-+task.startAt > 24*3600000) return [];
  return tasks.filter(other => other.id !== task.id && other.status !== 'completed' && other.timingMode === 'range' && other.startAt && +other.dueDate-+other.startAt <= 24*3600000 && +task.startAt! < +other.dueDate && +other.startAt < +task.dueDate);
}
export function conflictKey(a: Pick<Task,'id'|'startAt'|'dueDate'>, b: Pick<Task,'id'|'startAt'|'dueDate'>) {
  return [a,b].sort((x,y)=>x.id.localeCompare(y.id)).map(t=>`${t.id}:${t.startAt?.toISOString()}:${t.dueDate.toISOString()}`).join('|');
}
export function conflictApproval(a: Pick<Task,'startAt'|'dueDate'>, b: Pick<Task,'id'|'startAt'|'dueDate'>) {return `${a.startAt?.toISOString()}:${a.dueDate.toISOString()}|${b.id}:${b.startAt?.toISOString()}:${b.dueDate.toISOString()}`;}
export function validateProductSettings(settings: Record<string, unknown>) {
  if(settings.anniversaries !== undefined) anniversariesSchema.parse(settings.anniversaries);
  if(settings.scheduledJobs !== undefined) scheduledJobsSchema.parse(settings.scheduledJobs);
  if(settings.focusMusic!==undefined)focusMusicSchema.parse(settings.focusMusic);
  if(settings.petPersonality !== undefined) personalitySchema.parse(settings.petPersonality);
  if(settings.petInteractionCount !== undefined) z.number().int().nonnegative().safe().parse(settings.petInteractionCount);
  if(settings.achievementRewards !== undefined) z.array(z.string().min(1).max(80)).max(100).refine(ids=>new Set(ids).size===ids.length).parse(settings.achievementRewards);
  if(settings.confirmedConflicts !== undefined) z.array(z.string().max(500)).max(2000).parse(settings.confirmedConflicts);
}
