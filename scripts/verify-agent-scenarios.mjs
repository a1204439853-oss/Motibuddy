// Exercise new scenario prompts with synthetic evidence only; report status, never provider bodies.
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createGateway, readConfig } from '../server/gateway.mjs';
import { scenarioInstruction } from '../src/services/agentScenarios.ts';
const now = new Date(), base = { locale: 'zh-CN', now: now.toISOString(), timeZone: 'Asia/Shanghai', completeMissing: true, tasks: [], availableMinutes: 30, energy: 'normal' };
const synthetic = [{ id: 'fixture', title: '合成复盘事项', status: 'completed', completedAt: new Date(+now - 3600000) }];
const cases = [
  { name:'weekly-review-with-real-aggregates', request:{ ...base,mode:'chat',instruction:scenarioInstruction('review',synthetic,'zh-CN',now)+'请根据真实汇总简短复盘，并给出两条下周建议。' },check:r=>r.mode==='chat'&&/1|一/.test(r.summary) },
  { name:'recommendations-are-reviewable-drafts', request:{ ...base,mode:'create',instruction:scenarioInstruction('recommend',[],'zh-CN',now)+'我想养成阅读习惯，每天有20分钟，请建议一个小任务。' },check:r=>r.mode==='create'&&r.drafts.length>=1&&r.drafts.length<=3 },
  { name:'emotional-support-stays-conversational', request:{ ...base,mode:'chat',instruction:scenarioInstruction('journal',[],'zh-CN',now)+'今天工作有点累，想有人听我说说，暂时不用安排任务。' },check:r=>r.mode==='chat'&&r.summary.length>0 },
];
const report={checkedAt:new Date().toISOString(),model:'deepseek-flash',checks:[]};
const server=createGateway(readConfig());server.listen(0,'127.0.0.1');await once(server,'listening');
try{
 const url=`http://127.0.0.1:${server.address().port}/api/agent`,headers={Origin:'https://tauri.localhost','Content-Type':'application/json'};
 const session=await(await fetch(url+'/session',{method:'POST',headers,body:'{}'})).json();
 for(const item of cases){
  try{const response=await fetch(url+'/generate',{method:'POST',headers:{...headers,Authorization:`Bearer ${session.token}`},body:JSON.stringify(item.request),signal:AbortSignal.timeout(70000)});const value=await response.json();const passed=response.ok&&item.check(value.result);report.checks.push({name:item.name,status:response.status,passed});console.log(`${passed?'PASS':'FAIL'} ${item.name}`);if(!passed)process.exitCode=1;}
  catch{report.checks.push({name:item.name,passed:false});console.log(`FAIL ${item.name}`);process.exitCode=1;}
 }
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await writeFile('docs/AGENT_SCENARIOS_VERIFICATION.json',JSON.stringify(report,null,2));}
