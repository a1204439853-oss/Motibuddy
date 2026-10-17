import {useEffect,useRef} from 'react';
// Locally synthesized instrumental notes. No recordings, network requests or lyrics.
export function useFocusMusic(playing:boolean,volume:number){
 const audio=useRef<AudioContext>(),timer=useRef<ReturnType<typeof setInterval>>(),gain=useRef<GainNode>();
 const prime=()=>{if(!audio.current){audio.current=new AudioContext();gain.current=audio.current.createGain();gain.current.gain.value=0;gain.current.connect(audio.current.destination);}void audio.current.resume().catch(()=>{});};
 useEffect(()=>{if(!playing){if(timer.current)clearInterval(timer.current);if(gain.current)gain.current.gain.setTargetAtTime(0,audio.current!.currentTime,.2);return;}prime();const ctx=audio.current!;gain.current!.gain.setTargetAtTime(volume/100*.16,ctx.currentTime,.4);let step=0;const melody=[261.63,329.63,392,523.25,440,392,329.63,293.66,246.94,293.66,369.99,493.88,440,369.99,293.66,329.63];
 const note=()=>{const now=ctx.currentTime;for(const [frequency,level]of [[melody[step++%melody.length],.35],[130.81,.08]] as const){const osc=ctx.createOscillator(),envelope=ctx.createGain();osc.type='sine';osc.frequency.value=frequency;envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(level,now+.08);envelope.gain.exponentialRampToValueAtTime(.0001,now+2.8);osc.connect(envelope);envelope.connect(gain.current!);osc.start(now);osc.stop(now+3);osc.onended=()=>{osc.disconnect();envelope.disconnect();};}};note();timer.current=setInterval(note,950);return()=>{if(timer.current)clearInterval(timer.current);if(gain.current)gain.current.gain.setTargetAtTime(0,ctx.currentTime,.2);};},[playing,volume]);
 useEffect(()=>()=>{if(timer.current)clearInterval(timer.current);void audio.current?.close();},[]);return prime;
}
