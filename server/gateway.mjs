import http from 'node:http';
import { createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { agentRequestSchema, validateAgentResult } from '../src/services/agentContracts.ts';
import { buildMessages } from './prompts.mjs';
import { fetchNews } from './news.mjs';
import {synthesize} from './tts.mjs';

const digest = value => createHash('sha256').update(value).digest();
export function readConfig(env = process.env) {
  const token = env.MOTIBUDDY_GATEWAY_TOKEN ?? '';
  if (!/^mbg_[A-Za-z0-9_-]{40,100}$/.test(token)) throw new Error('Configure a separate MOTIBUDDY_GATEWAY_TOKEN (mbg_ plus 40+ random characters).');
  if (!env.DEEPSEEK_API_KEY || env.DEEPSEEK_API_KEY.length < 20) throw new Error('Configure DEEPSEEK_API_KEY in the private server environment.');
  const port = Number(env.AGENT_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid AGENT_PORT.');
  return { token, apiKey: env.DEEPSEEK_API_KEY, port, ttsId:env.TENCENT_TTS_SECRET_ID,ttsKey:env.TENCENT_TTS_SECRET_KEY,
    origins: new Set(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost']),
    timeoutMs: 60_000, perMinute: 10, perDay: 100, maxConcurrent: 1 };
}

class GatewayError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
export async function callDeepSeek(request, config, fetchImpl = fetch, signal) {
  const abort = AbortSignal.any([AbortSignal.timeout(config.timeoutMs), ...(signal ? [signal] : [])]);
  let response;
  let news;
  if(request.news){try{news=await fetchNews(fetchImpl,abort);}catch{throw new GatewayError('UPSTREAM_UNAVAILABLE',502);}}
  try {
    response = await fetchImpl('https://api.deepseek.com/chat/completions', {
      method: 'POST', redirect: 'error', signal: abort,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'deepseek-flash', messages: buildMessages(request, news),
        thinking: { type: 'disabled' }, response_format: { type: 'json_object' }, max_tokens: 5000, stream: false }),
    });
  } catch { throw new GatewayError('UPSTREAM_UNAVAILABLE', 502); }
  if (!response.ok) {
    // Never forward upstream bodies: they can include private inputs or credentials.
    await response.body?.cancel().catch(() => {});
    const error = new GatewayError(response.status === 429 ? 'UPSTREAM_BUSY' : 'UPSTREAM_REJECTED', 502);
    error.upstreamStatus = response.status;
    throw error;
  }
  try {
    // Read a bounded response even when a compromised/misconfigured upstream ignores max_tokens.
    const reader = response.body.getReader(); let bytes = 0; const parts = [];
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 256_000) { await reader.cancel(); throw new Error(); }
      parts.push(Buffer.from(value));
    }
    const envelope = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (envelope.choices?.[0]?.finish_reason !== 'stop') throw new Error();
    const result=validateAgentResult(JSON.parse(envelope.choices[0].message.content), request);
    if(news){result.summary=(result.summary.slice(0,1000)+'\n\n'+(request.locale==='zh-CN'?`来源：${news[0].publisher}（仅此来源）；抓取于 `:`Source: ${news[0].publisher} only; retrieved `)+new Date().toISOString()+'\n'+news.slice(0,4).map(item=>`${item.published.slice(0,10)} ${item.title.slice(0,60)}\n${item.url}`).join('\n')).slice(0,2000);}
    return result;
  } catch { throw new GatewayError('INVALID_MODEL_RESULT', 502); }
}

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 3_300_000) throw new GatewayError('BODY_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new GatewayError('INVALID_REQUEST', 400); }
}

export function createGateway(config, { fetchImpl = fetch, clock = () => Date.now() } = {}) {
  let active = 0, minuteKey = -1, minuteCount = 0, dayKey = -1, dayCount = 0;
  const sessions = new Map();
  let ttsActive=0,ttsMinute=-1,ttsDay=-1,ttsCount=0,ttsCharacters=0;
  let sessionMinute = -1, sessionCount = 0;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body) => {
      if (!res.destroyed && !res.writableEnded) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    };
    const origin = req.headers.origin;
    if (!origin || !config.origins.has(origin)) return reply(403, { error: 'ORIGIN_DENIED' });
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    // Readiness only: no credentials, user data, configuration or provider call.
    if (req.url === '/api/agent/health' && req.method === 'GET') return reply(200, { service: 'motibuddy-private-ai', protocol: 1 });
    if (!['/api/agent/generate', '/api/agent/session','/api/agent/tts'].includes(req.url)) return reply(404, { error: 'NOT_FOUND' });
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return reply(204, {});
    }
    if (req.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' });
    if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'INVALID_CONTENT_TYPE' });
    // Automatic local sessions: only allowlisted app origins on this loopback-only server.
    // Sessions carry no provider credentials, expire, and share the existing process-wide quota.
    // This endpoint must not be exposed as a public authentication service.
    const now = clock();
    for (const [id, session] of sessions) if (session.expiresAt <= now) sessions.delete(id);
    if (req.url === '/api/agent/session') {
      if (Number(req.headers['content-length'] ?? 0) > 32 || req.headers['transfer-encoding']) return reply(400, { error: 'INVALID_REQUEST' });
      const currentMinute = Math.floor(now / 60_000);
      if (currentMinute !== sessionMinute) { sessionMinute = currentMinute; sessionCount = 0; }
      if (sessionCount >= 20 || sessions.size >= 100) return reply(429, { error: 'RATE_LIMITED' });
      sessionCount++;
      const token = `mbs_${randomBytes(32).toString('hex')}`;
      const expiresAt = now + 10 * 60_000;
      sessions.set(digest(token).toString('hex'), { origin, expiresAt });
      req.resume();
      return reply(200, { token, expiresAt });
    }
    const authorization = req.headers.authorization ?? '';
    const localSession = authorization.startsWith('Bearer ') ? sessions.get(digest(authorization.slice(7)).toString('hex')) : null;
    const adminAuthorized = timingSafeEqual(digest(authorization), digest(`Bearer ${config.token}`));
    if (!adminAuthorized && (!localSession || localSession.origin !== origin || localSession.expiresAt <= now)) return reply(401, { error: 'UNAUTHORIZED' });
    if(req.url==='/api/agent/tts'){
      if(Math.floor(now/60000)!==ttsMinute){ttsMinute=Math.floor(now/60000);ttsCount=0;}if(Math.floor(now/86400000)!==ttsDay){ttsDay=Math.floor(now/86400000);ttsCharacters=0;}
      if(ttsActive||ttsCount>=60||ttsCharacters>=30000)return reply(429,{error:'RATE_LIMITED'});
      const controller=new AbortController();const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);ttsActive++;
      try{const value=await readBody(req);if(!value||Object.keys(value).some(k=>!['text','voice'].includes(k))||typeof value.text!=='string'||!value.text.trim()||[...value.text].length>120||!['girl','boy'].includes(value.voice))return reply(400,{error:'INVALID_REQUEST'});ttsCount++;ttsCharacters+=[...value.text].length;reply(200,await synthesize(value.text,value.voice,config,fetchImpl,controller.signal));}catch{reply(502,{error:'TTS_UNAVAILABLE'});}finally{ttsActive--;res.off('close',close);}return;
    }
    // All sessions share limits; minting a new session cannot reset model-call quotas.
    const minute = Math.floor(now / 60_000), day = Math.floor(now / 86_400_000);
    if (minute !== minuteKey) { minuteKey = minute; minuteCount = 0; }
    if (day !== dayKey) { dayKey = day; dayCount = 0; }
    if (minuteCount >= config.perMinute || dayCount >= config.perDay) return reply(429, { error: 'RATE_LIMITED' });
    if (active >= config.maxConcurrent) return reply(429, { error: 'REQUEST_IN_PROGRESS' });
    minuteCount++; dayCount++; active++;
    const controller = new AbortController();
    const onClose = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', onClose);
    try {
      const parsed = agentRequestSchema.safeParse(await readBody(req));
      if (!parsed.success) throw new GatewayError('INVALID_REQUEST', 400);
      const result = await callDeepSeek(parsed.data, config, fetchImpl, controller.signal);
      reply(200, { result });
    } catch (error) { reply(error instanceof GatewayError ? error.status : 500, { error: error instanceof GatewayError ? error.code : 'GATEWAY_ERROR' }); }
    finally { active--; res.off('close', onClose); }
  });
  server.requestTimeout = 20_000; server.headersTimeout = 10_000;
  server.keepAliveTimeout = 3000;
  return server;
}
