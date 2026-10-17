// Local-only setup. Reads the supplier key from stdin, never from process arguments.
import { open, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const target = fileURLToPath(new URL('../server/.env.local', import.meta.url));
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdout.write('Enter supplier key (hidden): ');
let input = '';
process.stdin.on('data', async chunk => {
  if (chunk.includes('\u0003')) process.exit(1);
  input += chunk;
  if (!/[\r\n]/.test(input)) return;
  process.stdin.pause(); if (process.stdin.isTTY) process.stdin.setRawMode(false);
  const key = input.trim(); input = '';
  if (!/^sk-[A-Za-z0-9_-]{20,200}$/.test(key)) { console.error('\nInvalid key format.'); process.exitCode = 1; return; }
  try {
    const file = await open(target, 'wx', 0o600);
    try { await file.writeFile(`DEEPSEEK_API_KEY=${key}\nMOTIBUDDY_GATEWAY_TOKEN=mbg_${randomBytes(32).toString('hex')}\nAGENT_PORT=8787\n`); }
    finally { await file.close(); }
    await chmod(target, 0o600);
    console.log('\nPrivate server configuration created. No credentials were printed.');
  } catch { console.error('\nConfiguration was not changed. Check whether the private file already exists.'); process.exitCode = 1; }
});
