import {readFile,writeFile} from 'node:fs/promises';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');let input='';
process.stdout.write('Enter private TTS configuration (hidden): ');
process.stdin.on('data',async chunk=>{input+=chunk;if(!input.includes('\n'))return;process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);
 try{const value=JSON.parse(input.trim());input='';if(!/^AKID[A-Za-z0-9]+$/.test(value.id)||!/^[A-Za-z0-9]{20,100}$/.test(value.key))throw new Error();const path=new URL('../server/.env.local',import.meta.url);const prior=await readFile(path,'utf8');const content=prior.split(/\r?\n/).filter(line=>!/^TENCENT_TTS_SECRET_(ID|KEY)=/.test(line)).join('\n').trimEnd();await writeFile(path,content+`\nTENCENT_TTS_SECRET_ID=${value.id}\nTENCENT_TTS_SECRET_KEY=${value.key}\n`);console.log('\nPrivate TTS configuration saved.');}catch{console.log('\nConfiguration failed; no credentials were printed.');process.exitCode=1;}});
