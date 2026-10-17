import {automaticSession,AGENT_GATEWAY_URL} from './agentClient';
let context:AudioContext|undefined,output:GainNode|undefined,current:AbortController|undefined,source:AudioBufferSourceNode|undefined;
let ready:Promise<void>|undefined;
export function unlockNarration(){
 if(!context){context=new AudioContext();output=context.createGain();output.connect(context.destination);}
 ready=context.resume();return ready; // Called from the send/card/speaker gesture, before a network await.
}
export function narrationVolume(volume:number){if(output&&context)output.gain.setTargetAtTime(Math.max(0,Math.min(100,volume))/100,context.currentTime,.05);}
export function stopNarration(){current?.abort();try{source?.stop();}catch{}source=undefined;}
export async function narrateReply(text:string,scope:string,voice:string,volume:number){
 stopNarration();const controller=new AbortController();current=controller;
 const abort=()=>{if(current===controller){try{source?.stop();}catch{}}};controller.signal.addEventListener('abort',abort,{once:true});
 try{
  if(ready){let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([ready,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('AUDIO_GESTURE_REQUIRED')),10000);})]);}finally{if(timer)clearTimeout(timer);}}
  if(controller.signal.aborted)return;
  if(!context||context.state!=='running')throw Error('AUDIO_GESTURE_REQUIRED');
  narrationVolume(volume);const token=await automaticSession(scope,controller.signal);
  const cleaned=text.split(/\n(?:来源|Sources?):/i)[0].replace(/https?:\/\/\S+/g,'').replace(/[#*`_]/g,'').trim(),chars=[...cleaned];
  for(let i=0;i<chars.length;i+=120){
   if(controller.signal.aborted)return;
   const response=await fetch(AGENT_GATEWAY_URL.replace('/generate','/tts'),{method:'POST',redirect:'error',credentials:'omit',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({text:chars.slice(i,i+120).join(''),voice})});
   if(!response.ok)throw Error(response.status===401?'TTS_SESSION_EXPIRED':response.status===429?'TTS_LIMITED':'TTS_UNAVAILABLE');
   const data=await response.json();if(typeof data.audio!=='string'||data.audio.length>3000000)throw Error('TTS_INVALID_AUDIO');
   const bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0)),decoded=await context.decodeAudioData(bytes.buffer);
   if(controller.signal.aborted)return;
   const player=context.createBufferSource();source=player;player.buffer=decoded;player.connect(output!);
   await new Promise<void>(resolve=>{const done=()=>{player.disconnect();controller.signal.removeEventListener('abort',done);resolve();};player.onended=done;controller.signal.addEventListener('abort',done,{once:true});player.start();});
  }
 }finally{controller.signal.removeEventListener('abort',abort);if(current===controller){current=undefined;source=undefined;}}
}
