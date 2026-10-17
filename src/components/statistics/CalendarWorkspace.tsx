import {useState} from 'react';
import {useLocale} from '@/i18n/react';
import CalendarOverview from '@/components/ui/CalendarOverview';
import TaskTimeline from './TaskTimeline';

export default function CalendarWorkspace(){
 const {locale}=useLocale(),s=(a:string,b:string)=>locale==='zh-CN'?a:b;
 const [tab,setTab]=useState<'schedule'|'month'>('schedule'),[day,setDay]=useState(()=>new Date()),[view,setView]=useState<'week'|'day'>('week');
 return <section className="calendar-workspace module-panel"><header className="module-heading"><div><span className="module-eyebrow">{s('把时间，留给重要的小事','Make room for what matters')}</span><h1>{s('日历','Calendar')}</h1></div><div className="calendar-view-tabs" role="tablist" aria-label={s('日历内容','Calendar content')}><button role="tab" aria-selected={tab==='schedule'} aria-controls="calendar-content" onClick={()=>setTab('schedule')}>{s('日程','Schedule')}</button><button role="tab" aria-selected={tab==='month'} aria-controls="calendar-content" onClick={()=>setTab('month')}>{s('月历','Month')}</button></div></header><div id="calendar-content" role="tabpanel" aria-label={tab==='schedule'?s('日程','Schedule'):s('月历','Month')}>{tab==='schedule'?<TaskTimeline initialDate={day} initialView={view} onDateChange={setDay}/>:<CalendarOverview initialDate={day} onOpenDay={date=>{setDay(date);setView('day');setTab('schedule');}}/>}</div></section>;
}
