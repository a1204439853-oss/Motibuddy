import {Fragment} from 'react';
import {useLocale} from '@/i18n/react';
function inline(text:string){return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s<>]+)/g).map((part,i)=>{
 if(part.startsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;
 const markdown=part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
 if(markdown)return <a key={i} href={markdown[2]} target="_blank" rel="noreferrer">{markdown[1]}</a>;
 if(/^https?:\/\//.test(part))return <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a>;
 return <Fragment key={i}>{part}</Fragment>;
 });}
function lines(text:string){return text.split(/\n+/).filter(Boolean).map((line,i)=>{const value=line.trim();if(/^#{1,3}\s/.test(value))return <h3 key={i}>{inline(value.replace(/^#+\s*/,''))}</h3>;if(/^[-*]\s|^\d+[.、)]\s*/.test(value))return <div key={i} className="formatted-item"><span aria-hidden="true">•</span><p>{inline(value.replace(/^[-*]\s|^\d+[.、)]\s*/,''))}</p></div>;return <p key={i}>{inline(value)}</p>;});}
export default function FormattedText({text}:{text:string}){
 const {locale}=useLocale();
 const sourceStart=text.search(/(?:^|\n)\s*(?:#{1,4}\s*)?(?:\*\*)?(?:来源|信息来源|参考(?:来源|资料|文献)?|Sources?|References?|抓取|Retrieved)(?:\*\*)?\s*[:：\n]/i);
 const body=sourceStart<0?text:text.slice(0,sourceStart),tail=sourceStart<0?'':text.slice(sourceStart);
 // Any link-bearing line is kept in the collapsed source panel, even without a heading.
 const bodyLines=body.split('\n'),linked=bodyLines.filter(v=>/https?:\/\//i.test(v)),plain=bodyLines.filter(v=>!/https?:\/\//i.test(v));
 const sources=[...linked,tail].filter(Boolean).join('\n');
 return <div className="formatted-text">{lines(plain.join('\n'))}{sources&&<details className="formatted-sources"><summary>{locale==='zh-CN'?'来源与参考资料':'Sources & references'}</summary>{lines(sources)}</details>}</div>;
}
