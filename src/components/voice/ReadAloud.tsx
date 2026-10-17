import {useContext,useEffect,useRef,useState} from 'react';
import {useBusinessSettings} from '@/hooks/useBusinessSettings';
import {useLocale} from '@/i18n/react';
import {AuthContext} from '@/contexts/authContext';
import {automaticSession,AGENT_GATEWAY_URL} from '@/services/agentClient';
let stopPrevious:(()=>void)|undefined;
export default function ReadAloud({text,active=true}:{text:string;active?:boolean}){
 const {locale}=useLocale(),store=useBusinessSettings(),{currentUser,sessionVersion}=useContext(AuthContext);const [playing,setPlaying]=useState(false),[error,setError]=useState(false);const current=useRef<AbortController>(),audio=useRef<HTMLAudioElement>(),url=useRef<string>();
 const stop=()=>{current.current?.abort();audio.current?.pause();if(url.current)URL.revokeObjectURL(url.current);setPlaying(false);};
 useEffect(()=>{if(!active)stop();return stop;},[active,currentUser?.id,sessionVersion]);
 const play=async()=>{if(playing){stop();return;}stopPrevious?.();stopPrevious=stop;const controller=new AbortController();current.current=controller;setPlaying(true);setError(false);try{
   const token=await automaticSession(`${currentUser?.id}:${sessionVersion}`,controller.signal);
   const cleaned=text.replace(/https?:\/\/\S+/g,'').replace(/[#*`_]/g,'');const chars=[...cleaned];
   for(let i=0;i<chars.length;i+=120){if(controller.signal.aborted)break;const response=await fetch(AGENT_GATEWAY_URL.replace('/generate','/tts'),{method:'POST',redirect:'error',credentials:'omit',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({text:chars.slice(i,i+120).join(''),voice:store.settings.ttsVoice??'girl'})});const data=await response.json();if(!response.ok||typeof data.audio!=='string')throw new Error();if(controller.signal.aborted)break;const bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0));url.current=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));const player=new Audio(url.current);audio.current=player;
     await new Promise<void>((resolve,reject)=>{player.onended=()=>resolve();player.onerror=()=>reject(new Error());controller.signal.addEventListener('abort',()=>{player.pause();resolve();},{once:true});void player.play().catch(reject);});URL.revokeObjectURL(url.current);
   }
 }catch{if(!controller.signal.aborted)setError(true);}finally{if(current.current===controller)setPlaying(false);}};
 return <div className="read-aloud"><button type="button" disabled={!active||store.loading||store.error} onClick={()=>void play()}>{playing?(locale==='zh-CN'?'停止播报':'Stop reading'):(locale==='zh-CN'?'语音播报':'Read aloud')}</button><select aria-label={locale==='zh-CN'?'播报音色':'Reading voice'} disabled={playing||store.loading||store.error} value={String(store.settings.ttsVoice??'girl')} onChange={e=>{const value=e.target.value;void store.save(s=>({...s,ttsVoice:value})).catch(()=>setError(true));}}><option value="girl">{locale==='zh-CN'?'元气女生':'Bright girl'}</option><option value="boy">{locale==='zh-CN'?'活力男生':'Lively boy'}</option></select>{error&&<small role="alert">{locale==='zh-CN'?'播报未完成，请检查本机服务或语音服务权限后重试。':'Reading failed. Check the local service and voice permissions.'}</small>}</div>;
}
