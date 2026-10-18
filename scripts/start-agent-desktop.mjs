// Owner-only local acceptance launcher. Private configuration stays with the server.
import { spawn } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { readConfig } from '../server/gateway.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://tauri.localhost';
const baseUrl = 'http://127.0.0.1:8787/api/agent';

export async function probeGateway(url = baseUrl, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${url}/health`, {
      headers: { Origin: origin }, redirect: 'error', signal: AbortSignal.timeout(1000),
    });
    const value = await response.json();
    return response.ok && value.service === 'motibuddy-private-ai' && value.protocol === 1 ? 'ready' : 'incompatible';
  } catch (error) {
    // Do not start another process when a listening port is unhealthy or belongs to another service.
    return error.cause?.code === 'ECONNREFUSED' ? 'absent' : 'incompatible';
  }
}

export async function ensureGateway({ probe = probeGateway, start, pause = delay, attempts = 40 } = {}) {
  const initial = await probe();
  if (initial === 'ready') return 'reused';
  if (initial !== 'absent') throw new Error('PORT_UNAVAILABLE');
  const child = await start();
  for (let attempt = 0; attempt < attempts; attempt++) {
    const status = await probe();
    if (status === 'ready') return 'started';
    if (status === 'incompatible') throw new Error('PORT_UNAVAILABLE');
    if (child.exitCode !== null) throw new Error('SERVICE_START_FAILED');
    await pause(250);
  }
  throw new Error('SERVICE_START_FAILED');
}

function startDetached(executable, args, options = {}) {
  return new Promise((resolveStarted, reject) => {
    const child = spawn(executable, args, { cwd: root, detached: true, windowsHide: true, stdio: 'ignore', ...options });
    child.once('error', () => reject(new Error('PROCESS_START_FAILED')));
    child.once('spawn', () => { child.unref(); resolveStarted(child); });
  });
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('NODE_VERSION');
  const serviceOnly = process.argv.includes('--service-only');
  const exePath = resolve(root, 'MotiBuddy-Verify-ui-details.exe');
  if (!serviceOnly) {
    try { await access(exePath); } catch { throw new Error('EXE_MISSING'); }
  }
  let config;
  try {
    // Parse without loading secrets into the launcher's environment or the desktop process.
    const env = parseEnv(await readFile(resolve(root, 'server/.env.local'), 'utf8'));
    config = readConfig({ ...env, ...process.env });
  } catch { throw new Error('CONFIG_INVALID'); }
  if (config.port !== 8787) throw new Error('PORT_CONFIG');
  const result = await ensureGateway({ start: () => startDetached(process.execPath, [
    '--env-file=server/.env.local', 'server/index.mjs',
  ]) });
  console.log(result === 'started' ? 'AI service started on 127.0.0.1:8787.' : 'AI service is already ready; reusing it.');
  if (!serviceOnly) {
    const desktopEnv = { ...process.env };
    delete desktopEnv.DEEPSEEK_API_KEY;
    delete desktopEnv.MOTIBUDDY_GATEWAY_TOKEN;
    delete desktopEnv.TENCENT_TTS_SECRET_ID;
    delete desktopEnv.TENCENT_TTS_SECRET_KEY;
    await startDetached(exePath, [], { env: desktopEnv });
    console.log('MotiBuddy opened. The local AI service stays running in the background.');
  }
}

const messages = {
  NODE_VERSION: 'Node.js 24 is required. Install it before using this local launcher.',
  EXE_MISSING: 'Cannot find MotiBuddy-Verify-ui-details.exe beside the launcher.',
  CONFIG_INVALID: 'Private AI configuration is missing or invalid. See server/README.md.',
  PORT_CONFIG: 'This desktop build requires AGENT_PORT=8787 in the private server configuration.',
  PORT_UNAVAILABLE: 'Port 8787 has an incompatible or unresponsive service. Close the old AI server in its own terminal and retry. No process was stopped.',
  SERVICE_START_FAILED: 'AI service did not become ready. Run npm run agent:server to inspect its startup error.',
  PROCESS_START_FAILED: 'Cannot start the local process. Run npm run agent:server to inspect the environment.',
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(messages[error.message] ?? 'Local AI startup failed. See server/README.md.'); process.exitCode = 1; });
}
