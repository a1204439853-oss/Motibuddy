import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/contexts/authContext';
import { businessRepository } from '@/services/storage';
import { readSessionStamp } from '@/services/runtimeSession';
export function useBusinessSettings() {
  const { currentUser, sessionVersion } = useContext(AuthContext);
  const owner = currentUser?.id;
  const [state,setState] = useState<{owner?:string; settings: Record<string,unknown>; error:boolean; loading:boolean}>({settings:{},error:false,loading:true});
  const live = useRef(''); const key = `${owner}:${sessionVersion}`; live.current=key;
  useEffect(()=>{
    let active=true,revision=0; setState({owner,settings:{},error:false,loading:true});
    if(!owner) return;
    const accept=(snapshot: Awaited<ReturnType<typeof businessRepository.read>>) => { if(active && snapshot?.userId===owner && snapshot.revision>=revision){revision=snapshot.revision;setState({owner,settings:snapshot.data.settings,error:false,loading:false});} };
    const unsubscribe=businessRepository.subscribe(accept);
    void businessRepository.read(owner).then(snapshot=>{ if(!snapshot) throw new Error(); accept(snapshot); }).catch(()=>{if(active&&!revision)setState({owner,settings:{},error:true,loading:false});});
    return()=>{active=false;unsubscribe();};
  },[owner,sessionVersion]);
  const save=async(change:(settings:Record<string,unknown>)=>Record<string,unknown>)=>{
    const stamp=readSessionStamp(localStorage)?.token;
    if(!owner || state.owner!==owner || state.loading || state.error) throw new Error('Settings unavailable');
    await businessRepository.transact(owner,data=>({...data,settings:change(data.settings)}),()=>live.current===key && readSessionStamp(localStorage)?.token===stamp);
  };
  return {settings:state.owner===owner?state.settings:{},loading:state.loading||state.owner!==owner,error:state.error,save};
}
