import {z} from 'zod';
import {focusMusicSchema} from './focusMusicSettings.ts';
import type {Task} from '../types/index.ts';
import type {AgentResult} from './agentContracts.ts';
import {planTimeline} from './planTimeline.ts';
import {weeklyComparison} from './agentScenarios.ts';
export const surveySchema=z.object({status:z.enum(['complete','deferred']),goals:z.string().max(500),interests:z.string().max(500),minutes:z.number().int().min(5).max(480),rhythm:z.enum(['morning','afternoon','evening','flexible']),ageGroup:z.enum(['prefer-not','under18','18-24','25-34','35-44','45-59','60plus']).optional(),occupation:z.enum(['prefer-not','student','office','freelance','creative','caregiver','retired','other']).optional(),habits:z.array(z.enum(['learning','health','career','creative','social','rest'])).max(6).optional()}).strict();
export const planRecordSchema=z.object({id:z.string().uuid(),createdAt:z.string().datetime(),date:z.string(),summary:z.string().max(2500),slots:z.array(z.object({taskId:z.string(),title:z.string(),start:z.string().datetime(),end:z.string().datetime(),reason:z.string(),firstStep:z.string(),fixed:z.boolean()})).max(30)});
export const weekRecordSchema=z.object({id:z.string().uuid(),createdAt:z.string().datetime(),summary:z.string().max(2500),evidence:z.object({completed:z.number(),open:z.number(),missingCompletionDate:z.number(),weekToDate:z.number(),days:z.array(z.object({date:z.string(),completed:z.number()})),weeks:z.array(z.object({start:z.string(),total:z.number(),comparable:z.number()}))})});
const point=z.object({x:z.number().min(0).max(1000),y:z.number().min(0).max(1000)});
export const journalEntrySchema=z.object({id:z.string().uuid(),createdAt:z.string().datetime(),updatedAt:z.string().datetime(),title:z.string().max(100),body:z.string().max(12000),reflection:z.string().max(2500),images:z.array(z.string().max(600000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/)).max(6),stickers:z.array(z.object({symbol:z.enum(['♡','★','✿','☀','🐾']),x:z.number().min(0).max(100),y:z.number().min(0).max(100)})).max(30),strokes:z.array(z.array(point).max(800)).max(100)}).strict();
export type JournalEntry=z.infer<typeof journalEntrySchema>;
export type PlanRecord=z.infer<typeof planRecordSchema>;
export type WeekRecord=z.infer<typeof weekRecordSchema>;
export function localDateKey(now:Date){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function archiveGenerated(settings:Record<string,unknown>,scenario:string|null,result:AgentResult,tasks:Task[],text:string,image:string|undefined,now:Date,id:string){
  const time=now.toISOString();
  if(scenario==='plan'&&result.mode==='plan'){
    const record=planRecordSchema.parse({id,createdAt:time,date:localDateKey(now),summary:result.summary,slots:planTimeline(result,tasks,now).map(slot=>({taskId:slot.item.taskId,title:slot.task?.title??slot.item.taskId,start:slot.start.toISOString(),end:slot.end.toISOString(),reason:slot.item.reason,firstStep:slot.item.firstStep,fixed:slot.fixed}))});
    return {...settings,dailyPlans:[record,...z.array(planRecordSchema).parse(settings.dailyPlans??[]).filter(r=>r.date!==record.date)].slice(0,90)};
  }
  if(scenario==='review'&&result.mode==='chat')return {...settings,weeklyReports:[weekRecordSchema.parse({id,createdAt:time,summary:result.summary,evidence:weeklyComparison(tasks,now)}),...z.array(weekRecordSchema).parse(settings.weeklyReports??[]).filter(r=>r.id!==id)].slice(0,52)};
  if(scenario==='journal'&&result.mode==='chat'){
    const existing=z.array(journalEntrySchema).parse(settings.journalEntries??[]);if(existing.some(r=>r.id===id))return settings;
    const entry=journalEntrySchema.parse({id,createdAt:time,updatedAt:time,title:text.trim().split(/[。\n！？!?]/)[0].slice(0,25)||'这一刻',body:text,reflection:result.summary,images:image&&image.length<=600000?[image]:[],stickers:[],strokes:[]});
    if(existing.length>=200)throw new Error('Journal capacity reached; existing pages are preserved.');
    return {...settings,journalEntries:[entry,...existing]};
  }
  return settings;
}
export function validateCompanionSettings(settings:Record<string,unknown>){
  if(settings.soundVolume!==undefined)z.number().int().min(0).max(100).parse(settings.soundVolume);
  if(settings.ttsEnabled!==undefined)z.boolean().parse(settings.ttsEnabled);
  if(settings.weatherPlace!==undefined)z.object({name:z.string().min(1).max(100),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}).strict().parse(settings.weatherPlace);
  if(settings.focusMusic!==undefined)focusMusicSchema.parse(settings.focusMusic);
  if(settings.journalDraft!==undefined&&settings.journalDraft!==null)journalEntrySchema.parse(settings.journalDraft);
  if(settings.profileSurvey!==undefined)surveySchema.parse(settings.profileSurvey);
  if(settings.dailyPlans!==undefined)z.array(planRecordSchema).max(90).parse(settings.dailyPlans);
  if(settings.weeklyReports!==undefined)z.array(weekRecordSchema).max(52).parse(settings.weeklyReports);
  if(settings.journalEntries!==undefined)z.array(journalEntrySchema).max(200).refine(entries=>entries.reduce((total,e)=>total+e.images.reduce((sum,image)=>sum+image.length,0),0)<=20000000,'Journal image storage limit reached').parse(settings.journalEntries);
  if(settings.ttsVoice!==undefined)z.enum(['girl','boy']).parse(settings.ttsVoice);
}
