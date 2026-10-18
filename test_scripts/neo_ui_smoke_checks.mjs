import assert from 'node:assert/strict';

/** Isolated fixture checks for layout, acknowledged completion and real pointer states. */
export async function runNeoSmoke({main, click, shot, passed, until, delay, route}) {
  const state = () => main.evaluate(`JSON.parse(localStorage.getItem('__i18n_state'))`);
  const setLocale = async locale => { await main.evaluate(`localStorage.setItem('motibuddy.ui.locale',${JSON.stringify(locale)});dispatchEvent(new StorageEvent('storage',{key:'motibuddy.ui.locale',newValue:${JSON.stringify(locale)}}))`); await delay(120); };
  for (const width of [1600,1200,1024]) {
    await main.send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:false});
    await until(()=>main.evaluate(`document.querySelector('.neo-task-card')?.getBoundingClientRect().width>200`),'task layout');
    assert.ok(await main.evaluate(`document.documentElement.scrollWidth<=innerWidth`));
    assert.ok(await main.evaluate(`(()=>{const a=document.querySelector('.neo-primary-column').getBoundingClientRect(),b=document.querySelector('.neo-companion-column').getBoundingClientRect();return a.right<=b.left&&b.right<=innerWidth&&a.width>=380})()`),'working columns must not overlap');
    assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('[data-main-shell]')).backgroundImage`),'none');
    assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('.neo-companion-panel')).backdropFilter`),'none');
    await shot(main,`neo-tasks-${width}`);
  }
  await main.send('Emulation.setDeviceMetricsOverride',{width:1200,height:675,deviceScaleFactor:1,mobile:false});
  const pointer=await main.evaluate(`(()=>{const r=document.querySelector('.neo-page-heading .neo-primary').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await main.send('Input.dispatchMouseEvent',{type:'mouseMoved',...pointer});await delay(150);
  await main.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pointer});await delay(150);
  assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('.neo-page-heading .neo-primary')).transform`),'matrix(1, 0, 0, 1, 2, 2)');
  assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('.neo-page-heading .neo-primary')).boxShadow`),'none');
  await main.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pointer});
  await until(()=>main.evaluate(`!!document.querySelector('.neo-task-form')`),'task form opens');
  await shot(main,'neo-task-form');await click(main,'取消');
  passed('Neo task columns fit 1600/1200/1024; real pointer press follows the hard-shadow axis and opens the task form');

  const before=await state();
  await main.evaluate(`document.querySelector('.neo-task-toggle').click()`);
  await until(async()=>(await state()).data.tasks.some(task=>task.status==='completed'),'completion durable');
  assert.ok(await main.evaluate(`!!document.querySelector('.neo-task-card[data-status=completed] .neo-task-toggle[aria-pressed=true]')`));
  assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('.neo-task-card[data-status=completed]')).opacity`),'1');
  await shot(main,'neo-task-completed');
  await main.evaluate(`document.querySelector('.neo-task-card[data-status=completed] .neo-task-toggle').click()`);
  await until(async()=>(await state()).data.tasks.every(task=>task.status!=='completed'),'reopened durable');
  assert.equal((await state()).data.tasks.length,before.data.tasks.length);
  passed('Task completion keeps text readable, follows the acknowledged transaction and can be reopened without duplicate records');

  await click(main,'宠物助手');await until(()=>main.evaluate(`!!document.querySelector('.mb-agent-welcome')`),'new assistant');
  assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('.neo-nav-item[aria-current=page]')).backgroundColor`),'rgb(69, 214, 197)');
  const left=await main.evaluate(`document.querySelector('.mb-agent-shortcuts').scrollLeft`);await delay(650);
  assert.ok(await main.evaluate(`document.querySelector('.mb-agent-shortcuts').scrollLeft!==${left}`),'new chat carousel moves');
  await main.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await delay(200);
  const stopped=await main.evaluate(`document.querySelector('.mb-agent-shortcuts').scrollLeft`);await delay(500);
  assert.equal(await main.evaluate(`document.querySelector('.mb-agent-shortcuts').scrollLeft`),stopped,'changing OS motion preference stops carousel');
  await main.evaluate(`(()=>{const e=document.querySelector('.mb-agent-composer>textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'今天想从一件小事开始');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click(main,'发送');await until(()=>main.evaluate(`document.querySelector('.mb-agent-log').getAttribute('aria-busy')==='false'&&document.querySelectorAll('.mb-agent-message').length>=2`),'assistant response');
  assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('.mb-agent-message:last-child')).animationDuration`),'0s');
  await shot(main,'neo-assistant-reduced-motion');
  await main.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  const chat=await main.evaluate(`document.querySelector('.mb-agent-log').innerText`);
  await click(main,'任务清单');await click(main,'宠物助手');
  assert.equal(await main.evaluate(`document.querySelector('.mb-agent-log').innerText`),chat,'changing views preserves conversation');
  await setLocale('en-US');await shot(main,'neo-assistant-en');await setLocale('zh-CN');
  passed('Assistant uses the selected navigation state, retains conversation across views and stops automatic movement when reduced motion changes');

  for(const [label,selector,name] of [['日历','.calendar-workspace','calendar'],['数据统计','.statistics-workspace','statistics'],['专注空间','.focus-setup','focus'],['手账本&纪念日','.notebook-module','notebook']]) {
    await click(main,label);await until(()=>main.evaluate(`!!document.querySelector('${selector}')`),name);
    assert.ok(await main.evaluate(`document.documentElement.scrollWidth<=innerWidth`));
    await shot(main,`neo-${name}`);
  }
  await route(main,'/profile');await until(()=>main.evaluate(`!!document.querySelector('.profile-panel')`),'profile');
  await shot(main,'neo-profile');
  await main.send('Emulation.setDeviceMetricsOverride',{width:440,height:800,deviceScaleFactor:1,mobile:false});
  await shot(main,'neo-profile-narrow');assert.ok(await main.evaluate(`document.documentElement.scrollWidth<=innerWidth`));
  passed('Calendar, statistics, focus, notebook and settings share the system with a narrow settings layout');
}
