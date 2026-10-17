import test from 'node:test';
import assert from 'node:assert/strict';
import {chatHistorySchema,saveChatThread,searchChatThreads,suggestedFocus} from '../src/services/assistantHistory.ts';
import {validateCompanionSettings} from '../src/services/companionRecords.ts';
import {initialMemories} from '../src/services/starterMemories.ts';
import {searchWeb} from '../server/search.mjs';
import {callDeepSeek} from '../server/gateway.mjs';
const now=new Date().toISOString();
const thread=(text)=>({id:crypto.randomUUID(),title:text,createdAt:now,updatedAt:now,messages:[{id:1,role:'user',text},{id:2,role:'assistant',text:'Small progress matters.'}]});
test('searchable conversation history preserves older threads and resumes the selected thread',()=>{
 const first=thread('读书计划'),second=thread('运动');let h=saveChatThread(undefined,first);h=saveChatThread(h,second);assert.equal(h.activeId,second.id);const updated={...first,messages:[...first.messages,{id:3,role:'user',text:'下周继续读第二章'}]};h=saveChatThread(h,updated);assert.equal(h.threads.length,2);assert.equal(h.activeId,first.id);assert.equal(searchChatThreads(h.threads,'第二章')[0].id,first.id);assert.equal(searchChatThreads(h.threads,'small PROGRESS').length,2);assert.equal(h.threads[1].messages[0].text,'运动');
 assert.throws(()=>chatHistorySchema.parse({...h,activeId:crypto.randomUUID()}));assert.throws(()=>chatHistorySchema.parse({...h,threads:[first,first]}));
 const full={version:1,activeId:null,threads:Array.from({length:100},()=>thread('Saved'))};const before=JSON.stringify(full);assert.throws(()=>saveChatThread(full,thread('Overflow')));assert.equal(JSON.stringify(full),before);assert.equal(saveChatThread(full,full.threads[0]).threads.length,100);
});
test('task-based focus rounds approximate the task duration with bounded settings',()=>{
 assert.deepEqual(suggestedFocus(15),{focusMinutes:15,breakMinutes:5,cycles:1});assert.deepEqual(suggestedFocus(40),{focusMinutes:20,breakMinutes:5,cycles:2});assert.equal(suggestedFocus(720).cycles,12);assert.equal(suggestedFocus(720).focusMinutes,60);assert.equal(suggestedFocus(0).focusMinutes,25);
});
test('starter memories use real adoption and registration dates, and never overwrite or resurrect edited memories',()=>{
 const user={createdAt:'2026-10-15T01:00:00Z'},pet={name:'汤圆',createdAt:'2026-10-16T01:00:00Z'};const value=initialMemories({},user,pet,'data:image/jpeg;base64,YQ==');validateCompanionSettings(value);assert.match(value.journalEntries[0].body,/汤圆/);assert.equal(+new Date(value.journalEntries[0].createdAt),+new Date(pet.createdAt));assert.equal(value.anniversaries[0].date,'2026-10-15');assert.equal(value.journalEntries[0].images.length,1);assert.deepEqual(initialMemories({...value,journalEntries:[],anniversaries:[]},user,pet),{...value,journalEntries:[],anniversaries:[]});const old={journalEntries:[value.journalEntries[0]],anniversaries:[value.anniversaries[0]]};assert.deepEqual(initialMemories(old,user,pet).journalEntries,old.journalEntries);
});
test('expanded optional profile, sound, music and weather settings stay backwards compatible and validate bounds',()=>{
 validateCompanionSettings({profileSurvey:{status:'deferred',goals:'',interests:'',minutes:30,rhythm:'flexible'}});validateCompanionSettings({soundVolume:0,ttsEnabled:false,focusMusic:{enabled:true,volume:50,track:'cities'},weatherPlace:{name:'杭州',latitude:30.25,longitude:120.16},profileSurvey:{status:'complete',goals:'Read',interests:'Books',minutes:120,rhythm:'evening',ageGroup:'25-34',occupation:'office',habits:['rest','learning']}});for(const bad of [{soundVolume:101},{weatherPlace:{name:'X',latitude:100,longitude:5}},{focusMusic:{enabled:true,volume:40,track:'arbitrary'}}])assert.throws(()=>validateCompanionSettings(bad));
});
test('web search uses the fixed authenticated provider endpoint and accepts only bounded public results',async()=>{
 let captured;const fetcher=async(url,options)=>{captured={url,options};return new Response(JSON.stringify({results:[{title:'A',url:'https://example.com/a',summary:'Evidence'},{title:'Bad',url:'javascript:alert(1)'}]}));};const value=await searchWeb('测试问题',{apiKey:'synthetic-key'},fetcher);assert.equal(captured.url,'https://api.deepseek.com/v1/tools/search');assert.equal(JSON.parse(captured.options.body).query,'测试问题');assert.equal(value.length,1);assert.equal(captured.options.body.includes('synthetic-key'),false);await assert.rejects(searchWeb('x',{},async()=>new Response('private failure',{status:403})),e=>e.message==='SEARCH_UNAVAILABLE');
});
test('thinking and live search reach the provider; URLs are emitted only in a sources section',async()=>{
 let model;const config={apiKey:'synthetic',timeoutMs:1000};const request={mode:'chat',locale:'zh-CN',now,timeZone:'Asia/Shanghai',instruction:'介绍一次新进展',availableMinutes:30,energy:'normal',tasks:[],webSearch:true,searchQuery:'science update',deepThinking:true};
 const fetcher=async(url,options)=>{if(url.endsWith('/tools/search'))return new Response(JSON.stringify({results:[{title:'Primary source',url:'https://example.com/source',summary:'Verified fact.'}]}));model=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({mode:'chat',summary:'事实介绍。更多 https://example.com/source',questions:[],warnings:[]}),reasoning_content:'private reasoning is not returned'}}]}));};
 const result=await callDeepSeek(request,config,fetcher);assert.deepEqual(model.thinking,{type:'enabled'});assert.equal(model.reasoning_effort,'high');assert.match(JSON.stringify(model.messages),/Verified fact/);assert.equal(result.summary.split('来源：')[0].includes('https://'),false);assert.match(result.summary,/来源：[\s\S]*https:\/\/example.com\/source/);assert.equal(JSON.stringify(result).includes('private reasoning'),false);
});
