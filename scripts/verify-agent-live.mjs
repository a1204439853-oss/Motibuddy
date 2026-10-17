// End-to-end local gateway + official model, using only synthetic inputs. No secrets are logged.
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import sharp from 'sharp';
import { createGateway, readConfig } from '../server/gateway.mjs';
const report={checkedAt:new Date().toISOString(),provider:'DeepSeek',model:'deepseek-flash',automaticConnection:false,checks:[]};
const now=new Date(),dueDate=new Date(now.getTime()+3*86400000).toISOString();
const base={mode:'create',locale:'zh-CN',now:now.toISOString(),timeZone:'Asia/Shanghai',instruction:`创建一项任务：在 ${dueDate} 前整理报销材料，预计20分钟。`,availableMinutes:30,energy:'normal',tasks:[]};
const image=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500"><rect width="1200" height="500" fill="white"/><g fill="black" font-family="Arial" font-size="42"><text x="40" y="85">Task list (dates to be confirmed)</text><text x="40" y="200">1. Review budget - 20 minutes</text><text x="40" y="300">2. Send report - 10 minutes</text></g></svg>')).png().toBuffer();
const fixtures=[
  {name:'conversation',request:{...base,mode:'chat',instruction:'你好，请简短介绍你可以如何帮我安排待办事项。'}},
  {name:'text-task-draft',request:base},
  {name:'daily-plan',request:{...base,mode:'plan',instruction:'我有30分钟，有点累，请先做更紧急的事情，留一些缓冲。',tasks:[{id:'synthetic-task-1',title:'整理报销材料',description:'',dueDate,priority:'high',estimatedDuration:20},{id:'synthetic-task-2',title:'读一篇文章',description:'',dueDate,priority:'low',estimatedDuration:15}]}},
  {name:'image-task-draft',request:{...base,instruction:'请识别图片中的两项待办。没有日期，请保留空白。',image:`data:image/png;base64,${image.toString('base64')}`}},
];
const server=createGateway(readConfig());server.listen(0,'127.0.0.1');await once(server,'listening');
try {
  const url=`http://127.0.0.1:${server.address().port}/api/agent`;
  const headers={Origin:'http://localhost:3000','Content-Type':'application/json'};
  const session=await (await fetch(`${url}/session`,{method:'POST',headers,body:'{}'})).json();
  if(!/^mbs_[a-f0-9]{64}$/.test(session.token))throw Error('SESSION_FAILED');
  report.automaticConnection=true;
  for(const fixture of fixtures){
    const start=Date.now();
    try{
      const response=await fetch(`${url}/generate`,{method:'POST',headers:{...headers,Authorization:`Bearer ${session.token}`},body:JSON.stringify(fixture.request),signal:AbortSignal.timeout(70000)});
      const envelope=await response.json();
      if(!response.ok)throw Error(['UPSTREAM_REJECTED','UPSTREAM_BUSY','UPSTREAM_UNAVAILABLE','INVALID_MODEL_RESULT'].includes(envelope.error)?envelope.error:'VERIFICATION_FAILED');
      const result=envelope.result;
      if(fixture.name==='conversation'&&(result.mode!=='chat'||!result.summary))throw Error('SEMANTIC_CHECK_FAILED');
      if(fixture.name==='text-task-draft'&&(result.mode!=='create'||!result.drafts.length||!result.drafts[0].dueDate))throw Error('SEMANTIC_CHECK_FAILED');
      if(fixture.name==='daily-plan'&&(result.mode!=='plan'||!result.items.length))throw Error('SEMANTIC_CHECK_FAILED');
      if(fixture.name==='image-task-draft'&&(result.mode!=='create'||result.drafts.length!==2||result.drafts.some(draft=>draft.dueDate!==null)))throw Error('SEMANTIC_CHECK_FAILED');
      report.checks.push({name:fixture.name,passed:true,elapsedMs:Date.now()-start});console.log(`PASS ${fixture.name}`);
    }catch(error){
      const code=['UPSTREAM_REJECTED','UPSTREAM_BUSY','UPSTREAM_UNAVAILABLE','INVALID_MODEL_RESULT','SEMANTIC_CHECK_FAILED'].includes(error.message)?error.message:'VERIFICATION_FAILED';
      report.checks.push({name:fixture.name,passed:false,code,elapsedMs:Date.now()-start});console.log(`NOT VERIFIED ${fixture.name}: ${code}`);process.exitCode=1;
      if(code==='UPSTREAM_REJECTED')break;
    }
  }
}catch{report.checks.push({name:'automatic-connection',passed:false,code:'SESSION_FAILED'});process.exitCode=1;}
finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
await mkdir(new URL('../docs/',import.meta.url),{recursive:true});
await writeFile(new URL('../docs/AGENT_API_VERIFICATION.json',import.meta.url),JSON.stringify(report,null,2));
