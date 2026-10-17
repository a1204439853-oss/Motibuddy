import {useEffect,useRef,useState} from 'react';
export const focusTracks=[{id:'meditation',title:'Meditation Impromptu 01',zh:'静心钢琴',isrc:'USUAN1100163'},{id:'dream',title:'Dream Culture',zh:'水色梦境',isrc:'USUAN1300046'},{id:'lemon',title:'Easy Lemon',zh:'轻甜柠檬',isrc:'USUAN1200076'},{id:'cities',title:'Floating Cities',zh:'浮空之城',isrc:'USUAN1600018'}] as const;
export function useFocusMusic(playing:boolean,volume:number,track='meditation'){
 const audio=useRef<HTMLAudioElement>(),[error,setError]=useState(false),generation=useRef(0);
 const playingRef=useRef(playing);playingRef.current=playing;
 const ensure=()=>{if(!audio.current){audio.current=new Audio();audio.current.loop=true;audio.current.preload='auto';}const player=audio.current;if(!player.src.endsWith('/music/'+track+'.mp3'))player.src='/music/'+track+'.mp3';player.volume=playingRef.current?Math.max(0,Math.min(1,volume/100)):0;return player;};
 const prime=()=>{const player=ensure();void player.play().then(()=>{if(!playingRef.current)player.pause();}).catch(()=>setError(true));};
 useEffect(()=>{const player=ensure();const id=++generation.current;setError(false);let fade:ReturnType<typeof setInterval>|undefined;if(playing){void player.play().catch(()=>{if(id===generation.current)setError(true);});}else{fade=setInterval(()=>{player.volume=Math.max(0,player.volume-.08);if(player.volume<=0){player.pause();clearInterval(fade);}},40);}return()=>{if(fade)clearInterval(fade);};},[playing,volume,track]);
 useEffect(()=>()=>{generation.current++;audio.current?.pause();if(audio.current){audio.current.removeAttribute('src');audio.current.load();}},[]);
 return {prime,error};
}
