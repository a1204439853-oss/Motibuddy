import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '@/i18n/react';
import { label } from '@/i18n/core';
import { TaskContext } from '@/contexts/taskContext';
import { calendarDay, localDay, shiftDay, weekStart } from '@/services/calendarSchedule';
import type { Task } from '@/types';
import TaskForm from '@/components/tasks/TaskForm';
import './calendar.css';
import { taskConflicts, conflictKey, conflictApproval } from '@/services/productData';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

const colors = { low: '#00836a', medium: '#9b7200', high: '#c36914', urgent: '#cc4246' };
export default function TaskTimeline({initialDate,initialView='week',onDateChange}:{initialDate?:Date;initialView?:'week'|'day';onDateChange?:(date:Date)=>void}={}) {
  const { locale } = useLocale();
  const s = (zh: string, en: string) => locale === 'zh-CN' ? zh : en;
  const { tasks } = useContext(TaskContext);
  const store=useBusinessSettings();
  const [conflictError,setConflictError]=useState(false);
  const confirmed=(store.settings.confirmedConflicts??[]) as string[];
  const overlaps=tasks.filter(task=>task.status!=='completed').flatMap(task=>taskConflicts(task,tasks).filter(other=>task.id<other.id&&!confirmed.includes(conflictKey(task,other))&&!task.conflictApprovals?.includes(conflictApproval(task,other))&&!other.conflictApprovals?.includes(conflictApproval(other,task))).map(other=>({task,other,key:conflictKey(task,other)})));
  const [anchor, setAnchor] = useState(() => localDay(initialDate??new Date()));
  const [view, setView] = useState<'week' | 'day'>(initialView);
  const [showCompleted, setShowCompleted] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(()=>{onDateChange?.(anchor);},[anchor,onDateChange]);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 8 * 48; }, [view]);
  const days = useMemo(() => Array.from({ length: view === 'week' ? 7 : 1 }, (_, index) => shiftDay(view === 'week' ? weekStart(anchor) : anchor, index)), [anchor, view]);
  const data = useMemo(() => days.map(day => calendarDay(tasks.filter(task => showCompleted || task.status !== 'completed'), day)), [days, tasks, showCompleted]);
  const time = (date: Date) => date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const full = (date: Date) => date.toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const editing = tasks.find(task => task.id === editingId);
  const detail = (task: Task) => `${task.title}\n${task.startAt ? `${full(task.startAt)} → ` : ''}${full(task.dueDate)}\n${label(task.priority)} · ${label(task.status)}${task.description ? `\n${task.description}` : ''}`;
  return <section className="mb-calendar" aria-label={s('日历行程时间线', 'Calendar schedule')}>
    <header className="mb-calendar-toolbar"><div><h3>{s('日历行程', 'Calendar schedule')}</h3><p>{days[0].toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}{view === 'week' ? ` – ${days[6].toLocaleDateString(locale, { month: 'short', day: 'numeric' })}` : ''}</p></div>
      <div className="mb-calendar-controls"><button onClick={() => setAnchor(shiftDay(anchor, view === 'week' ? -7 : -1))} aria-label={s('上一段时间', 'Previous period')}>‹</button><button onClick={() => setAnchor(localDay(new Date()))}>{s('今天', 'Today')}</button><button onClick={() => setAnchor(shiftDay(anchor, view === 'week' ? 7 : 1))} aria-label={s('下一段时间', 'Next period')}>›</button><select aria-label={s('日历视图', 'Calendar view')} value={view} onChange={event => setView(event.target.value as 'week' | 'day')}><option value="week">{s('周', 'Week')}</option><option value="day">{s('日', 'Day')}</option></select></div>
    </header>
    <div className="mb-calendar-options"><span><i className="fa-regular fa-calendar" /> {s('时间段显示为日程块，截止任务列于顶部。点击可查看和修改。', 'Time ranges appear as events; deadlines are listed above. Click to view or edit.')}</span><label><input type="checkbox" checked={showCompleted} onChange={event => setShowCompleted(event.target.checked)} />{s('显示已完成', 'Show completed')}</label></div>
    {overlaps.filter(pair=>pair.task.startAt!<new Date(+days[days.length-1]+86400000)&&pair.task.dueDate>days[0]).map(pair=><div className="mb-calendar-conflict" role="alert" key={pair.key}><span>{s('⚠ 时间可能冲突：','⚠ Overlapping events: ')}{pair.task.title} ↔ {pair.other.title}</span><button disabled={store.loading||store.error} onClick={async()=>{try{await store.save(settings=>({...settings,confirmedConflicts:[...new Set([...(settings.confirmedConflicts??[]) as string[],pair.key])].slice(-2000)}));setConflictError(false);}catch{setConflictError(true);}}}>{s('已核对，保留安排','Reviewed, keep both')}</button></div>)}
    {conflictError&&<p role="alert">{s('确认未保存，请重试。','Confirmation was not saved. Retry.')}</p>}
    <div className="mb-calendar-scroll" ref={scroll} tabIndex={0} aria-label={s('滚动查看全天日程', 'Scroll through the daily schedule')}>
      <div className={`mb-calendar-sheet mb-calendar-${view}`} style={{ gridTemplateColumns: `46px repeat(${days.length},minmax(0,1fr))` }}>
        <div className="mb-calendar-day-heading mb-calendar-time-heading">GMT{(-new Date().getTimezoneOffset() / 60) >= 0 ? '+' : ''}{-new Date().getTimezoneOffset() / 60}</div>
        {days.map(day => <div key={+day} className={`mb-calendar-day-heading${+localDay(clock) === +day ? ' is-today' : ''}`}><span>{day.toLocaleDateString(locale, { weekday: 'short' })}</span><strong>{day.getDate()}</strong></div>)}
        <div className="mb-calendar-deadline-label">{s('截止', 'Due')}</div>
        {data.map((column, index) => <div className="mb-calendar-deadlines" key={index}>{column.deadlines.map(task => <button key={task.id} title={detail(task)} onClick={() => setEditingId(task.id)} className={task.status === 'completed' ? 'is-completed' : ''} style={{ borderLeftColor: colors[task.priority] }}><time>{time(task.dueDate)}</time> {task.title}</button>)}{!column.deadlines.length && <span className="mb-calendar-empty-mark">—</span>}</div>)}
        <div className="mb-calendar-hours">{Array.from({ length: 24 }, (_, hour) => <span key={hour} style={{ top: hour * 48 }}>{String(hour).padStart(2, '0')}:00</span>)}</div>
        {data.map((column, index) => <div className={`mb-calendar-day-column${+localDay(clock) === +days[index] ? ' is-today' : ''}`} key={index}>
          {column.events.map(event => <button key={event.task.id} className={`mb-calendar-event${event.task.status === 'completed' ? ' is-completed' : ''}`} title={detail(event.task)} aria-label={detail(event.task)} onClick={() => setEditingId(event.task.id)} style={{ top: `${event.start / 1440 * 100}%`, height: `${(event.end - event.start) / 1440 * 100}%`, left: `calc(${event.lane / event.lanes * 100}% + 2px)`, width: `calc(${100 / event.lanes}% - 4px)`, borderLeftColor: colors[event.task.priority], color: colors[event.task.priority] }}><strong>{event.task.title}</strong><span>{event.continuesBefore ? s('接上日', 'Continued') : time(event.task.startAt!)} – {event.continuesAfter ? s('延续次日', 'Continues') : time(event.task.dueDate)}</span></button>)}
          {+localDay(clock) === +days[index] && <div className="mb-calendar-now" style={{ top: `${(clock.getHours() * 60 + clock.getMinutes()) / 1440 * 100}%` }} />}
        </div>)}
      </div>
    </div>
    {!data.some(column => column.events.length || column.deadlines.length) && <p className="mb-calendar-empty">{s('这段时间还没有任务或日程。', 'There are no tasks or events in this period.')}</p>}
    {editing && <div className="mb-calendar-edit"><TaskForm task={editing} onClose={() => setEditingId(null)} /></div>}
  </section>;
}
