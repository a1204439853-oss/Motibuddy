import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAgentResult} from '../src/services/agentContracts.ts';
import {draftIssues} from '../src/services/agentDraftReview.ts';
import {applyAgentBatch,prepareAgentBatch} from '../src/services/agentActions.ts';
import {archiveGenerated,validateCompanionSettings} from '../src/services/companionRecords.ts';
import {personalityBubble} from '../src/services/petPersonality.ts';
import {ttsSignedRequest,synthesize,VOICES} from '../server/tts.mjs';
const now=new Date('2026-10-17T01:00:00Z'),draft={title:'Meet',description:'',dueDate:'2026-10-17T03:00:00Z',timingMode:'deadline',startAt:null,priority:'medium',estimatedDuration:null};
test('single explicit point becomes a start plus thirty minutes without optional questions or default warnings',()=>{
 const request={mode:'create',singleTimeAsStart:true,completeMissing:true,now:now.toISOString(),locale:'zh-CN'};
 const value=validateAgentResult({mode:'create',summary:'Ready',drafts:[draft,{...draft,title:'Read',dueDate:null}],questions:['结束时间？'],warnings:['请补全截止日期']},request);
 assert.equal(value.drafts[0].startAt,draft.dueDate);assert.equal(+new Date(value.drafts[0].dueDate)-+new Date(value.drafts[0].startAt),1800000);assert.equal(value.drafts[0].timingMode,'range');assert.deepEqual(value.questions,[]);assert.deepEqual(value.warnings,[]);assert.equal(draftIssues(value.drafts[1],[],now).length,0);
 assert.deepEqual(validateAgentResult(value,request),value,'client validation cannot shift the range twice');
});
test('valid historical tasks remain selectable and import as overdue without an automatic penalty',async()=>{
 const old={...draft,dueDate:'2026-10-16T03:00:00Z',estimatedDuration:30};assert.equal(draftIssues(old,[],now).includes('date'),false);
 const data={tasks:[],pet:null,achievements:[],settings:{}};const saved=applyAgentBatch(data,await prepareAgentBatch([old]),now);assert.equal(saved.tasks[0].status,'overdue');assert.deepEqual(saved.achievements,[]);
});
test('daily plans archive a fixed timeline, replace only their own date and retain titles after task deletion',()=>{
 const tasks=[{id:'a',title:'Read',status:'pending',priority:'medium',dueDate:new Date('2026-10-20'),createdAt:now}];const result={mode:'plan',summary:'One small step',items:[{taskId:'a',minutes:20,reason:'A goal',firstStep:'Open book'}],questions:[],warnings:[]};
 const id=crypto.randomUUID();const saved=archiveGenerated({other:42},'plan',result,tasks,'',undefined,now,id);assert.equal(saved.dailyPlans[0].slots[0].title,'Read');assert.equal(saved.other,42);const again=archiveGenerated(saved,'plan',result,tasks,'',undefined,now,id);assert.equal(again.dailyPlans.length,1);assert.deepEqual(again.dailyPlans[0],saved.dailyPlans[0]);validateCompanionSettings(saved);
});
test('weekly reports and journals are idempotent and separate user words from AI reflections',()=>{
 const result={mode:'chat',summary:'I hear you. Take one gentle step.',questions:[],warnings:[]};const id=crypto.randomUUID();const saved=archiveGenerated({},'journal',result,[],'Today was tiring.',undefined,now,id);assert.equal(saved.journalEntries[0].body,'Today was tiring.');assert.equal(saved.journalEntries[0].reflection,result.summary);assert.deepEqual(archiveGenerated(saved,'journal',result,[],'Changed',undefined,now,id),saved);
 const report=archiveGenerated(saved,'review',result,[],'',undefined,now,crypto.randomUUID());assert.equal(report.weeklyReports[0].evidence.weeks.length,4);assert.equal(report.weeklyReports[0].evidence.weekToDate,0);validateCompanionSettings(report);
 assert.throws(()=>validateCompanionSettings({...report,journalEntries:[{...saved.journalEntries[0],strokes:[[{x:Infinity,y:0}]]}]}));
});
test('six pet personalities have distinct local dialogue without a model call',()=>{
 const ids=['gentle','tsundere','witty','humorous','cool','soft'];const lines=ids.map(id=>personalityBubble(id,'thinking','zh-CN',0));assert.equal(new Set(lines).size,6);assert.match(lines[1],/才不是|才、才不是/);assert.match(lines[4],/我在/);assert.match(lines[5],/蹭蹭|贴贴/);
});
test('a full journal preserves all existing pages rather than silently removing the oldest',()=>{
 const result={mode:'chat',summary:'A note',questions:[],warnings:[]};
 const base=archiveGenerated({},'journal',result,[],'First page',undefined,now,crypto.randomUUID()).journalEntries[0];
 const settings={journalEntries:Array.from({length:200},(_,i)=>({...base,id:crypto.randomUUID(),body:`Page ${i}`}))};
 const before=JSON.stringify(settings);validateCompanionSettings(settings);
 assert.throws(()=>archiveGenerated(settings,'journal',result,[],'New page',undefined,now,crypto.randomUUID()),/capacity/);
 assert.equal(JSON.stringify(settings),before);
 assert.deepEqual(archiveGenerated(settings,'journal',result,[],'Retry',undefined,now,settings.journalEntries[0].id),settings);
});
test('Tencent signing fixes the endpoint and voice mapping; text never contains credentials',async()=>{
 const config={ttsId:'AKIDsynthetic',ttsKey:'synthetic_private_key_only_for_test'};const request=ttsSignedRequest('你好','girl',config,1792198800);assert.equal(JSON.parse(request.body).VoiceType,403000);assert.equal(VOICES.boy,603000);assert.equal(request.url,'https://tts.tencentcloudapi.com');assert.equal(request.body.includes(config.ttsKey),false);assert.match(request.headers.Authorization,/TC3-HMAC-SHA256/);assert.throws(()=>ttsSignedRequest('x','arbitrary',config));
 const fake=async()=>new Response(JSON.stringify({Response:{Audio:Buffer.from('MP3 synthetic').toString('base64')}}));assert.equal((await synthesize('你好','boy',config,fake)).mime,'audio/mpeg');
 await assert.rejects(synthesize('你好','boy',config,async()=>new Response(JSON.stringify({Response:{Error:{Message:config.ttsKey}}}))),e=>e.message==='TTS_UNAVAILABLE'&&!e.message.includes(config.ttsKey));
});
