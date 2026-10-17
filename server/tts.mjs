import {createHash,createHmac,randomUUID} from 'node:crypto';
export const VOICES={girl:403000,boy:603000};
const hash=text=>createHash('sha256').update(text).digest('hex');
const hmac=(key,text)=>createHmac('sha256',key).update(text).digest();
export function ttsSignedRequest(text,voice,config,timestamp=Math.floor(Date.now()/1000)){
  if(!VOICES[voice]||typeof text!=='string'||!text.trim()||[...text].length>120)throw new Error('TTS_INVALID_REQUEST');
  if(!config.ttsId||!config.ttsKey)throw new Error('TTS_NOT_CONFIGURED');
  const host='tts.tencentcloudapi.com',date=new Date(timestamp*1000).toISOString().slice(0,10),scope=`${date}/tts/tc3_request`;
  const body=JSON.stringify({Text:text,SessionId:randomUUID(),VoiceType:VOICES[voice],Codec:'mp3',SampleRate:24000,ModelType:1});
  const canonical=`POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:${host}\n\ncontent-type;host\n${hash(body)}`;
  const signature=hmac(hmac(hmac(hmac('TC3'+config.ttsKey,date),'tts'),'tc3_request'),`TC3-HMAC-SHA256\n${timestamp}\n${scope}\n${hash(canonical)}`).toString('hex');
  return {url:`https://${host}`,body,headers:{'Content-Type':'application/json; charset=utf-8','X-TC-Action':'TextToVoice','X-TC-Version':'2019-08-23','X-TC-Timestamp':String(timestamp),Authorization:`TC3-HMAC-SHA256 Credential=${config.ttsId}/${scope}, SignedHeaders=content-type;host, Signature=${signature}`}};
}
export async function synthesize(text,voice,config,fetchImpl=fetch,signal){
  const request=ttsSignedRequest(text,voice,config);
  try{
    const response=await fetchImpl(request.url,{method:'POST',redirect:'error',headers:request.headers,body:request.body,signal:AbortSignal.any([AbortSignal.timeout(30000),...(signal?[signal]:[])])});
    const reader=response.body.getReader();const chunks=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw new Error();}chunks.push(Buffer.from(value));}
    const result=JSON.parse(Buffer.concat(chunks).toString('utf8')).Response;
    if(!response.ok||result?.Error||typeof result?.Audio!=='string'||!result.Audio.length||!/^[A-Za-z0-9+/]+=*$/.test(result.Audio))throw new Error();
    return {audio:result.Audio,mime:'audio/mpeg'};
  }catch{throw new Error('TTS_UNAVAILABLE');}
}
