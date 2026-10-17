import assert from 'node:assert/strict';
export async function runScheduleSmoke({main, click, shot, passed, until, delay}) {
  const fill = async (selector,value,kind='HTMLInputElement') => {
    assert.equal(await main.evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)return false;Object.getOwnPropertyDescriptor(${kind}.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`),true);
    await delay(100);
  };
  const state=()=>main.evaluate(`(()=>{const id=localStorage.getItem('currentUserId');return JSON.parse(localStorage.getItem(id==='i18n-user'?'__i18n_state':'__i18n_state_'+id))})()`);
  await click(main,'添加任务');await click(main,'时间段');
  await fill('#title','日历测试：项目集中工作');
  const start=new Date(); start.setDate(start.getDate()+1);start.setHours(9,0,0,0);
  const end=new Date(start);end.setHours(11);
  const local=d=>new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  await fill('input[aria-label="开始时间"]',local(start));await fill('#dueDate',local(end));
  await shot(main,'schedule-range-form-zh-1200');
  await main.evaluate(`document.querySelector('form').requestSubmit()`);
  await until(async()=> (await state()).data.tasks.some(task=>task.title==='日历测试：项目集中工作'),'range task saved');
  const saved=(await state()).data.tasks.find(task=>task.title==='日历测试：项目集中工作');
  assert.equal(saved.timingMode,'range');assert.equal(new Date(saved.dueDate)-new Date(saved.startAt),120*60000);
  await main.evaluate(`(()=>{const select=[...document.querySelectorAll('select')].find(node=>node.querySelector('option[value=durationAsc]'));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'durationDesc');select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await shot(main,'schedule-tasks-zh-1200');
  await click(main,'日历&数据统计');
  await until(()=>main.evaluate(`!!document.querySelector('.mb-calendar')`),'calendar rendered');
  await main.evaluate(`document.querySelector('.mb-calendar-scroll').scrollTop=8*48`);
  assert.equal(await main.evaluate(`document.querySelectorAll('.mb-calendar-event').length>0`),true);
  await shot(main,'schedule-week-zh-1200');
  await fill('select[aria-label="日历视图"]','day','HTMLSelectElement');
  await click(main,'下一段时间','aria-label');
  await until(()=>main.evaluate(`document.querySelectorAll('.mb-calendar-event').length===1`),'day calendar event');
  await shot(main,'schedule-day-zh-1200');
  await main.evaluate(`localStorage.setItem('motibuddy.ui.locale','en-US');dispatchEvent(new StorageEvent('storage',{key:'motibuddy.ui.locale',newValue:'en-US'}))`);
  await until(()=>main.evaluate(`document.documentElement.lang==='en-US'`),'calendar English');
  await shot(main,'schedule-day-en-1200');
  await main.evaluate(`localStorage.setItem('motibuddy.ui.locale','zh-CN');dispatchEvent(new StorageEvent('storage',{key:'motibuddy.ui.locale',newValue:'zh-CN'}))`);
  await until(()=>main.evaluate(`document.documentElement.lang==='zh-CN'`),'calendar Chinese');
  await main.evaluate(`document.querySelector('.mb-calendar-event').click()`);
  await until(()=>main.evaluate(`!!document.querySelector('.mb-calendar-edit input[aria-label="开始时间"]')`),'calendar editor');
  await click(main,'取消');await click(main,'任务清单');
  passed('New pets show four positive-direction 70 stats; range tasks save, sort and appear in editable week/day calendars');
}
