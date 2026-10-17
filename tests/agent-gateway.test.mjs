import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { agentRequestSchema, validateAgentResult } from '../src/services/agentContracts.ts';
import { callDeepSeek, createGateway, readConfig } from '../server/gateway.mjs';
import { buildMessages } from '../server/prompts.mjs';

const config = { ...readConfig({ DEEPSEEK_API_KEY: 'test-supplier-key-not-real', MOTIBUDDY_GATEWAY_TOKEN: `mbg_${'a'.repeat(64)}` }), timeoutMs: 30 };
const request = () => ({ mode: 'create', locale: 'zh-CN', now: '2026-10-15T10:00:00Z', timeZone: 'Asia/Shanghai', instruction: 'Create a task', tasks: [], availableMinutes: 60, energy: 'normal' });
const result = () => ({ mode: 'create', summary: 'Draft', drafts: [{ title: 'Read', description: '', dueDate: null, priority: 'low', estimatedDuration: 10 }], questions: ['When?'], warnings: [] });
const reply = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }));
async function withGateway(fn, options = {}, overrides = {}) {
  const server = createGateway({ ...config, ...overrides }, { fetchImpl: async () => reply(result()), ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/agent/generate`;
  const post = (body = request(), headers = {}) => fetch(url, { method: 'POST', headers: { Origin: 'http://localhost:3000', Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try { await fn(post, url); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('contracts reject injected keys, arbitrary modes, naive dates and creation data leaks', () => {
  for (const bad of [{ ...request(), model: 'other' }, { ...request(), apiKey: 'bad' }, { ...request(), mode: 'delete' }, { ...request(), now: '2026-10-15' }, { ...request(), instruction: '' }]) assert.equal(agentRequestSchema.safeParse(bad).success, false);
  assert.equal(agentRequestSchema.safeParse(request()).success, true);
});
test('plans reject unknown IDs, duplicate IDs, invalid modes and over-budget recommendations', () => {
  const input = { ...request(), mode: 'plan', tasks: [{ id: 'one', title: 'Task', description: '', dueDate: '2026-10-20T00:00:00Z', priority: 'high', estimatedDuration: 20 }] };
  const item = { taskId: 'one', minutes: 20, reason: 'Due', firstStep: 'Start' };
  const plan = { mode: 'plan', summary: 'Plan', items: [item], questions: [], warnings: [] };
  assert.deepEqual(validateAgentResult(plan, input), plan);
  for (const items of [[{ ...item, taskId: 'unknown' }], [item, item], [{ ...item, minutes: 61 }]]) assert.throws(() => validateAgentResult({ ...plan, items }, input));
  assert.throws(() => validateAgentResult(result(), input));
});
test('official upstream URL, model and JSON mode are fixed and provider key is never in prompt', async () => {
  let observed;
  const value = await callDeepSeek(request(), config, async (url, options) => { observed = { url, ...options }; return reply(result()); });
  assert.equal(value.drafts[0].dueDate, null); assert.equal(observed.url, 'https://api.deepseek.com/chat/completions');
  const body = JSON.parse(observed.body); assert.equal(body.model, 'deepseek-flash'); assert.equal(body.response_format.type, 'json_object');
  assert.equal(JSON.stringify(body).includes(config.apiKey), false); assert.equal(observed.redirect, 'error');
  assert.equal(buildMessages({ ...request(), image: 'data:image/png;base64,YQ==' })[1].content[1].type, 'image_url');
});
test('upstream failures and malformed responses are sanitized', async () => {
  for (const fetchImpl of [async () => new Response(`secret ${config.apiKey}`, { status: 401 }), async () => new Response('not json'), async () => { throw new Error(config.apiKey); }]) {
    await assert.rejects(callDeepSeek(request(), config, fetchImpl), error => !error.message.includes(config.apiKey));
  }
});
test('gateway denies missing/wrong credentials and unknown origins before any model call', async () => {
  let calls = 0;
  await withGateway(async post => {
    assert.equal((await post(request(), { Authorization: '' })).status, 401);
    assert.equal((await post(request(), { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(request(), { Origin: '' })).status, 403);
    assert.equal(calls, 0);
  }, { fetchImpl: async () => { calls++; return reply(result()); } });
});

test('readiness works for native desktop origins without exposing secrets or calling the model', async () => {
  await withGateway(async (_post, url) => {
    const health = url.replace('/generate', '/health');
    for (const origin of ['http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost']) {
      const response = await fetch(health, { headers: { Origin: origin } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert.deepEqual(await response.json(), { service: 'motibuddy-private-ai', protocol: 1 });
    }
    assert.equal((await fetch(health, { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(health)).status, 403);
  }, { fetchImpl: () => assert.fail('health must not call provider') });
});
test('gateway allows preflight, returns only validated result and limits requests', async () => {
  await withGateway(async (post, url) => {
    const preflight = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000' } }); assert.equal(preflight.status, 204);
    const response = await post(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { result: result() });
    assert.equal((await post()).status, 429);
  }, {}, { perMinute: 1 });
});
test('gateway rejects simultaneous requests and invalid payloads', async () => {
  let release; let started;
  const ready = new Promise(resolve => { started = resolve; });
  await withGateway(async post => {
    assert.equal((await post({ ...request(), model: 'injected' })).status, 400);
    const first = post(); await ready;
    assert.equal((await post()).status, 429);
    release(); assert.equal((await first).status, 200);
  }, { fetchImpl: async () => { started(); await new Promise(resolve => { release = resolve; }); return reply(result()); } });
});
test('upstream request has a deadline and timeout errors do not expose inputs', async () => {
  await assert.rejects(callDeepSeek(request(), config, async (_url, options) => {
    await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 500); options.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('private details')); }); });
  }), /UPSTREAM_UNAVAILABLE/);
});
test('private configuration refuses a missing supplier key or a reused supplier-style gateway token', () => {
  assert.throws(() => readConfig({ DEEPSEEK_API_KEY: 'test-supplier-key-not-real', MOTIBUDDY_GATEWAY_TOKEN: 'sk-should-not-be-a-client-key' }));
  assert.throws(() => readConfig({ MOTIBUDDY_GATEWAY_TOKEN: config.token }));
});

test('automatic local sessions need no manually entered credential, expire and are bound to origin', async () => {
  let now = Date.now();
  await withGateway(async (post, url) => {
    const sessionUrl = url.replace('/generate','/session');
    const sessionReply = await fetch(sessionUrl,{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:'{}'});
    assert.equal(sessionReply.status,200);
    const session = await sessionReply.json();
    assert.match(session.token,/^mbs_[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(session).includes(config.apiKey),false);
    assert.equal(JSON.stringify(session).includes(config.token),false);
    const authorization = `Bearer ${session.token}`;
    assert.equal((await post(request(),{Authorization:authorization})).status,200);
    assert.equal((await post(request(),{Authorization:authorization,Origin:'http://127.0.0.1:3000'})).status,401);
    now += 10*60_000;
    assert.equal((await post(request(),{Authorization:authorization})).status,401);
  }, {clock:()=>now});
});
test('unknown origins cannot bootstrap sessions and new sessions cannot reset model-call quotas', async () => {
  await withGateway(async (post,url) => {
    const sessionUrl=url.replace('/generate','/session');
    const mint = origin => fetch(sessionUrl,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
    assert.equal((await mint('https://evil.example')).status,403);
    const first=await (await mint('http://localhost:3000')).json();
    assert.equal((await post(request(),{Authorization:`Bearer ${first.token}`})).status,200);
    const second=await (await mint('http://localhost:3000')).json();
    assert.notEqual(first.token,second.token);
    assert.equal((await post(request(),{Authorization:`Bearer ${second.token}`})).status,429);
  }, {}, {perMinute:1});
});
