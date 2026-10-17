import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const privateText = await readFile(path.join(root, 'server/.env.local'), 'utf8').catch(() => '');
const privateKey = privateText.match(/^DEEPSEEK_API_KEY=(.+)$/m)?.[1].trim();
const clientToken = privateText.match(/^MOTIBUDDY_GATEWAY_TOKEN=(.+)$/m)?.[1].trim();
const ttsId=privateText.match(/^TENCENT_TTS_SECRET_ID=(.+)$/m)?.[1].trim();
const ttsKey=privateText.match(/^TENCENT_TTS_SECRET_KEY=(.+)$/m)?.[1].trim();
const allSecrets=[privateKey,clientToken,ttsId,ttsKey].filter(Boolean);
const failures = []; let checked = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (entry.name.startsWith('.env')) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(tsx?|m?js|cjs|json|html|css|map|md|svg|rs|ps1|cmd)$/i.test(entry.name)) {
      const contents = await readFile(file, 'utf8'); checked++;
      if (allSecrets.some(value=>contents.includes(value))) failures.push(path.relative(root, file));
    }
  }
}
for (const name of ['src', 'src-tauri/src', 'server', 'scripts', 'tests', 'test_scripts', 'docs', 'dist']) await walk(path.join(root, name));
for (const name of ['Start-MotiBuddy-AI.cmd', 'package.json', 'README.md']) {
  const contents = await readFile(path.join(root, name), 'utf8').catch(() => ''); checked++;
  if (allSecrets.some(value=>contents.includes(value))) failures.push(name);
}
const executable = process.argv[2];
if (executable) {
  if (!privateKey || !clientToken) throw new Error('Private configuration is required to verify the executable.');
  const file = path.resolve(root, executable);
  const bytes = await readFile(file); checked++;
  const values = allSecrets;
  if (values.some(value => bytes.includes(Buffer.from(value, 'utf8')) || bytes.includes(Buffer.from(value, 'utf16le')) || bytes.includes(Buffer.from(Buffer.from(value).toString('base64'))))) failures.push(path.relative(root, file));
}
console.log(JSON.stringify({ checkedFiles: checked, privateConfigAvailable: !!privateKey, leakedFiles: failures }, null, 2));
if (failures.length) process.exitCode = 1;
