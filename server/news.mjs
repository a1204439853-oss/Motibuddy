// A fixed publisher feed prevents user-controlled URLs / SSRF. Never substitute invented news.
export const NEWS_FEED='https://www.chinanews.com.cn/rss/scroll-news.xml';
export const NEWS_FALLBACK='https://feeds.bbci.co.uk/news/world/rss.xml';
const clean=value=>value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
export function parseNews(xml,now=new Date()){
  const entries=[...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)].slice(0,30).flatMap(match=>{
    const field=name=>clean(match[1].match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]??'');
    const title=field('title'),url=field('link'),published=field('pubDate');const date=new Date(published);
    if(!title||!/^https:\/\/(?:(?:www\.)?bbc\.(?:com|co\.uk)|www\.chinanews\.com(?:\.cn)?)\//.test(url)||!Number.isFinite(+date)||+date>+now+3600000||+now-+date>7*86400000)return [];
    return [{title:title.slice(0,250),url,published:date.toISOString(),publisher:url.includes('chinanews.com')?'中国新闻网':'BBC News World'}];
  });
  if(!entries.length)throw new Error('No recent publisher news');return entries.slice(0,8);
}
export async function fetchNews(fetchImpl=fetch,signal){
  try{return await fetchFeed(NEWS_FEED,fetchImpl,signal);}catch{return await fetchFeed(NEWS_FALLBACK,fetchImpl,signal);}
}
async function fetchFeed(url,fetchImpl,signal){
  const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(8000),...(signal?[signal]:[])])});
  if(!response.ok)throw new Error('News unavailable');const reader=response.body.getReader(),chunks=[];let bytes=0;
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>500000){await reader.cancel();throw new Error('News feed too large');}chunks.push(Buffer.from(value));}
  return parseNews(Buffer.concat(chunks).toString('utf8'));
}
