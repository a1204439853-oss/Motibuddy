import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/contexts/authContext';
import { FocusContext } from '@/contexts/focusContext';
import { businessRepository } from '@/services/storage';
import { readSessionStamp } from '@/services/runtimeSession';
import { desktopNotify } from '@/services/desktopNotifications';
import { scheduledJobsSchema, nextJobTime, personalityInstruction, personalitySchema } from '@/services/productData';
import { generateAgentResult } from '@/services/agentClient';
import { applyProgressAchievements, progressAchievements } from '@/services/progressAchievements';
import { registerExitPreparation } from '@/services/exitPreparation';
import { getLocale } from '@/i18n/core';
import RewardCelebration from './ui/RewardCelebration';
import {invoke} from '@tauri-apps/api/tauri';
import {listen} from '@tauri-apps/api/event';
import { toast } from 'sonner';
export default function DesktopServices(){
  const {currentUser,sessionVersion}=useContext(AuthContext),focus=useContext(FocusContext);
  const owner=currentUser?.id,key=`${owner}:${sessionVersion}`,live=useRef(key);live.current=key;
  const [reward,setReward]=useState<{owner:string;text:string}|null>(null);
  useEffect(()=>{if(!reward||focus.session)return;const timer=setTimeout(()=>setReward(null),8000);return()=>clearTimeout(timer);},[reward,!!focus.session]);
  useEffect(()=>{
    if(!owner){void invoke('set_notification_account',{owner:null,locale:getLocale()}).catch(()=>{});return;}let stopped=false,closing=false,working:Promise<void>|null=null;const controller=new AbortController();const stamp=readSessionStamp(localStorage)?.token;
    const current=()=>!stopped&&live.current===key&&readSessionStamp(localStorage)?.token===stamp;
    void invoke('set_notification_account',{owner,locale:getLocale()}).catch(()=>{});
    let dispose:(()=>void)|undefined;void listen<{userId:string}>('native-business-updated',event=>{if(current()&&event.payload.userId===owner)void businessRepository.transact(owner,data=>data,current).catch(()=>{});}).then(fn=>{if(stopped)fn();else dispose=fn;});
    const zh=()=>getLocale()==='zh-CN'; let warned=false;
    const notify=async(title:string,body:string)=>{try{if(current())await desktopNotify(title,body);return current();}catch{if(!warned&&current()){warned=true;toast.error(zh()?'桌面通知未送达，请检查 Windows 通知权限。':'Desktop notification could not be sent. Check Windows permissions.');}return false;}};
    const work=async()=>{
      const snapshot=await businessRepository.read(owner);if(!snapshot||!current())return;
      const advanced=applyProgressAchievements(snapshot.data,new Date());
      if(advanced!==snapshot.data){
        const before=new Set((snapshot.data.settings.achievementRewards??[]) as string[]);
        const saved=await businessRepository.transact(owner,d=>applyProgressAchievements(d,new Date()),current);
        const ids=((saved.data.settings.achievementRewards??[]) as string[]).filter(id=>!before.has(id));
        if(ids.length&&current())setReward({owner,text:ids.map(id=>{const a=progressAchievements.find(item=>item.id===id)!;return `${zh()?a.zh:a.en} +${a.xp} XP`;}).join(' · ')});
      }
      const jobs=scheduledJobsSchema.parse(snapshot.data.settings.scheduledJobs??[]);
      for(const job of jobs){
        if(!current()||closing)return;
        if(job.runState==='running'){
          await businessRepository.transact(owner,d=>({...d,settings:{...d.settings,scheduledJobs:scheduledJobsSchema.parse(d.settings.scheduledJobs??[]).map(j=>j.id===job.id&&j.runState==='running'?{...j,runState:'interrupted',error:true,notificationPending:false,result:zh()?'上次执行被中断，原计划保留。为避免重复生成，本次没有自动重试；可以重新启用计划。':'The previous run was interrupted. The schedule is preserved. Enable it to try again; it was not regenerated automatically.'}:j)}}),current);
          continue;
        }
        if(job.notificationPending&&job.result){if(await notify(job.title,job.result))await businessRepository.transact(owner,d=>({...d,settings:{...d.settings,scheduledJobs:scheduledJobsSchema.parse(d.settings.scheduledJobs??[]).map(j=>j.id===job.id?{...j,notificationPending:false}:j)}}),current);}
        if(!job.enabled||+new Date(job.nextRun)>Date.now())continue;
        const runAt=new Date().toISOString();let claimed=false;
        await businessRepository.transact(owner,d=>{const actual=scheduledJobsSchema.parse(d.settings.scheduledJobs??[]).find(j=>j.id===job.id);if(!actual?.enabled||actual.nextRun!==job.nextRun)return d;claimed=true;return {...d,settings:{...d.settings,scheduledJobs:scheduledJobsSchema.parse(d.settings.scheduledJobs??[]).map(j=>j.id===job.id?{...j,nextRun:nextJobTime(j.time,j.repeat,new Date()),enabled:j.repeat!=='once',lastRun:runAt,runState:'running',result:zh()?'正在准备这次消息；若应用意外退出，可重新启用再试。':'Preparing this message. If interrupted, enable the schedule to try again.',error:false,notificationPending:false}:j)}};},current);
        if(!claimed||!current())continue;
        let result=job.prompt,failed=false;
        if(job.kind!=='reminder'){
          try{const value=await generateAgentResult({mode:'chat',scheduled:true,locale:getLocale(),personality:personalitySchema.catch('gentle').parse(snapshot.data.settings.petPersonality),now:runAt,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,instruction:(personalityInstruction(snapshot.data.settings.petPersonality)+`This is the content-generation step of an ALREADY REGISTERED schedule. Generate ONLY the requested content, without discussing task setup, permissions, reminder times or what you cannot do. Requested content: ${job.prompt}. If news evidence is supplied, summarize its actual headlines directly.`).slice(0,4000),availableMinutes:60,energy:'normal',tasks:[],...(job.kind==='news'?{news:true}:{})},stamp!,AbortSignal.any([controller.signal,AbortSignal.timeout(70000)]));result=value.summary;}catch{failed=true;result=zh()?'本次消息未能生成。请检查本机 AI 服务与网络；不会用猜测内容代替新闻。':'Could not generate this message. Check the local AI service and network; news will not be fabricated.';}
        }
        if(!current())return;
        const completed=await businessRepository.transact(owner,d=>({...d,settings:{...d.settings,scheduledJobs:scheduledJobsSchema.parse(d.settings.scheduledJobs??[]).map(j=>j.id===job.id&&j.lastRun===runAt?{...j,result:result.slice(0,2400),error:failed,runState:failed?'failed':'succeeded',notificationPending:true}:j)}}),current);
        if(scheduledJobsSchema.parse(completed.data.settings.scheduledJobs??[]).some(j=>j.id===job.id&&j.lastRun===runAt) && await notify(job.title,result))await businessRepository.transact(owner,d=>({...d,settings:{...d.settings,scheduledJobs:scheduledJobsSchema.parse(d.settings.scheduledJobs??[]).map(j=>j.id===job.id&&j.lastRun===runAt?{...j,notificationPending:false}:j)}}),current);
        break; // At most one generation per tick, sharing the gateway's normal quota.
      }
    };
    const tick=()=>{if(working||closing||!current())return;working=work().catch(()=>{if(current()&&!warned){warned=true;toast.error(zh()?'后台记录处理失败，原数据已保留，请检查保存状态。':'Background processing failed. Existing data is preserved. Check saving.');}}).finally(()=>{working=null;});};
    const timer=setInterval(tick,15000),first=setTimeout(tick,1500);
    const unregister=registerExitPreparation(async()=>{closing=true;try{await working;}finally{closing=false;}});
    return()=>{stopped=true;dispose?.();void invoke('set_notification_account',{owner:null,locale:getLocale()}).catch(()=>{});controller.abort();clearTimeout(first);clearInterval(timer);unregister();};
  },[owner,sessionVersion]);
  return reward&&reward.owner===owner&&!focus.session?<RewardCelebration text={reward.text} onClose={()=>setReward(null)}/>:null;
}
