// Search stays on the private server. Never send conversation history or tasks as a query.
export async function searchWeb(query,config,fetchImpl=fetch,signal){
 const response=await fetchImpl('https://api.deepseek.com/v1/tools/search',{method:'POST',redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(15000),...(signal?[signal]:[])]),headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({query:[...query].slice(0,128).join(''),count:5,need_content:false})});
 if(!response.ok){await response.body?.cancel().catch(()=>{});throw Error('SEARCH_UNAVAILABLE');}
 const reader=response.body.getReader(),chunks=[];let bytes=0;for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>500000){await reader.cancel();throw Error('SEARCH_UNAVAILABLE');}chunks.push(Buffer.from(value));}
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!Array.isArray(value.results))throw Error('SEARCH_UNAVAILABLE');
 return value.results.slice(0,5).flatMap(item=>{try{const u=new URL(item.url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return [];return [{title:String(item.title??'').slice(0,150),url:u.href,summary:String(item.summary||item.snippet||'').slice(0,1500),date:typeof item.date==='string'?item.date:null}];}catch{return [];}});
}
