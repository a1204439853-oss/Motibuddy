// Windows UI smoke test. Uses an isolated browser profile and a fake Tauri bridge;
// never opens the desktop application or reads real AppData. Node.js 24, no test dependency.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'node_modules/.cache/motibuddy-i18n/screenshots');
const profile = path.join(root, 'node_modules/.cache/motibuddy-i18n', `browser-${Date.now()}`);
const port = 4175;
const base = `http://127.0.0.1:${port}`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { checks: [], screenshots: [], errors: [] };
let server, browser, browserConnection;

async function until(action, description, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { const result = await action(); if (result) return result; } catch (error) { last = error; }
    await delay(150);
  }
  throw new Error(`Timeout: ${description}${last ? ` (${last.message})` : ''}`);
}

class CDP {
  constructor(socket) {
    this.socket = socket; this.sequence = 0; this.pending = new Map();
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const job = this.pending.get(message.id); if (!job) return;
        this.pending.delete(message.id); clearTimeout(job.timer);
        if (message.error) job.reject(new Error(message.error.message)); else job.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') {
        report.errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      }
    });
  }
  static async open(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    return new CDP(socket);
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, method === 'Page.captureScreenshot' ? 45000 : 20000);
      this.pending.set(id, { resolve, reject, timer }); this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result.value;
  }
  close() { this.socket.close(); }
}

const fixture = `(() => {
  if (!localStorage.getItem('__i18n_fixture')) {
    const now = new Date().toISOString(), due = new Date(Date.now() + 86400000).toISOString();
    localStorage.setItem('motibuddy.ui.locale', 'zh-CN');
    localStorage.setItem('users', JSON.stringify([{ id:'i18n-user', username:'Lin', email:'i18n@example.test', password:'hashed_LocalTest2026', avatar:'', createdAt:now, achievements:[] }]));
    localStorage.setItem('__i18n_state', JSON.stringify({ schemaVersion:1,userId:'i18n-user',revision:1,operations:[],data:{
      tasks:[{id:'one',title:'Ship localization',description:'中英文任务内容保持原样，不随界面语言改变。',priority:'high',status:'in-progress',createdAt:now,dueDate:due},
        {id:'two',title:'准备下一次产品迭代与测试清单',description:'核对任务、伙伴、设置和小组件。',priority:'urgent',status:'pending',createdAt:now,dueDate:due}],
      pet:{id:'pet',userId:'i18n-user',name:'团团',type:'cat',level:2,experience:18,health:85,happiness:78,hunger:35,energy:65,lastInteraction:now,lastFed:now,createdAt:now},
      achievements:[],settings:{theme:'default'} }}));
    localStorage.setItem('__i18n_fixture','yes');
  }
  let listenerId=0, widgetVisible=false; const listeners=new Map();
  window.__TAURI_METADATA__={__currentWindow:{label:location.pathname.includes('widget')?'widget':'main'},__windows:[{label:'main'},{label:'widget'}]};
  window.__TAURI__={};
  window.__TAURI_IPC__=message=>queueMicrotask(()=>{
    const reply=value=>window['_'+message.callback]?.(value);
    try {
      const original=JSON.parse(localStorage.getItem('__i18n_state'));
      const stateKey=message.userId===original.userId?'__i18n_state':'__i18n_state_'+message.userId;
      if(message.cmd==='read_business_state')return reply(JSON.parse(localStorage.getItem(stateKey)??'null'));
      if(message.cmd==='initialize_business_state'){
        const existing=localStorage.getItem(stateKey);if(existing)return reply(JSON.parse(existing));
        const state={schemaVersion:1,userId:message.userId,revision:1,operations:[],data:message.data};
        localStorage.setItem(stateKey,JSON.stringify(state));return reply(state);
      }
      if(message.cmd==='data_file_exists')return reply(false);
      if(message.cmd==='tauri'&&message.__tauriModule==='Path')return reply(message.message.cmd==='join'?message.message.paths.join('/'):'/isolated-test');
      if(message.cmd==='commit_business_state'){
        const old=JSON.parse(localStorage.getItem(stateKey));
        if(old.revision!==message.expectedRevision)throw Error('REVISION_CONFLICT');
        const next={...old,revision:old.revision+1,data:message.data,operations:[...old.operations,{id:message.operationId,baseRevision:old.revision}]};
        localStorage.setItem(stateKey,JSON.stringify(next));return reply(next);
      }
      if(message.cmd==='load_widget_data'){
        const state=JSON.parse(localStorage.getItem('__i18n_state')),pet=state.data.pet;
        return reply({user_id:state.userId,revision:state.revision,timestamp:0,tasks:state.data.tasks.map(task=>({...task,due_date:task.dueDate})),pet:pet?{...pet,pet_type:pet.type}:null});
      }
      if(message.cmd==='check_widget_visibility')return reply(widgetVisible);
      if(message.cmd==='toggle_widget_window')return reply(widgetVisible=!widgetVisible);
      if(message.cmd==='hide_widget_window'){widgetVisible=false;window.__hideWidgetRequests=(window.__hideWidgetRequests??0)+1;return reply(null);}
      if(message.cmd==='set_ui_language'){window.__trayLocale=message.locale;return reply(null);}
      if(message.cmd==='tauri'&&message.__tauriModule==='Event'){
        const event=message.message;
        if(event.cmd==='listen'){const id=++listenerId;listeners.set(id,event);return reply(id);}
        if(event.cmd==='unlisten')listeners.delete(event.eventId);
        if(event.cmd==='emit')for(const [id,entry] of listeners)if(entry.event===event.event)window['_'+entry.handler]?.({event:event.event,id,payload:event.payload,windowLabel:'main'});
        return reply(null);
      }
      return reply(null);
    }catch(error){window['_'+message.error]?.(error.message);}
  });
})()`;

async function page(url, width = 1600, height = 900) {
  const { targetId } = await browserConnection.send('Target.createTarget', { url: 'about:blank' });
  const targets = await (await fetch(`http://127.0.0.1:${browserPort}/json/list`)).json();
  const connection = await CDP.open(targets.find(target => target.id === targetId).webSocketDebuggerUrl);
  await connection.send('Page.enable'); await connection.send('Runtime.enable');
  await connection.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await connection.send('Page.addScriptToEvaluateOnNewDocument', { source: fixture });
  await connection.send('Page.navigate', { url });
  await until(() => connection.evaluate('!!document.querySelector("#root > *, #widget-root > *")'), 'React page rendered');
  return connection;
}
async function click(page, text) {
  assert.equal(await page.evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.textContent.replace(/\\s+/g,' ').trim()===${JSON.stringify(text)});if(!button)return false;button.click();return true})()`), true, `button: ${text}`);
  await delay(250);
}
async function route(page, target) {
  await page.evaluate(`history.pushState({},'',${JSON.stringify(target)});dispatchEvent(new PopStateEvent('popstate'))`);
  await delay(400);
}
async function language(page, next) {
  await page.evaluate(`document.querySelector('.language-switch button[lang="${next}"]').click()`);
  await until(() => page.evaluate(`document.documentElement.lang==="${next}"`), 'language selected');
}
async function fillLogin(page) {
  await page.evaluate(`(()=>{for(const [name,value] of [['email','i18n@example.test'],['password','LocalTest2026']]){const input=document.querySelector('input[name='+name+']');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
}
async function shot(page, name) {
  await page.send('Page.bringToFront');
  await delay(700);
  const result = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(output, `${name}.png`); await writeFile(file, Buffer.from(result.data, 'base64'));
  report.screenshots.push(file);
}
function passed(name) { report.checks.push(name); console.log(`PASS ${name}`); }
let browserPort;
try {
  await mkdir(output, { recursive: true }); await mkdir(profile, { recursive: true });
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = ''; server.stdout.on('data', data => { serverLog += data; }); server.stderr.on('data', data => { serverLog += data; });
  await until(async () => { if (server.exitCode !== null) throw new Error(serverLog); return (await fetch(base)).ok; }, 'local preview server');
  const executable = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
  let browserPath; for (const item of executable) { try { await access(item); browserPath = item; break; } catch {} }
  if (!browserPath) throw new Error('A local Edge or Chrome installation is required');
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--mute-audio', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  const lines = await until(async () => (await readFile(portFile, 'utf8')).trim().split('\n'), 'isolated browser');
  browserPort = Number(lines[0]); browserConnection = await CDP.open(`ws://127.0.0.1:${browserPort}${lines[1].trim()}`);

  const main = await page(`${base}/`);
  await until(() => main.evaluate('!!document.querySelector(".public-topbar-actions .language-switch")'), 'welcome language in top bar');
  assert.equal(await main.evaluate('!!document.querySelector(".public-settings-link")'), false);
  assert.ok(await main.evaluate(`(()=>{const group=document.querySelector('.language-switch').getBoundingClientRect(),login=document.querySelector('.public-login').getBoundingClientRect();return group.right<login.left&&Math.abs(group.top-login.top)<10&&group.top<64})()`), 'language switch sits next to top login');
  await until(() => main.evaluate('document.querySelector("video").readyState>=2'), 'welcome background video ready');
  report.welcomeVideo = await main.evaluate(`(()=>{const v=document.querySelector('video');return {width:v.videoWidth,height:v.videoHeight,paused:v.paused,time:v.currentTime,z:getComputedStyle(v).zIndex,parentZ:getComputedStyle(v.parentElement).zIndex}})()`);
  await shot(main, 'welcome-zh');
  await language(main, 'en-US');
  assert.equal(await main.evaluate('location.pathname'), '/');
  await shot(main, 'welcome-en');
  await click(main, 'LOGIN');
  await until(() => main.evaluate('document.body.innerText.includes("请输入") || !!document.querySelector("input[name=email]")'), 'login form');
  await fillLogin(main);
  await language(main, 'zh-CN');
  assert.deepEqual(await main.evaluate('[document.querySelector("input[name=email]").value,document.querySelector("input[name=password]").value,location.pathname]'), ['i18n@example.test','LocalTest2026','/']);
  await shot(main, 'login-zh');
  passed('Welcome and login switch inline in the top bar; login draft and URL preserved');
  await main.evaluate('document.querySelector("form").requestSubmit()');
  await until(() => main.evaluate('document.body.innerText.includes("我的任务")'), 'signed in task screen');
  assert.equal(await main.evaluate('document.body.innerText.includes("undefined/100")'), false);
  assert.equal(await main.evaluate('document.body.innerText.includes("85/100")'), true);
  assert.equal(await main.evaluate('document.body.innerText.includes("Ship localization")'), true);
  const before = await main.evaluate('localStorage.getItem("__i18n_state")');
  await shot(main, 'main-zh-1600'); passed('Chinese task labels and numeric pet stats; user content preserved');

  await main.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 675, deviceScaleFactor: 1, mobile: false });
  await shot(main, 'main-zh-1200');
  assert.ok(await main.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'main horizontal overflow');
  await click(main, '添加任务'); await shot(main, 'task-form-zh-1200');
  assert.ok(await main.evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.type==='submit');const r=button.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`), 'task submit must be visible');
  await click(main, '取消'); passed('Chinese main window and task form fit 1200×675');
  await click(main, '数据统计'); await shot(main, 'statistics-zh-1200');
  assert.ok(await main.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'statistics horizontal overflow');
  await click(main, '任务');
  await click(main, '桌面小组件未开启');
  assert.equal(await main.evaluate(`(()=>{const badge=[...document.querySelectorAll('span')].find(node=>node.textContent==='已开启');return badge&&getComputedStyle(badge).backgroundColor==='rgb(0, 206, 203)'})()`), true, 'translated widget badge keeps its active color');
  await click(main, '桌面小组件已开启');

  await click(main, '个人资料与设置');
  await until(() => main.evaluate('location.pathname==="/profile" && !!document.querySelector(".profile-language-row")'), 'sidebar opens combined profile');
  await main.evaluate('document.querySelector("button[aria-label=返回主页]").click()');
  await until(() => main.evaluate('document.body.innerText.includes("我的任务")'), 'back from profile');
  await main.evaluate(`document.querySelector('button[title="个人资料与设置"]').click()`);
  await until(() => main.evaluate('location.pathname==="/profile" && !!document.querySelector(".profile-language-row")'), 'gear opens combined profile in one click');
  await shot(main, 'profile-settings-zh');
  const widget = await page(`${base}/widget.html`, 360, 800);
  await until(() => widget.evaluate('document.body.innerText.includes("暂无待办任务") || document.body.innerText.includes("Ship localization")'), 'widget ready');
  await shot(widget, 'widget-zh-compact');
  await widget.evaluate('document.querySelector("button[title=展开]").click()'); await shot(widget, 'widget-zh-expanded');
  assert.ok(await widget.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'widget horizontal overflow');

  await click(main, '编辑资料');
  await main.evaluate(`(()=>{const input=document.querySelector('input[type=text]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Lin 草稿');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await language(main, 'en-US');
  assert.equal(await main.evaluate('document.querySelector("input[type=text]").value'), 'Lin 草稿', 'profile draft survives language switch');
  assert.equal(await main.evaluate('location.pathname'), '/profile');
  try {
    await until(() => widget.evaluate('document.documentElement.lang==="en-US" && document.body.innerText.includes("PET STATUS")'), 'widget follows language change');
  } catch (error) {
    report.languageDiagnostic = { main: await main.evaluate('({lang:document.documentElement.lang,stored:localStorage.getItem("motibuddy.ui.locale"),text:document.body.innerText})'), widget: await widget.evaluate('({lang:document.documentElement.lang,stored:localStorage.getItem("motibuddy.ui.locale"),text:document.body.innerText})') };
    throw error;
  }
  await shot(main, 'profile-settings-en-editing'); await shot(widget, 'widget-en-expanded');
  await click(main, 'Cancel');
  await main.evaluate(`document.querySelector('button[aria-label="Back to Home"]').click()`);
  await until(() => main.evaluate('document.body.innerText.includes("Your Tasks")'), 'English task screen without logout');
  assert.equal(await main.evaluate('localStorage.getItem("__i18n_state")'), before);
  assert.equal(await main.evaluate('localStorage.getItem("currentUserId")'), 'i18n-user');
  await shot(main, 'main-en-1200'); passed('Sidebar and gear open combined settings; profile draft survives; widget syncs; saved data unchanged');

  await route(main, '/settings');
  await until(() => main.evaluate('location.pathname==="/profile"'), 'legacy settings URL redirects to combined page');
  await main.send('Page.reload');
  await until(() => main.evaluate('document.documentElement.lang==="en-US" && !!document.querySelector(".public-topbar button[aria-pressed=true][lang=en-US]")'), 'language survives reload');
  await language(main, 'zh-CN');
  await shot(main, 'login-zh-after-reload'); passed('Language is remembered after reload; legacy settings URL is compatible');
  await main.send('Emulation.setDeviceMetricsOverride', { width: 440, height: 800, deviceScaleFactor: 1, mobile: false });
  await shot(main, 'login-zh-narrow');
  assert.ok(await main.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'narrow login horizontal overflow');
  await main.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 675, deviceScaleFactor: 1, mobile: false });

  // Browser reload intentionally requires signing in again; language must stay Chinese.
  await fillLogin(main);
  await main.evaluate('document.querySelector("form").requestSubmit()');
  await until(() => main.evaluate('document.body.innerText.includes("我的任务")'), 'sign in after reload');
  await route(main, '/profile');
  assert.ok(await main.evaluate('document.body.innerText.includes("设置安全问题")'), 'translated security setup action');
  await shot(main, 'profile-zh');
  await language(main, 'en-US'); await shot(main, 'profile-en');
  await language(main, 'zh-CN');
  await main.send('Emulation.setDeviceMetricsOverride', { width: 440, height: 800, deviceScaleFactor: 1, mobile: false });
  await shot(main, 'profile-zh-narrow');
  assert.ok(await main.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'narrow profile horizontal overflow');
  await main.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 675, deviceScaleFactor: 1, mobile: false });
  await click(main, '退出登录');
  await until(() => main.evaluate('!!document.querySelector("input[name=email]") && localStorage.getItem("currentUserId")===null'), 'logout retained in combined settings');
  assert.ok(await main.evaluate('window.__hideWidgetRequests>=1'), 'profile logout hides the desktop widget');
  await fillLogin(main); await main.evaluate('document.querySelector("form").requestSubmit()');
  await until(() => main.evaluate('document.body.innerText.includes("我的任务")'), 'sign in after combined settings logout');
  await route(main, '/achievements'); await shot(main, 'achievements-zh');
  await route(main, '/create-pet'); await shot(main, 'pet-selection-zh');
  passed('Chinese profile, achievement and adoption screens render');
  await route(main, '/profile'); await click(main, '退出登录');
  await click(main, '创建账号');
  await until(() => main.evaluate('!!document.querySelector("input[name=username]")'), 'registration form');
  await main.evaluate(`(()=>{for(const [name,value] of [['username','NewBuddy'],['email','new-buddy@example.test'],['password','NewBuddy2026'],['confirmPassword','NewBuddy2026']]){const input=document.querySelector('input[name='+name+']');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('form').requestSubmit()})()`);
  await until(() => main.evaluate('!!document.querySelector("input[name=email]") && !document.querySelector("input[name=username]")'), 'successful inline registration returns to login');
  await main.evaluate(`(()=>{for(const [name,value] of [['email','new-buddy@example.test'],['password','NewBuddy2026']]){const input=document.querySelector('input[name='+name+']');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('form').requestSubmit()})()`);
  await until(() => main.evaluate('location.pathname==="/create-pet"'), 'new account reaches adoption');
  const newUserId = await main.evaluate('localStorage.getItem("currentUserId")');
  assert.ok(newUserId && newUserId !== 'i18n-user');
  const newState = await main.evaluate(`JSON.parse(localStorage.getItem('__i18n_state_'+${JSON.stringify(newUserId)}))`);
  assert.equal(newState.data.tasks.length, 3); assert.equal(newState.data.settings.starterTasksVersion, 1);
  assert.ok(newState.data.tasks.every(task => task.title.startsWith('[示例]')));
  await main.evaluate(`(()=>{const input=document.querySelector('input[type=text]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'新伙伴');input.dispatchEvent(new Event('input',{bubbles:true}));[...document.querySelectorAll('h3')].find(node=>node.textContent==='小猫').closest('div[style*="cursor"]').click()})()`);
  await click(main, '迎接我的伙伴');
  await until(() => main.evaluate('document.body.innerText.includes("稍后设置")'), 'new pet saved');
  await click(main, '稍后设置');
  await until(() => main.evaluate('document.body.innerText.includes("我的任务") && document.body.innerText.includes("[示例] 完成你的第一个任务")'), 'new user sees starter tasks');
  await shot(main, 'new-user-starter-tasks-zh');
  passed('New registration returns to login; first sign-in and adoption show three persisted starter examples');
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Screenshots: ${output}`);
} catch (error) {
  report.failure = error.stack;
  await mkdir(output, { recursive: true }); await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.error(error); process.exitCode = 1;
} finally {
  if (browserConnection) { await browserConnection.send('Browser.close').catch(() => {}); browserConnection.close(); }
  if (browser && browser.exitCode === null) browser.kill();
  if (server && server.exitCode === null) server.kill();
}
