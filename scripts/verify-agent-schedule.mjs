// Real provider acceptance with synthetic tasks only. Never log prompts, transcripts or provider bodies.
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createGateway, readConfig } from '../server/gateway.mjs';
const report = { checkedAt: new Date().toISOString(), model: 'deepseek-flash', checks: [] };
const now = new Date(), tomorrow = new Date(+now + 86400000);
const base = { mode: 'assist', locale: 'zh-CN', now: now.toISOString(), timeZone: 'Asia/Shanghai', completeMissing: true, availableMinutes: 60, energy: 'normal', tasks: [{ id: 'synthetic-report', title: '整理项目报告', description: '整理测试结果', priority: 'high', estimatedDuration: 30, dueDate: tomorrow.toISOString() }] };
const cases = [
  { name: 'small-talk-stays-chat', request: { ...base, instruction: '你好，今天心情还不错，随便聊聊吧。' }, check: r => r.mode === 'chat' },
  { name: 'unmatched-goal-becomes-proposal', request: { ...base, instruction: '明天我想练习30分钟吉他。' }, check: r => r.mode === 'create' && r.drafts.length > 0 && r.drafts.every(d => d.dueDate) },
  { name: 'matching-task-is-not-duplicated', request: { ...base, instruction: '我想做待办里的整理项目报告这件事，帮我看看从哪一步开始，不用新建。' }, check: r => r.mode === 'chat' },
  { name: 'missing-details-get-reviewable-defaults', request: { ...base, mode: 'create', tasks: [], instruction: '帮我创建一个任务：整理书桌。没有其他要求。' }, check: r => r.mode === 'create' && r.drafts.length === 1 && Boolean(r.drafts[0].dueDate) && r.drafts[0].estimatedDuration === 30 && r.warnings.some(w => /建议补全/.test(w)) },
  { name: 'explicit-time-range', request: { ...base, mode: 'create', tasks: [], instruction: `帮我创建任务：项目集中工作，开始时间 ${new Date(+now + 2*86400000).toISOString()}，结束时间 ${new Date(+now + 2*86400000 + 90*60000).toISOString()}。按开始到结束的时间段创建。` }, check: r => r.mode === 'create' && r.drafts.length === 1 && r.drafts[0].timingMode === 'range' && new Date(r.drafts[0].dueDate) - new Date(r.drafts[0].startAt) === 90*60000 },
];
const server = createGateway(readConfig()); server.listen(0,'127.0.0.1'); await once(server,'listening');
try {
  const url = `http://127.0.0.1:${server.address().port}/api/agent`;
  const headers = { Origin: 'https://tauri.localhost', 'Content-Type': 'application/json' };
  const session = await (await fetch(url+'/session',{method:'POST',headers,body:'{}'})).json();
  if (!/^mbs_[a-f0-9]{64}$/.test(session.token)) throw Error('SESSION_FAILED');
  for (const item of cases) {
    const started = Date.now();
    try {
      const response = await fetch(url+'/generate', {method:'POST',headers:{...headers,Authorization:`Bearer ${session.token}`},body:JSON.stringify(item.request),signal:AbortSignal.timeout(70000)});
      const value = await response.json();
      const passed = response.ok && item.check(value.result);
      report.checks.push({name:item.name,passed,status:response.status,elapsedMs:Date.now()-started});
      console.log(`${passed?'PASS':'FAIL'} ${item.name}`); if(!passed)process.exitCode=1;
    } catch { report.checks.push({name:item.name,passed:false,code:'VERIFICATION_FAILED',elapsedMs:Date.now()-started});console.log(`FAIL ${item.name}`);process.exitCode=1; }
  }
} finally { server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await writeFile('docs/AGENT_SCHEDULE_VERIFICATION.json',JSON.stringify(report,null,2)); }
