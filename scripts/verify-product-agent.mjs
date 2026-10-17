// Synthetic inputs only. Never print private configuration, model bodies or personal records.
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {callDeepSeek,readConfig} from '../server/gateway.mjs';
import {scenarioInstruction} from '../src/services/agentScenarios.ts';
const now=new Date(),date=new Date(+now+3*86400000).toISOString().slice(0,10),dueDate=`${date}T10:00:00+08:00`;
const task={id:'sample',title:'整理阅读笔记',description:'合成验收数据',dueDate,priority:'high',estimatedDuration:20};
const base={locale:'zh-CN',personality:'soft',now:now.toISOString(),timeZone:'Asia/Shanghai',availableMinutes:60,energy:'normal',completeMissing:true,tasks:[]};
const image=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="240"><rect width="1000" height="240" fill="white"/><text x="30" y="100" font-size="36" font-family="Arial">Team meeting: ${date} 10:00 (UTC+8)</text></svg>`)).png().toBuffer();
const cases=[
 {name:'automatic-daily-plan',request:{...base,mode:'plan',tasks:[task],instruction:scenarioInstruction('plan',[],'zh-CN',now)+'请直接根据现有任务梳理今天的安排。'},check:r=>r.mode==='plan'&&r.items.length===1&&r.items[0].taskId==='sample'},
 {name:'weekly-comparison',request:{...base,mode:'chat',instruction:scenarioInstruction('review',[{...task,status:'completed',completedAt:new Date(+now-3600000)}],'zh-CN',now)+'请直接输出本周复盘和下周调整建议。'},check:r=>r.mode==='chat'&&r.summary.length>30},
 {name:'image-single-timestamp',request:{...base,mode:'create',instruction:'识别图片中这一个会议，单一时间点用作截止时间，不必另补结束时间。',image:`data:image/png;base64,${image.toString('base64')}`},check:r=>r.mode==='create'&&r.drafts.length===1&&r.drafts[0].timingMode!=='range'&&+new Date(r.drafts[0].dueDate)===+new Date(dueDate)},
 {name:'scheduled-news-with-publisher-evidence',request:{...base,mode:'chat',news:true,instruction:'用中文写一份简短晨间新闻摘要，只根据提供的新闻来源。'},check:r=>r.mode==='chat'&&/来源：/.test(r.summary)&&/https:\/\//.test(r.summary)},
];
const report={checkedAt:now.toISOString(),model:'deepseek-flash',syntheticOnly:true,checks:[]};
const config=readConfig();
for(const item of cases){const started=Date.now();try{const result=await callDeepSeek(item.request,config);const passed=item.check(result);report.checks.push({name:item.name,passed,elapsedMs:Date.now()-started});console.log(`${passed?'PASS':'FAIL'} ${item.name}`);if(!passed)process.exitCode=1;}catch(error){const code=['UPSTREAM_UNAVAILABLE','UPSTREAM_BUSY','UPSTREAM_REJECTED','INVALID_MODEL_RESULT'].includes(error.code)?error.code:'VERIFICATION_FAILED';report.checks.push({name:item.name,passed:false,code,elapsedMs:Date.now()-started});console.log(`NOT VERIFIED ${item.name}: ${code}`);process.exitCode=1;}}
await writeFile('docs/PRODUCT_AGENT_VERIFICATION.json',JSON.stringify(report,null,2));
