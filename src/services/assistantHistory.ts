import {z} from 'zod';
import {agentWorkspaceSchema} from './agentActions.ts';
export const chatMessageSchema=z.object({id:z.number().int().positive(),role:z.enum(['user','assistant']),text:z.string().max(8000),createdAt:z.string().datetime().optional(),image:z.string().max(600000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/).optional(),widget:z.literal('schedule').optional()}).strict();
export const chatThreadSchema=z.object({id:z.string().uuid(),title:z.string().max(120),createdAt:z.string().datetime(),updatedAt:z.string().datetime(),messages:z.array(chatMessageSchema).max(200).refine(a=>new Set(a.map(m=>m.id)).size===a.length),workspace:agentWorkspaceSchema.optional()}).strict();
export const chatHistorySchema=z.object({version:z.literal(1),activeId:z.string().uuid().nullable(),threads:z.array(chatThreadSchema).max(100)}).strict().superRefine((h,c)=>{if(new Set(h.threads.map(t=>t.id)).size!==h.threads.length||h.activeId&&!h.threads.some(t=>t.id===h.activeId)||JSON.stringify(h).length>8000000)c.addIssue({code:'custom',message:'Invalid history or history capacity reached. Existing conversations are preserved.'});});
export type ChatThread=z.infer<typeof chatThreadSchema>;
export type ChatHistory=z.infer<typeof chatHistorySchema>;
export function emptyChatHistory():ChatHistory{return {version:1,activeId:null,threads:[]};}
export function saveChatThread(history:unknown,thread:ChatThread){const h=history===undefined?emptyChatHistory():chatHistorySchema.parse(history);return chatHistorySchema.parse({...h,activeId:thread.id,threads:[thread,...h.threads.filter(t=>t.id!==thread.id)]});}
export function searchChatThreads(threads:ChatThread[],query:string){const q=query.trim().toLocaleLowerCase();return threads.filter(t=>!q||`${t.title}\n${t.messages.map(m=>m.text).join('\n')}`.toLocaleLowerCase().includes(q));}
export function suggestedFocus(minutes:number){const total=Math.max(1,Math.min(720,Math.round(minutes)||25)),cycles=Math.min(12,Math.max(1,Math.ceil(total/25)));return {focusMinutes:Math.ceil(total/cycles),breakMinutes:5,cycles};}
