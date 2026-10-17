import assert from 'node:assert/strict';
export async function runFocusSmoke({ main, click, shot, passed, until, delay, route, fillLogin }) {
  const state = () => main.evaluate(`(()=>{const id=localStorage.getItem('currentUserId');return JSON.parse(localStorage.getItem(id==='i18n-user'?'__i18n_state':'__i18n_state_'+id))})()`);
  const fill = async (selector,value,kind='HTMLInputElement') => { await main.evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${kind}.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(80); };
  await click(main,'宠物助手'); await delay(100);
  // Sidebar selection must survive mouse leave and React updates.
  assert.equal(await main.evaluate(`document.querySelector('button[aria-current=page]').textContent.trim()`),'宠物助手');
  await main.evaluate(`document.querySelector('button[aria-current=page]').dispatchEvent(new MouseEvent('mouseout',{bubbles:true}))`);
  assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('button[aria-current=page]')).backgroundColor`),'rgb(255, 94, 91)');
  assert.equal(await main.evaluate(`document.querySelectorAll('.mb-agent-shortcut').length`),6);
  await main.evaluate(`document.querySelector('.mb-agent-shortcut').click()`);await until(()=>main.evaluate(`document.querySelector('.mb-agent-log').getAttribute('aria-busy')==='false'`),'auto plan idle');await delay(100);
  assert.equal(await main.evaluate(`document.querySelector('.mb-agent-shortcut').getAttribute('aria-pressed')`),'true');
  await main.evaluate(`document.querySelector('.mb-agent-shortcut').click()`);await until(()=>main.evaluate(`document.querySelector('.mb-agent-log').getAttribute('aria-busy')==='false'`),'auto plan idle');await delay(100);
  assert.equal(await main.evaluate(`!!document.querySelector('.mb-agent-mode')`),false);
  await main.evaluate(`document.querySelectorAll('.mb-agent-shortcut')[2].click()`);await until(()=>main.evaluate(`document.querySelector('.mb-agent-log').getAttribute('aria-busy')==='false'`),'auto review idle');await delay(100);
  assert.equal(await main.evaluate(`!!document.querySelector('.mb-agent-weekly')`),true);
  await shot(main,'assistant-six-scenarios-zh-1200');
  await main.evaluate(`document.querySelectorAll('.mb-agent-shortcut')[2].click()`);
  // A formerly invalid proposal must become selected and confirmable after manual correction.
  await main.evaluate(`document.querySelectorAll('.mb-agent-shortcut')[1].click()`);
  await fill('.mb-agent-composer>textarea','整理一次测试任务','HTMLTextAreaElement');await click(main,'发送');
  await until(()=>main.evaluate(`document.querySelector('.mb-agent-log').getAttribute('aria-busy')==='false'&&!!document.querySelector('.mb-agent-card')`),'proposal ready');
  await main.evaluate(`document.querySelector('.mb-agent-edit-toggle').click()`);
  const dateSelector='.mb-agent-draft-editor .mb-agent-fields input[type=datetime-local]';
  await fill(dateSelector,'');
  await until(()=>main.evaluate(`!document.querySelector('.mb-agent-card input[type=checkbox]').checked`),'invalid draft unchecked');
  const future=new Date(Date.now()+4*86400000); const local=new Date(+future-future.getTimezoneOffset()*60000).toISOString().slice(0,16);
  // Keep the edited range short; extending only its end by four days would
  // correctly trigger the overlap guard instead of testing draft correction.
  await fill('.mb-agent-draft-editor>label input[type=datetime-local]',new Date(+future-30*60000-future.getTimezoneOffset()*60000).toISOString().slice(0,16));
  await fill(dateSelector,local);
  await until(()=>main.evaluate(`document.querySelector('.mb-agent-card input[type=checkbox]').checked`),'corrected draft selected');
  assert.equal(await main.evaluate(`document.querySelector('.mb-agent-actions .mb-agent-primary').disabled`),false);
  assert.equal(await main.evaluate(`document.querySelector('.mb-agent-log').innerText.includes('第二项希望哪天完成')`),false);
  await shot(main,'assistant-draft-corrected-zh-1200');
  // This scenario intentionally edits a proposal. Save it before the later
  // process-restart check so the real unsaved-draft guard cannot block reload.
  await click(main,'保存草稿');
  await until(()=>main.evaluate(`document.querySelector('button[aria-label="保存草稿"]').disabled`),'corrected draft durable');
  passed('Assistant navigation stays selected; six scenario cards toggle off; corrected drafts clear stale questions and become importable');

  await click(main,'专注空间');
  await until(()=>main.evaluate(`!!document.querySelector('.focus-setup .focus-primary')&&!document.querySelector('.focus-setup .focus-primary').disabled`),'focus setup loaded');
  await fill('input[name=focusMinutes]','1');await fill('input[name=breakMinutes]','1');await fill('input[name=cycles]','2');
  await shot(main,'focus-setup-zh-1200');
  await main.evaluate(`(()=>{const OriginalDate=Date;window.__focusClockOffset=0;window.Date=class extends OriginalDate{constructor(...args){if(args.length)super(...args);else super(OriginalDate.now()+window.__focusClockOffset);}static now(){return OriginalDate.now()+window.__focusClockOffset;}};})()`);
  await click(main,'开始专注');
  await until(()=>main.evaluate(`!!document.querySelector('.focus-screen')&&document.querySelector('[data-main-shell]').inert`),'focus entered');
  const firstQuote=await main.evaluate(`document.querySelector('.focus-stage blockquote').textContent`);
  assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('.focus-screen')).backgroundColor`),'rgb(255, 255, 255)');
  await shot(main,'focus-running-zh-1200');
  await main.evaluate(`window.__focusClockOffset+=61000`);
  await until(()=>main.evaluate(`!!document.querySelector('.focus-resting')`),'focus completed into break');
  await until(async()=> (await state()).data.settings.focusSpace?.active?.completedCycles===1,'completed round persisted');
  assert.equal(await main.evaluate(`document.querySelectorAll('.focus-confetti i').length`),54);
  assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('.focus-rest-video')).filter`),'blur(14px)');
  await shot(main,'focus-break-confetti-zh-1200');
  const breakFocus=(await state()).data.settings.focusSpace.active.focusMs;assert.equal(breakFocus,60000);
  await main.evaluate(`window.__focusClockOffset+=61000`);
  await until(()=>main.evaluate(`!!document.querySelector('.focus-stage blockquote')`),'second focus round');
  assert.notEqual(await main.evaluate(`document.querySelector('.focus-stage blockquote').textContent`),firstQuote);
  await main.evaluate(`window.__focusClockOffset+=13000`);await delay(650);
  await click(main,'退出专注空间');
  await until(()=>main.evaluate(`!document.querySelector('.focus-screen')&&!!document.querySelector('.focus-summary')`),'focus exit summary');
  let saved=(await state()).data.settings.focusSpace;
  assert.equal(saved.history.length,1);assert.equal(saved.active,null);assert.equal(saved.history[0].completedCycles,1);
  assert.ok(saved.history[0].focusMs>=73000&&saved.history[0].focusMs<80000);
  assert.equal(await main.evaluate(`document.querySelector('[data-main-shell]').inert`),false);
  await shot(main,'focus-exit-summary-zh-1200');
  await click(main,'日历&数据统计');
  assert.equal(await main.evaluate(`document.querySelector('.focus-statistics').innerText.includes('1')`),true);
  await shot(main,'focus-statistics-zh-1200');
  await main.evaluate(`localStorage.setItem('motibuddy.ui.locale','en-US');dispatchEvent(new StorageEvent('storage',{key:'motibuddy.ui.locale',newValue:'en-US'}))`);await delay(200);
  await click(main,'Focus space');await shot(main,'focus-setup-en-1200');
  await main.evaluate(`localStorage.setItem('motibuddy.ui.locale','zh-CN');dispatchEvent(new StorageEvent('storage',{key:'motibuddy.ui.locale',newValue:'zh-CN'}))`);await delay(200);
  await fill('input[name=focusMinutes]','1');await fill('input[name=breakMinutes]','1');await fill('input[name=cycles]','1');
  await click(main,'开始专注');await until(()=>main.evaluate(`!!document.querySelector('.focus-screen')`),'complete-loop start');
  await main.evaluate(`window.__focusClockOffset+=61000`);await until(()=>main.evaluate(`!!document.querySelector('.focus-resting')`),'complete-loop break');
  await main.evaluate(`window.__focusClockOffset+=61000`);await until(async()=> (await state()).data.settings.focusSpace.history.length===2,'natural completion saved');
  assert.equal((await state()).data.settings.focusSpace.history[1].reason,'completed');
  assert.equal((await state()).data.settings.focusSpace.history[1].focusMs,60000);
  await shot(main,'focus-cycle-complete-zh-1200');await click(main,'退出专注空间');
  await click(main,'开始专注');await until(()=>main.evaluate(`!!document.querySelector('.focus-screen')`),'save-failure test start');
  await main.evaluate(`window.__agentFailWrites=true;window.__focusClockOffset+=13000`);
  await until(()=>main.evaluate(`!!document.querySelector('.focus-screen .focus-error')`),'failed focus checkpoint pauses timer');
  const paused=await main.evaluate(`document.querySelector('[data-testid=focus-countdown]').textContent`);
  await main.evaluate(`window.__focusClockOffset+=61000`);await delay(650);
  assert.equal(await main.evaluate(`document.querySelector('[data-testid=focus-countdown]').textContent`),paused);
  await main.evaluate(`window.__agentFailWrites=false;document.querySelector('.focus-screen .focus-error button').click()`);
  await until(()=>main.evaluate(`!document.querySelector('.focus-screen .focus-error')`),'focus retry recovered');
  await click(main,'退出专注空间');await until(async()=> (await state()).data.settings.focusSpace.history.length===3,'retried partial session saved');
  saved=(await state()).data.settings.focusSpace;
  assert.equal(saved.history[2].completedCycles,0);assert.ok(saved.history[2].focusMs>=13000&&saved.history[2].focusMs<20000);
  // Simulate a new process: retain committed records, clear runtime auth via normal boot, and sign in again.
  await main.send('Page.reload');await delay(1000);await route(main,'/login');await fillLogin(main);await main.evaluate(`document.querySelector('form').requestSubmit()`);
  await until(()=>main.evaluate(`document.body.innerText.includes('我的任务')`),'login after focus restart');
  await click(main,'专注空间');await until(()=>main.evaluate(`!!document.querySelector('.focus-setup .focus-primary')&&!document.querySelector('.focus-setup .focus-primary').disabled`),'focus history restored');
  assert.deepEqual((await state()).data.settings.focusSpace.history,saved.history);
  assert.deepEqual(await main.evaluate(`[...document.querySelectorAll('.focus-history strong')].slice(1,3).map(node=>node.textContent)`),['3','2']);
  passed('Focus cycles switch between white and blurred video, celebrate once, exclude breaks, retain early-exit time and reload the same account statistics');
  await route(main,'/profile');await click(main,'退出登录');await route(main,'/login');
  await fill('input[name=email]','new-buddy@example.test');await fill('input[name=password]','NewBuddy2026');await main.evaluate(`document.querySelector('form').requestSubmit()`);
  await until(()=>main.evaluate(`document.body.innerText.includes('我的任务')`),'focus isolation account login');
  await click(main,'专注空间');await until(()=>main.evaluate(`!!document.querySelector('.focus-setup .focus-primary')&&!document.querySelector('.focus-setup .focus-primary').disabled`),'other account focus setup');
  assert.equal((await state()).data.settings.focusSpace,undefined);
  assert.equal(await main.evaluate(`document.querySelector('.focus-history strong').textContent`),'0 分 0 秒');
  passed('A complete focus loop saves once; failed checkpoints pause without crediting downtime, retry safely and remain isolated across accounts');
}
