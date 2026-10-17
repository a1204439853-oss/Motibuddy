import assert from 'node:assert/strict';

// Isolated synthetic responses; no actual provider key, gateway credential or account data.
export async function runAgentSmoke({ main, click, shot, passed, until, delay, route, fillLogin }) {
  const chineseLines = ['别催别催，脑子正在加热中！','正在翻箱倒柜找答案，等我一下下','稍等哦，我去脑子里抓个小精灵','你的问题我接住啦，马上来~','叮！思考模式启动中'];
  await main.evaluate(`(() => {
    const originalFetch=window.fetch.bind(window); window.__agentRequests=[];window.__agentSessions=0;
    window.fetch=async(url,options)=>{
      if(String(url).endsWith('/api/agent/session')){window.__agentSessions++;return new Response(JSON.stringify({token:'mbs_'+'b'.repeat(64),expiresAt:Date.now()+600000}),{status:200,headers:{'Content-Type':'application/json'}});}
      if(!String(url).includes('/api/agent/generate'))return originalFetch(url,options);
      const input=JSON.parse(options.body);window.__agentRequests.push({mode:input.mode,image:!!input.image,tasks:input.tasks.length,minutes:input.availableMinutes,energy:input.energy,instruction:input.instruction});
      await new Promise(resolve=>setTimeout(resolve,window.__agentDelay?1800:350));
      if(options.signal.aborted)throw new DOMException('Cancelled','AbortError');
      const future=new Date(Date.now()+3*86400000).toISOString();
      const result=input.mode==='chat'||input.mode==='assist'&&!input.instruction.includes('练习吉他')?{mode:'chat',summary:'你好，我们可以一起安排今天的小目标。',questions:[],warnings:[]}
        :input.mode==='plan'?{mode:'plan',summary:'先完成最重要的一小步。',items:[{taskId:input.tasks[0].id,minutes:5,reason:'这项任务已在你的待办中。',firstStep:'打开任务相关资料。'}],questions:[],warnings:[]}
        :{mode:'create',summary:input.image?'已识别图片，请校对。':'已整理两项草稿。',drafts:[{title:input.image?'图片导入待办':'整理项目测试清单',description:'这是自动化验收草稿。',dueDate:future,priority:'medium',estimatedDuration:15},...input.image?[]:[{title:'日期需要确认的待办',description:'',dueDate:null,priority:'low',estimatedDuration:null}]],questions:input.image?[]:['第二项希望哪天完成？'],warnings:[]};
      return new Response(JSON.stringify({result}),{status:200,headers:{'Content-Type':'application/json'}});
    };
  })()`);
  const fill = async (selector,value,kind='HTMLInputElement') => {
    assert.equal(await main.evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)return false;Object.getOwnPropertyDescriptor(${kind}.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`),true,selector);
    await delay(100);
  };
  const state = () => main.evaluate(`(()=>{const id=localStorage.getItem('currentUserId');return JSON.parse(localStorage.getItem(id==='i18n-user'?'__i18n_state':'__i18n_state_'+id))})()`);
  const changeLocale = async value => {
    await main.evaluate(`localStorage.setItem('motibuddy.ui.locale',${JSON.stringify(value)});dispatchEvent(new StorageEvent('storage',{key:'motibuddy.ui.locale',newValue:${JSON.stringify(value)}}))`);
    await until(()=>main.evaluate(`document.documentElement.lang===${JSON.stringify(value)}`),'assistant language');
  };
  const choose = async index => { await main.evaluate(`document.querySelectorAll('.mb-agent-shortcut')[${index}].click()`);await delay(100); };
  const send = async text => { await fill('.mb-agent-composer>textarea',text,'HTMLTextAreaElement');await click(main,'发送'); };
  const idle = () => until(()=>main.evaluate(`document.querySelector('.mb-agent-log').getAttribute('aria-busy')==='false'&&!document.querySelector('.mb-agent-composer>textarea').disabled`),'assistant idle');

  await click(main,'宠物助手');await idle();
  await delay(3500);
  assert.equal(await main.evaluate(`!!document.querySelector('[role=dialog]')`),false);
  assert.equal(await main.evaluate(`!!document.querySelector('.mb-agent input[type=password]')`),false);
  assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('.mb-agent')).backgroundColor`),'rgb(255, 255, 255)');
  assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('.mb-agent-compose-area')).backgroundColor`),'rgb(255, 255, 255)');
  assert.ok(await main.evaluate(`(()=>{const agent=document.querySelector('.mb-agent').getBoundingClientRect(),pet=document.querySelector('[data-testid=pet-interaction]').getBoundingClientRect();return agent.left>200&&agent.right<pet.left&&pet.right<=innerWidth&&!!document.querySelector('button[title="个人资料与设置"]')})()`));
  await shot(main,'agent-chat-welcome-zh-1200');
  await choose(0);await idle();
  assert.equal(await main.evaluate('window.__agentRequests.length'),1);
  assert.equal(await main.evaluate('window.__agentRequests[0].mode'),'plan');
  assert.equal(await main.evaluate("!!document.querySelector('.mb-agent-plan-timeline time')"),true);
  const petExperience=(await state()).data.pet.experience;
  await send('我有30分钟，今天有点累');await idle();
  assert.equal((await state()).data.pet.experience,petExperience);
  assert.deepEqual(await main.evaluate(`(()=>{const r=window.__agentRequests[1];return {mode:r.mode,minutes:r.minutes,energy:r.energy}})()`),{mode:'plan',minutes:30,energy:'low'});
  assert.ok(await main.evaluate(`document.querySelector('[data-testid=pet-dialogue] p').innerText.includes('认真想')`));
  assert.equal(await main.evaluate(`document.querySelector('[data-testid=pet-interaction]').dataset.activeVideo`),'random');
  await click(main,'保存今日计划');
  assert.equal((await state()).data.settings.agentTodayPlan.plan.items.length,1);
  assert.equal(await main.evaluate('window.__agentSessions'),1);
  assert.equal(await main.evaluate(`Object.values(localStorage).some(value=>value.includes('mbs_'+'b'.repeat(64)))`),false);
  await shot(main,'agent-chat-plan-pet-zh-1200');
  passed('Inline three-column assistant plans immediately with a timeline, connects automatically and animates the pet with a requested thinking line');

  await choose(1);await send('帮我整理项目测试工作。');await idle();
  assert.deepEqual(await main.evaluate(`[...document.querySelectorAll('.mb-agent-card input[type=checkbox]')].map(input=>input.checked)`),[true,true]);
  assert.equal(await main.evaluate(`document.querySelector('.mb-agent-log').innerText.includes('建议补全')`),false);
  await main.evaluate(`document.querySelectorAll('.mb-agent-card input[type=checkbox]')[1].click();document.querySelector('.mb-agent-edit-toggle').click()`);
  await fill('.mb-agent-card input:not([type=checkbox])','编辑后保留的任务标题');await click(main,'保存草稿');
  assert.equal((await state()).data.settings.agentWorkspace.result.drafts[0].title,'编辑后保留的任务标题');
  await click(main,'任务清单');await click(main,'宠物助手');
  assert.equal(await main.evaluate(`document.querySelector('.mb-agent-card input:not([type=checkbox])').value`),'编辑后保留的任务标题');
  // Remount the main screen to verify durable draft restoration, beyond just hiding a view.
  await route(main,'/profile');await main.evaluate(`document.querySelector('button[aria-label="返回主页"]').click()`);
  await until(()=>main.evaluate(`document.body.innerText.includes('我的任务')`),'back to main');
  await click(main,'宠物助手');await idle();
  await main.evaluate(`document.querySelector('.mb-agent-edit-toggle').click()`);
  assert.equal(await main.evaluate(`document.querySelector('.mb-agent-card input:not([type=checkbox])').value`),'编辑后保留的任务标题');
  const before=(await state()).data.tasks.length;
  await main.evaluate(`(()=>{const ipc=window.__TAURI_IPC__;window.__TAURI_IPC__=message=>{if(window.__agentFailImport&&message.cmd==='commit_business_state'&&message.operationId?.startsWith('agent_')){queueMicrotask(()=>window['_'+message.error]?.('TEST_IMPORT_FAILED'));return;}ipc(message);};window.__agentFailImport=true;})()`);
  await click(main,'确认录入 1 项');await until(()=>main.evaluate(`document.body.innerText.includes('重试本批次')&&document.querySelector('.mb-agent-log').getAttribute('aria-busy')==='false'`),'failed import');
  assert.equal((await state()).data.tasks.length,before);
  await main.evaluate('window.__agentFailImport=false');await click(main,'重试本批次');await idle();
  assert.equal((await state()).data.tasks.length,before+1);
  assert.equal((await state()).data.tasks.filter(task=>task.title==='编辑后保留的任务标题').length,1);
  await changeLocale('en-US');
  assert.ok(await main.evaluate(`document.querySelector('.mb-agent-log').innerText.includes('Selected tasks were imported together.')`));
  await shot(main,'agent-chat-import-en-1200');
  passed('Conversation keeps editable drafts across navigation; persisted drafts recover and failed batches retry without duplicates');

  await changeLocale('zh-CN');await choose(1);
  await main.evaluate(`(()=>{const canvas=document.createElement('canvas');canvas.width=900;canvas.height=400;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,900,400);context.fillStyle='#222';context.font='32px Arial';context.fillText('Task list: review test cases',30,80);canvas.toBlob(blob=>{const transfer=new DataTransfer();transfer.items.add(new File([blob],'synthetic-task.png',{type:'image/png'}));const input=document.querySelector('.mb-agent input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));});})()`);
  await until(()=>main.evaluate(`!!document.querySelector('.mb-agent-attachment img')&&!document.querySelector('.mb-agent-composer>textarea').disabled`),'image attachment');
  await send('整理图片里的待办事项。');await idle();
  assert.equal(await main.evaluate(`document.querySelector('.mb-agent-card h4').textContent`),'图片导入待办');
  assert.deepEqual(await main.evaluate(`(()=>{const r=window.__agentRequests[window.__agentRequests.length-1];return {image:r.image,tasks:r.tasks,mode:r.mode}})()`),{image:true,tasks:0,mode:'create'});
  assert.ok(await main.evaluate(`!!document.querySelector('.mb-agent-message-user img')`));
  assert.ok(await main.evaluate(`(()=>{const area=document.querySelector('.mb-agent-compose-area').getBoundingClientRect(),card=document.querySelector('.mb-agent-shortcut').getBoundingClientRect(),input=document.querySelector('.mb-agent-composer>textarea').getBoundingClientRect();return card.bottom<input.top&&area.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth})()`));
  await shot(main,'agent-chat-image-zh-1200');
  await changeLocale('en-US');await shot(main,'agent-chat-image-en-1200');
  await main.send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});await shot(main,'agent-chat-image-en-1600');
  await changeLocale('zh-CN');await shot(main,'agent-chat-image-zh-1600');
  await main.send('Emulation.setDeviceMetricsOverride',{width:1200,height:675,deviceScaleFactor:1,mobile:false});
  passed('Task cards sit above the chat composer; image previews and editable messages fit both desktop sizes and languages');

  await main.evaluate('window.__agentDelay=true');await send('再检查一下这批任务。');
  await click(main,'任务清单');
  const snapshot=await state();await delay(2100);
  assert.deepEqual((await state()).data.settings.agentWorkspace,snapshot.data.settings.agentWorkspace);
  assert.deepEqual((await state()).data.tasks,snapshot.data.tasks);
  await route(main,'/profile');await click(main,'退出登录');await fillLogin(main);await main.evaluate('document.querySelector("form").requestSubmit()');
  await until(()=>main.evaluate(`document.body.innerText.includes('我的任务')`),'different account');
  await click(main,'宠物助手');await idle();
  assert.equal(await main.evaluate(`!!document.querySelector('.mb-agent-card')`),false);
  const sessionsBefore=await main.evaluate('window.__agentSessions');await main.evaluate('window.__agentDelay=false');await send('你好，你可以帮我做什么？');await idle();
  assert.ok(await main.evaluate(`document.querySelector('.mb-agent-log').innerText.includes('你好，我们可以一起安排今天')`));
  assert.equal(await main.evaluate('window.__agentSessions'),sessionsBefore+1);
  assert.equal(await main.evaluate(`!!document.querySelector('.mb-agent input[type=password]')`),false);
  passed('Navigation cancels late AI results; a different account starts a fresh automatic session and can chat without credentials');

  const name=await main.evaluate(`JSON.parse(localStorage.getItem('__i18n_state')).data.pet.name`);
  assert.equal(await main.evaluate(`document.querySelector('.mb-agent-message-assistant .mb-agent-speaker').textContent`),name);
  await main.evaluate(`(()=>{const ipc=window.__TAURI_IPC__;window.__TAURI_IPC__=message=>{if(message.cmd==='recognize_voice'){setTimeout(()=>window['_'+message.callback]?.('明天练习吉他'),window.__speechDelay??150);return;}if(message.cmd==='cancel_voice')return queueMicrotask(()=>window['_'+message.callback]?.(null));ipc(message);}})()`);
  const requests=await main.evaluate('window.__agentRequests.length');
  await click(main,'语音输入');
  await until(()=>main.evaluate(`document.querySelector('.mb-agent-composer>textarea').value==='明天练习吉他'`),'dictation review');
  assert.equal(await main.evaluate('window.__agentRequests.length'),requests);
  await click(main,'发送');await idle();
  assert.equal(await main.evaluate(`document.querySelectorAll('.mb-agent-card').length`),2);
  assert.equal(await main.evaluate(`window.__agentRequests.at(-1).mode`),'assist');
  assert.equal(await main.evaluate(`getComputedStyle(document.querySelector('[data-testid=pet-dialogue]')).backgroundColor`),'rgba(0, 0, 0, 0)');
  const count=(await state()).data.tasks.length;
  await main.evaluate(`document.querySelectorAll('.mb-agent-card input[type=checkbox]')[1].click()`);
  await click(main,'确认录入 1 项');await idle();
  assert.equal((await state()).data.tasks.length,count+1);
  await main.evaluate(`window.__speechDelay=1000`);
  await click(main,'语音输入');await click(main,'任务清单');await delay(1200);await click(main,'宠物助手');
  assert.equal(await main.evaluate(`document.querySelector('.mb-agent-composer>textarea').value`),'');
  await shot(main,'agent-voice-confirmation-zh-1200');
  passed('Assistant uses the pet name; dictation stays editable, automatic intent proposes defaults, confirmation syncs tasks and navigation cancels late transcripts');
}
