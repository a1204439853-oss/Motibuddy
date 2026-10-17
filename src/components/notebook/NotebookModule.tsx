import {useState,useContext,useEffect} from 'react';
import {useLocale} from '@/i18n/react';
import {useBusinessSettings} from '@/hooks/useBusinessSettings';
import {AuthContext} from '@/contexts/authContext';
import {initialMemories} from '@/services/starterMemories';
import {prepareAgentImage} from '@/services/agentClient';
import Anniversaries from '@/components/Anniversaries';
import Notebook from './Notebook';
export default function NotebookModule({active=false}:{active?:boolean}){const [tab,setTab]=useState<'journal'|'anniversary'>('journal'),{locale}=useLocale(),store=useBusinessSettings(),{currentUser,currentPet}=useContext(AuthContext),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!active||store.loading||store.error||!currentUser||!currentPet||store.settings.starterMemoriesVersion===1)return;let live=true;void(async()=>{try{const response=await fetch('/'+currentPet.type+'.jpg');if(!response.ok)throw Error();const photo=await prepareAgentImage(new File([await response.blob()],'pet.jpg',{type:'image/jpeg'}),600);if(live)await store.save(s=>initialMemories(s,currentUser,currentPet,photo));}catch{if(live)setError(true);}})();return()=>{live=false;};},[active,store.loading,store.error,currentUser?.id,currentPet?.id,retry]);
 return <section className="notebook-module"><nav className="notebook-tabs"><button aria-pressed={tab==='journal'} onClick={()=>setTab('journal')}>{locale==='zh-CN'?'手账本':'Journal'}</button><button aria-pressed={tab==='anniversary'} onClick={()=>setTab('anniversary')}>{locale==='zh-CN'?'纪念日':'Anniversaries'}</button></nav>{error&&<p role="alert">{locale==='zh-CN'?'初始纪念页尚未保存，已有内容保留。':'Could not save your welcome pages. Existing content is preserved.'}<button onClick={()=>{setError(false);setRetry(v=>v+1);}}>{locale==='zh-CN'?'重试':'Retry'}</button></p>}<div className="notebook-content"><div style={{display:tab==='journal'?'block':'none',height:'100%'}}><Notebook/></div><div style={{display:tab==='anniversary'?'block':'none',height:'100%'}}><Anniversaries/></div></div></section>;}
