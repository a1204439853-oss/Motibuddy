import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FocusContext, focusTotals } from '@/contexts/focusContext';
import { useLocale } from '@/i18n/react';
import { focusConfigSchema } from '@/services/focusSession';
import { focusQuotes } from './focusQuotes';
import './focus.css';
import {useBusinessSettings} from '@/hooks/useBusinessSettings';
import {useFocusMusic} from './focusMusic';

export function focusDuration(ms: number, locale: string) {
  const seconds = Math.floor(ms / 1000), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), rest = seconds % 60;
  return locale === 'zh-CN' ? `${hours ? `${hours} 小时 ` : ''}${minutes} 分 ${rest} 秒` : `${hours ? `${hours}h ` : ''}${minutes}m ${rest}s`;
}
export default function FocusSpace() {
  const { locale } = useLocale();
  const s = (zh: string, en: string) => locale === 'zh-CN' ? zh : en;
  const focus = useContext(FocusContext), totals = focusTotals(focus.journal);
  const [config, setConfig] = useState({ focusMinutes: 25, breakMinutes: 5, cycles: 4 });
  const [entered, setEntered] = useState(false), [leaving, setLeaving] = useState(false), [starting, setStarting] = useState(false);
  const screen = useRef<HTMLDivElement>(null);
  const musicStore=useBusinessSettings();
  const music=(musicStore.settings.focusMusic??{enabled:false,volume:40}) as {enabled:boolean;volume:number};
  const primeMusic=useFocusMusic(entered&&music.enabled&&focus.session?.phase==='focus',music.volume);
  const musicControls=<div className="focus-music-controls"><label><input type="checkbox" aria-label={s('背景纯音乐','Instrumental music')} checked={music.enabled} disabled={musicStore.loading||musicStore.error} onChange={e=>{if(e.target.checked)primeMusic();const enabled=e.target.checked;void musicStore.save(settings=>({...settings,focusMusic:{...music,enabled}})).catch(()=>{});}}/>{s('背景纯音乐 · 轻柔旋律','Instrumental · Gentle melody')}</label>{music.enabled&&<input aria-label={s('音乐音量','Music volume')} type="range" min="0" max="100" value={music.volume} onChange={e=>{const volume=Number(e.target.value);void musicStore.save(settings=>({...settings,focusMusic:{...music,volume}})).catch(()=>{});}}/>}</div>;
  const session = focus.session;
  const exitRef = useRef(focus.exit); exitRef.current = focus.exit;
  useEffect(() => () => { void exitRef.current().catch(() => {}); }, []);
  useEffect(() => { if (session && !session.endedAt) setEntered(true); }, [session?.id]);
  useEffect(() => {
    if (!entered) return;
    const shell = document.querySelector<HTMLElement>('[data-main-shell]');
    if (shell) shell.inert = true;
    screen.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (shell) shell.inert = false; };
  }, [entered]);
  const remaining = session && !session.endedAt ? Math.max(0, Math.ceil((+new Date(session.phaseEndAt) - (focus.error ? +new Date(session.updatedAt) : Date.now())) / 1000)) : 0;
  const isBreak = session?.phase === 'break';
  const totalSeconds = session ? (isBreak ? session.config.breakMinutes : session.config.focusMinutes) * 60 : 1;
  const quote = focusQuotes[session ? (session.quoteOffset + session.completedCycles - (isBreak ? 1 : 0) + 5) % 5 : 0];
  const pieces = useMemo(() => Array.from({ length: 54 }, (_, index) => ({ left: `${(index * 37) % 100}%`, background: ['#00cecb', '#ff6865', '#f5c94d', '#9f8be3', '#76c6ee'][index % 5], animationDelay: `${index % 9 * .13}s`, rotate: `${index * 23}deg` })), [session?.id, session?.completedCycles]);
  const leave = async () => { if (leaving) return; setLeaving(true); try { await focus.exit(); setEntered(false); } catch { /* Save failure is shown; preserve the record and allow retry. */ } finally { setLeaving(false); } };
  const error = focus.error && <div className="focus-error" role="alert">{s('专注记录保存或读取失败，计时已暂停，已有记录保留。请重试。', 'Focus records could not be read or saved. The timer is paused and existing records are preserved. Retry to continue.')}<button type="button" disabled={focus.busy} onClick={() => void focus.retry().catch(() => {})}>{s('重试', 'Retry')}</button></div>;
  return <><section className="focus-setup" aria-label={s('专注空间准备', 'Prepare focus space')}>
    <div className="focus-setup-heading"><span aria-hidden="true">◷</span><h1>{s('给当下，留一段专注的时间。', 'Make a little room to focus.')}</h1><p>{s('专注一会儿，认真休息，再开始下一轮。', 'Focus for a while, rest well, and begin again.')}</p><button type="button" className="focus-evidence-teaser" onClick={()=>{const panel=document.querySelector('.focus-research');panel?.querySelector('details')?.setAttribute('open','');panel?.scrollIntoView({behavior:'smooth',block:'nearest'});}}>{s('✦ 2335 人的研究汇总：短休息，有助于恢复活力。', '✦ Evidence from 2,335 people: short breaks help restore vigor.')} <span>↗</span></button></div>
    <section className="focus-record-panel" aria-labelledby="focus-record-title"><h2 id="focus-record-title"><i className="fa-solid fa-chart-simple" aria-hidden="true" /> {s('我的专注记录', 'Your focus journey')}</h2><div className="focus-history"><div><span>{s('累计专注时长', 'Total focus time')}</span><strong>{focus.loading || focus.error ? '—' : focusDuration(totals.focusMs, locale)}</strong></div><div><span>{s('累计专注次数', 'Focus sessions started')}</span><strong>{focus.loading || focus.error ? '—' : totals.entries}</strong></div><div><span>{s('累计完成轮次', 'Focus rounds completed')}</span><strong>{focus.loading || focus.error ? '—' : totals.completedCycles}</strong></div><div><span>{s('上次进入专注空间', 'Last focus session')}</span><strong>{totals.lastStartedAt ? new Date(totals.lastStartedAt).toLocaleString(locale, { hour12: false }) : s('还没有记录', 'No sessions yet')}</strong></div></div></section>
    {focus.summary && <div role="status" className="focus-summary">{focus.summary.reason === 'interrupted' ? s('已恢复上次中断前保存的记录。', 'Recovered the last saved progress from an interrupted session.') : s('辛苦啦，本次专注已记录。', 'Well done. Your focus session is saved.')}<strong>{s('本次专注：', 'This session: ')}{focusDuration(focus.summary.focusMs, locale)} · {focus.summary.completedCycles} {s('轮完成', 'rounds completed')}</strong></div>}
    {error}
    <form className="focus-config-panel" aria-labelledby="focus-config-title" onSubmit={event => { event.preventDefault(); if (starting || focus.busy || focus.error || focus.loading || !focusConfigSchema.safeParse(config).success) return; if(music.enabled)primeMusic(); setStarting(true); void focus.start(config).then(() => setEntered(true)).catch(() => {}).finally(() => setStarting(false)); }}>
      <h2 id="focus-config-title"><i className="fa-solid fa-sliders" aria-hidden="true" /> {s('本次专注设置', 'Set up this session')}</h2><p className="focus-config-intro">{s('从一个轻松的节奏开始。今天的时间，由你决定。', 'Start with a comfortable rhythm. This time belongs to you.')}</p><div className="focus-settings">{([{ key: 'focusMinutes', zh: '每轮专注（分钟）', en: 'Focus minutes', max: 180 }, { key: 'breakMinutes', zh: '每轮休息（分钟）', en: 'Break minutes', max: 60 }, { key: 'cycles', zh: '循环次数', en: 'Rounds', max: 12 }] as const).map(field => <label key={field.key}>{s(field.zh, field.en)}<input name={field.key} type="number" min={1} max={field.max} required step={1} value={Number.isFinite(config[field.key]) ? config[field.key] : ''} disabled={starting || focus.loading} onChange={event => setConfig(previous => ({ ...previous, [field.key]: event.target.value === '' ? NaN : Number(event.target.value) }))} /></label>)}</div>
      {musicControls}
      <p className="focus-setting-hint">{s('累计轮次只计完成的专注轮次；中途退出也保留本次已专注的时长，休息不计入。', 'Completed focus rounds count toward your total. Exiting early keeps elapsed focus time; breaks do not count.')}</p>
      <button className="focus-primary" type="submit" disabled={focus.loading || focus.busy || starting || focus.error || !focusConfigSchema.safeParse(config).success}>{focus.loading ? s('读取记录中…', 'Loading records…') : starting ? s('准备中…', 'Preparing…') : s('开始专注', 'Start focusing')}</button>
    </form>
    <aside className="focus-research" aria-label={s('研究依据', 'Research evidence')}><span className="focus-research-icon" aria-hidden="true">✦</span><div><h2>{s('认真休息，也是在认真前进。', 'A little rest helps you keep going.')}</h2><p>{s('Albulescu 等（2022）汇总 22 个独立样本、2335 人：10 分钟以内的短休息，有助于恢复活力、减轻疲劳。给自己几分钟，再回来做下一件小事。', 'Albulescu et al. (2022) combined 22 independent samples with 2,335 participants: breaks of up to 10 minutes helped restore vigor and reduce fatigue. Take a few minutes, then return to one small step.')}</p><details><summary>{s('看看研究怎么说', 'Explore the evidence')}</summary><p>{s('活力效应量 d=0.36，疲劳 d=0.35，均为小效应；整体工作表现提升未达统计显著。效应量不等于提升百分比，也不代表 25/5 是每个人的最佳节奏。', 'Small effects were found for vigor (d=0.36) and fatigue (d=0.35). Overall performance improvement was not statistically significant. Effect sizes are not percentages, and this does not establish 25/5 as an optimal rhythm for everyone.')}</p><a href="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0272460" target="_blank" rel="noreferrer">Albulescu et al. · PLOS ONE · 2022 ↗</a></details></div></aside>
  </section>{entered && createPortal(<div ref={screen} className={`focus-screen${isBreak ? ' focus-resting' : ''}`} role="dialog" aria-modal="true" aria-label={s('专注空间', 'Focus space')} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const buttons = [...(screen.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') ?? [])];
    if (!buttons.length) return;
    if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1]?.focus(); }
    else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
  }}>
    {isBreak && <><video className="focus-rest-video" src="./welcome_bg.mp4" poster="./pet_selection_bg.png" autoPlay muted loop playsInline /><div className="focus-rest-veil" /><div className="focus-confetti" key={`${session?.id}-${session?.completedCycles}`} aria-hidden="true">{pieces.map((piece, index) => <i key={index} style={piece} />)}</div></>}
    <button className="focus-exit" aria-label={s('退出专注空间', 'Exit focus space')} onClick={() => void leave()} disabled={leaving}>{leaving ? s('保存中…', 'Saving…') : s('退出专注空间', 'Exit focus space')} <span aria-hidden="true">↗</span></button>
    <div className="focus-stage"><p className="focus-phase">{isBreak ? s('这一轮，你做到了。', 'You did it. Well done.') : session ? s('只做眼前这一件事', 'Just one thing, right now.') : s('今天的努力，已经留下痕迹。', 'Your effort today has made a difference.')}</p><h2>{isBreak ? s('好好休息一下', 'Time for a real break') : session ? s('专注时刻', 'Time to focus') : s('本次专注完成', 'Session complete')}</h2>
      <div className="focus-clock" role="timer" aria-live="off" aria-label={s('剩余时间', 'Time remaining')}><svg viewBox="0 0 240 240" aria-hidden="true"><circle className="focus-ring-track" cx="120" cy="120" r="108" /><circle className="focus-ring-progress" cx="120" cy="120" r="108" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - remaining / totalSeconds * 100} /></svg><div><strong data-testid="focus-countdown">{String(Math.floor(remaining / 60)).padStart(2, '0')}<em>:</em>{String(remaining % 60).padStart(2, '0')}</strong><span>{session ? s(`第 ${Math.min(session.completedCycles + (isBreak ? 0 : 1), session.config.cycles)} / ${session.config.cycles} 轮`, `Round ${Math.min(session.completedCycles + (isBreak ? 0 : 1), session.config.cycles)} / ${session.config.cycles}`) : s('做得很好', 'Well done')}</span></div></div>
      {isBreak ? <p className="focus-rest-message">{s('喝点水，看看窗外，或起来走两步。\n休息也是下一次专注的准备。', 'Drink some water, look outside, or take a short walk.\nRest is part of preparing for your next focus session.')}</p> : session ? <blockquote key={`${session.id}-${session.completedCycles}`}>{locale === 'zh-CN' ? quote.zh : quote.en}<cite>— {quote.author[locale === 'zh-CN' ? 0 : 1]}</cite></blockquote> : <p className="focus-finished-summary">{s('本次专注：', 'This session: ')}{focusDuration(focus.summary?.focusMs ?? 0, locale)}</p>}
      {musicControls}
      {error}
      {session && <p className="focus-live-total">{s('本次累计专注', 'Focus time this session')} · {focusDuration(session.focusMs, locale)}{focus.busy ? s(' · 保存中', ' · Saving') : ''}</p>}
      {!session && <button className="focus-primary" onClick={() => void leave()}>{s('返回准备页面', 'Back to setup')}</button>}
    </div>
  </div>, document.body)}</>;
}
