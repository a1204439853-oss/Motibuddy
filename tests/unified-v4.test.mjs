import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMessages} from '../server/prompts.mjs';
import {agentRequestSchema,validateAgentResult} from '../src/services/agentContracts.ts';
import {personalityBubble} from '../src/services/petPersonality.ts';
import {BusinessRepository} from '../src/services/businessRepository.ts';
const base={mode:'chat',locale:'zh-CN',now:new Date().toISOString(),timeZone:'Asia/Shanghai',instruction:'Listen to my story',availableMinutes:30,energy:'normal',tasks:[]};
test('music track and volume survive the entire repository validation and reload path',async()=>{
 let persisted={schemaVersion:1,userId:'music-user',revision:1,operations:[],data:{tasks:[],pet:null,achievements:[],settings:{focusMusic:{enabled:true,volume:40}}}};
 const repo=new BusinessRepository({read:async()=>structuredClone(persisted),initialize:async()=>persisted,commit:async(owner,revision,id,data)=>{assert.equal(revision,persisted.revision);persisted={...persisted,revision:revision+1,data:structuredClone(data),operations:[...persisted.operations,{id,baseRevision:revision}]};return structuredClone(persisted);}});
 for(const track of ['meditation','dream','lemon','cities'])await repo.transact('music-user',d=>({...d,settings:{...d.settings,focusMusic:{...d.settings.focusMusic,track}}}),()=>true);
 await repo.transact('music-user',d=>({...d,settings:{...d.settings,focusMusic:{...d.settings.focusMusic,volume:22}}}),()=>true);
 assert.deepEqual((await repo.read('music-user')).data.settings.focusMusic,{enabled:true,volume:22,track:'cities'});
 const before=structuredClone(persisted);await assert.rejects(repo.transact('music-user',d=>({...d,settings:{...d.settings,focusMusic:{enabled:true,volume:22,track:'untrusted'}}}),()=>true));assert.deepEqual(persisted,before);
});
test('general chat policy answers ordinary questions without requiring a task',()=>{const system=buildMessages({...base,mode:'assist'})[0].content;assert.match(system,/general-purpose/);assert.match(system,/Never refuse simply because a question is unrelated to tasks/);assert.match(system,/Small talk, general questions/);});
test('journal readiness is validated separately from saving and preserves existing chat payloads',()=>{const request=agentRequestSchema.parse({...base,journalConversation:true});assert.equal(request.journalConversation,true);const r={mode:'chat',summary:'I hear you.',questions:[],warnings:[]};assert.equal(validateAgentResult({...r,journalReady:false},request).journalReady,false);assert.equal(validateAgentResult({...r,journalReady:true},request).journalReady,true);assert.throws(()=>validateAgentResult({...r,journalReady:'save now'},request));assert.deepEqual(validateAgentResult(r,base),r);assert.match(buildMessages(request)[0].content,/explicit confirmation|explicit consent/);});
test('each personality has varied context-specific affection, feeding and play dialogue',()=>{for(const locale of ['zh-CN','en-US'])for(const p of ['gentle','tsundere','witty','humorous','cool','soft']){const groups=['interaction','fed','play'].map(m=>[0,.4,.8].map(r=>personalityBubble(p,m,locale,r)));assert.ok(groups.every(lines=>new Set(lines).size>=2));assert.ok(groups.flat().every(s=>s.length>0));assert.equal(groups[0].some(line=>groups[1].includes(line)),false);}});
