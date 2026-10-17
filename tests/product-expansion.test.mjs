import test from 'node:test';
import assert from 'node:assert/strict';
import { taskConflicts,conflictApproval,anniversariesSchema,anniversaryDate,scheduledJobsSchema,nextJobTime,validateProductSettings } from '../src/services/productData.ts';
import { applyProgressAchievements } from '../src/services/progressAchievements.ts';
import { weeklyComparison } from '../src/services/agentScenarios.ts';
import { planTimeline } from '../src/services/planTimeline.ts';
import { prepareAgentBatch,applyAgentBatch,taskFingerprint } from '../src/services/agentActions.ts';
import { parseNews } from '../server/news.mjs';
import { buildMessages } from '../server/prompts.mjs';
const now=new Date('2026-10-16T08:00:00Z');
const task=(id,start,end)=>({id,title:id,timingMode:'range',startAt:new Date(start),dueDate:new Date(end),status:'pending',priority:'medium',createdAt:now});
const event=task('meeting','2026-10-16T09:00Z','2026-10-16T10:00Z');
test('conflicts require exclusive overlapping intervals; adjoining meetings and long projects are excluded',()=>{
  const overlap=task('call','2026-10-16T09:30Z','2026-10-16T10:30Z');
  assert.deepEqual(taskConflicts(event,[event,overlap]).map(t=>t.id),['call']);
  assert.equal(taskConflicts(event,[{...overlap,status:'completed'}]).length,0);
  assert.equal(taskConflicts(event,[task('next','2026-10-16T10:00Z','2026-10-16T11:00Z')]).length,0);
  assert.equal(taskConflicts(event,[{...overlap,timingMode:'deadline',startAt:undefined,dueDate:new Date('2027-01-01')}]).length,0);
  assert.equal(taskConflicts(event,[task('project','2026-10-01','2026-12-01')]).length,0);
  assert.notEqual(conflictApproval(event,overlap),conflictApproval({...event,dueDate:new Date('2026-10-16T10:05Z')},overlap));
});
test('AI import requires confirmation of the current conflict context and keeps a retry idempotent',async()=>{
  const draft={title:'Call',description:'',timingMode:'range',startAt:'2026-10-16T09:30:00Z',dueDate:'2026-10-16T10:30:00Z',priority:'medium',estimatedDuration:60};
  const batch=await prepareAgentBatch([draft]);const data={tasks:[event],pet:null,achievements:[],settings:{}};
  assert.throws(()=>applyAgentBatch(data,batch,now),/conflict/);
  batch.confirmedConflictFingerprint=taskFingerprint(data.tasks);const saved=applyAgentBatch(data,batch,now);
  assert.equal(saved.tasks[0].conflictApprovals.length,1);assert.strictEqual(applyAgentBatch(saved,batch,now),saved);
  assert.throws(()=>applyAgentBatch({...data,tasks:[{...event,title:'Changed'}]},batch,now),/conflict/);
});
test('anniversaries validate dates, reject external image URLs and handle leap birthdays',()=>{
  const note={id:crypto.randomUUID(),title:'Birthday',date:'2000-02-29',yearly:true,style:'mint'};
  assert.equal(anniversariesSchema.parse([note]).length,1);
  assert.throws(()=>anniversariesSchema.parse([{...note,date:'2026-02-30'}]));
  assert.throws(()=>anniversariesSchema.parse([{...note,image:'https://example.com/a.jpg'}]));
  assert.equal(anniversaryDate(note,new Date(2027,0,1)).getDate(),28);
  assert.equal(anniversaryDate(note,new Date(2028,0,1)).getDate(),29);
  assert.equal(anniversaryDate(note,new Date(2028,3,1)).getFullYear(),2029);
});
test('recurring schedules recover at one next occurrence, skip weekends and validate account settings',()=>{
  const friday=new Date(2026,9,16,9,0);const next=new Date(nextJobTime('08:00','weekdays',friday));
  assert.equal(next.getDay(),1);assert.equal(next.getHours(),8);
  assert.equal(new Date(nextJobTime('10:00','daily',friday)).getDate(),16);
  const job={id:crypto.randomUUID(),title:'News',prompt:'News',kind:'news',time:'08:00',repeat:'daily',enabled:true,nextRun:next.toISOString()};
  assert.equal(scheduledJobsSchema.parse([job]).length,1);
  assert.throws(()=>scheduledJobsSchema.parse([{...job,time:'25:00'}]));
  assert.throws(()=>scheduledJobsSchema.parse([job,job]));
  assert.throws(()=>validateProductSettings({achievementRewards:['8','8']}));
});
test('achievement experience commits once with receipts and survives reconstruction without farming',()=>{
  const pet={id:'pet',userId:'owner',name:'Buddy',type:'cat',level:1,experience:0,health:70,happiness:70,hunger:30,energy:70,lastInteraction:now,lastFed:now,createdAt:now};
  const data={tasks:[{...event,status:'completed',completedAt:now}],pet,achievements:[],settings:{}};
  const saved=applyProgressAchievements(data,now);assert.equal(saved.pet.experience,20);assert.equal(saved.settings.achievementRewards.length,1);assert.equal(saved.achievements[0].id,'8');
  assert.strictEqual(applyProgressAchievements(saved,now),saved);
  const reopened={...saved,tasks:[event]};assert.strictEqual(applyProgressAchievements(reopened,now),reopened);
  assert.equal(applyProgressAchievements({...reopened,tasks:data.tasks},now).pet.experience,20);
});
test('weekly comparison uses actual completion timestamps and comparable elapsed periods',()=>{
  const current=new Date(2026,9,16,12);const done=date=>({...event,status:'completed',completedAt:date});
  const report=weeklyComparison([done(new Date(2026,9,13)),done(new Date(2026,9,17)),done(new Date(2026,9,6)),done(new Date(2026,9,11)),{...event,status:'completed'}],current);
  assert.equal(report.weekToDate,1);assert.equal(report.weeks[2].total,2);assert.equal(report.weeks[2].comparable,1);assert.equal(report.missingCompletionDate,1);
});
test('daily timeline preserves fixed events and avoids placing flexible work over meetings',()=>{
  const flexible={...event,id:'work',timingMode:'deadline',startAt:undefined,dueDate:new Date('2026-10-17')};
  const plan={mode:'plan',summary:'',questions:[],warnings:[],items:[{taskId:'work',minutes:90,reason:'',firstStep:''},{taskId:'meeting',minutes:60,reason:'',firstStep:''}]};
  const slots=planTimeline(plan,[flexible,event],new Date('2026-10-16T08:30Z'));
  assert.equal(slots[0].fixed,true);assert.equal(slots[1].start.toISOString(),'2026-10-16T10:00:00.000Z');
});
test('news extracts bounded recent publisher items and rejects stale, fabricated or external links',()=>{
  const xml=`<rss><item><title>Headline</title><link>https://www.bbc.com/news/articles/test</link><pubDate>${now.toUTCString()}</pubDate></item></rss>`;
  assert.equal(parseNews(xml,now)[0].title,'Headline');
  assert.throws(()=>parseNews(xml.replace('www.bbc.com','evil.example'),now));
  assert.throws(()=>parseNews(xml,new Date(+now+8*86400000)));
  assert.throws(()=>parseNews('<rss/>',now));
});
test('persona is selected from a fixed system style and image timestamps need no invented end time',()=>{
  const messages=buildMessages({mode:'create',locale:'zh-CN',personality:'cool',instruction:'Create',completeMissing:true});
  assert.match(messages[0].content,/cool reserved companion/);assert.match(messages[1].content[0].text,/single date\/time/);
});
