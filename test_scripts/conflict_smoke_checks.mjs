import assert from 'node:assert/strict';
export async function runConflictSmoke({main,click,shot,passed,until,delay}){
  const state=()=>main.evaluate(`JSON.parse(localStorage.getItem('__i18n_state'))`);
  const fill=async(selector,value)=>{await main.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(80);};
  const local=date=>new Date(+date-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  const start=new Date();start.setDate(start.getDate()+1);start.setHours(14,0,0,0);const end=new Date(+start+3600000);
  await click(main,'任务清单');await click(main,'添加任务');await click(main,'时间段');await fill('#title','冲突验收：会议 A');await fill('input[aria-label="开始时间"]',local(start));await fill('#dueDate',local(end));
  await main.evaluate(`(document.querySelector('#title')?.closest('form')??document.querySelector('form')).requestSubmit()`);await until(async()=>(await state()).data.tasks.some(t=>t.title==='冲突验收：会议 A'),'first event saved');
  await click(main,'添加任务');await click(main,'时间段');await fill('#title','冲突验收：会议 B');await fill('input[aria-label="开始时间"]',local(new Date(+start+1800000)));await fill('#dueDate',local(new Date(+end+1800000)));
  await until(()=>main.evaluate(`document.querySelector('form [role=alert]')?.innerText.includes('会议 A')`),'form conflict warning');
  await main.evaluate(`window.__testAlerts=[];window.alert=text=>window.__testAlerts.push(text);(document.querySelector('#title')?.closest('form')??document.querySelector('form')).requestSubmit()`);
  assert.equal(await main.evaluate(`window.__testAlerts.length`),1);assert.equal((await state()).data.tasks.some(t=>t.title==='冲突验收：会议 B'),false);
  await shot(main,'task-conflict-confirmation-zh-1200');
  await main.evaluate(`document.querySelector('form [role=alert] input[type=checkbox]').click();(document.querySelector('#title')?.closest('form')??document.querySelector('form')).requestSubmit()`);
  await until(async()=>(await state()).data.tasks.some(t=>t.title==='冲突验收：会议 B'),'overlap confirmed and saved');assert.equal((await state()).data.tasks.find(t=>t.title==='冲突验收：会议 B').conflictApprovals.length,1);
  await click(main,'日历&数据统计');await until(()=>main.evaluate(`!!document.querySelector('.mb-calendar')`),'calendar loaded');
  assert.equal(await main.evaluate(`document.querySelectorAll('.mb-calendar-conflict').length`),0);
  await main.evaluate(`(async()=>{const {businessRepository}=await import('/src/services/storage.ts');await businessRepository.transact(localStorage.getItem('currentUserId'),d=>({...d,tasks:d.tasks.map(t=>t.title==='冲突验收：会议 B'?{...t,startAt:new Date(+t.startAt+60000)}:t)}),()=>true);})()`);
  await until(()=>main.evaluate(`document.querySelectorAll('.mb-calendar-conflict').length===1`),'changed schedule invalidates confirmation');await shot(main,'calendar-conflict-warning-zh-1200');
  await click(main,'已核对，保留安排');await until(()=>main.evaluate(`document.querySelectorAll('.mb-calendar-conflict').length===0`),'calendar conflict confirmed');
  passed('Task form blocks unconfirmed overlapping events; confirmed imports stay clear in the calendar and changing times invalidates prior confirmation');
}
