import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '@/contexts/authContext';
import { TaskContext } from '@/contexts/taskContext';
import { useLocale } from '@/i18n/react';
import { businessRepository } from '@/services/storage';
import { readSessionStamp } from '@/services/runtimeSession';
import { AgentClientError, clearAgentConnection, generateAgentResult, prepareAgentImage } from '@/services/agentClient';
import { agentWorkspaceSchema, duplicateTaskKey, prepareAgentBatch, saveAgentPlan, taskFingerprint, type AgentBatch } from '@/services/agentActions';
import { conversationInstruction, planPreferences } from '@/services/agentConversation';
import type { AgentDraft, AgentRequest, AgentResult } from '@/services/agentContracts';
import AgentResultCards from './AgentResultCards';
import './agent.css';
import FormattedText from '@/components/ui/FormattedText';
import PersonalitySetting from '@/components/ui/PersonalitySetting';
import ProfileSurvey from './ProfileSurvey';
import ReadAloud from '@/components/voice/ReadAloud';
import {archiveGenerated,surveySchema} from '@/services/companionRecords';
import ScheduledTasks from '@/components/ScheduledTasks';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { personalityInstruction, personalitySchema } from '@/services/productData';
import DictationButton from '@/components/voice/DictationButton';
import { draftIssues, editAgentDraft } from '@/services/agentDraftReview';
import { agentScenarios, scenarioInstruction, weeklyEvidence, weeklyComparison, type AgentScenario } from '@/services/agentScenarios';

type Copy = [string, string];
type Message = { id: number; role: 'user' | 'assistant'; text: string | Copy; image?: string; widget?:'schedule' };
const stampKey = () => JSON.stringify(readSessionStamp(localStorage));
export default function AgentPanel({ active, onMessageSent }: { active: boolean; onMessageSent: () => void }) {
  const { locale } = useLocale();
  const s = (zh: string, en: string) => locale === 'zh-CN' ? zh : en;
  const display = (value: string | Copy) => Array.isArray(value) ? s(...value) : value;
  const { currentUser, currentPet, sessionVersion } = useContext(AuthContext);
  const settingsStore = useBusinessSettings();
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const assistantName = currentPet?.name ?? s('宠物助手', 'Pet assistant');
  const { tasks, importAgentTasks, isLoading, isSaving, loadError } = useContext(TaskContext);
  const owner = currentUser!.id, session = useRef(stampKey());
  const mounted = useRef(true), busyRef = useRef(false), visible = useRef(active);
  visible.current = active;
  const tasksRef = useRef(tasks); tasksRef.current = tasks;
  const requestRef = useRef<AbortController | null>(null), inputRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null), logRef = useRef<HTMLDivElement>(null), nextMessageId = useRef(0);
  const [mode, setMode] = useState<AgentRequest['mode']>('chat');
  const [hasAsked,setHasAsked]=useState(false);
  const [scheduleMessageId,setScheduleMessageId]=useState<number|null>(null);
  const [scheduleRequest,setScheduleRequest]=useState<{id:number;text:string}>();
  const [scenario, setScenario] = useState<AgentScenario | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null), [energy, setEnergy] = useState<AgentRequest['energy']>('normal');
  const [input, setInput] = useState(''), [image, setImage] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [result, setResult] = useState<AgentResult | null>(null), [resultMessageId, setResultMessageId] = useState<number | null>(null);
  const [fingerprint, setFingerprint] = useState(''), [resultBudget, setResultBudget] = useState(60);
  const [selected, setSelected] = useState<number[]>([]), [busy, setBusy] = useState(false), [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false), [dirty, setDirty] = useState(false), [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState<Copy | null>(null), [error, setError] = useState<Copy | null>(null);
  const batchRef = useRef<AgentBatch | null>(null);
  const archiveRef=useRef<{scenario:AgentScenario|null;text:string;picture?:string;now:Date;id:string;tasks:typeof tasks}|null>(null);
  const isCurrent = () => mounted.current && session.current === stampKey() && readSessionStamp(localStorage)?.userId === owner;
  const addMessage = (role: Message['role'], text: Message['text'], picture?: string,widget?:'schedule') => {
    const id = ++nextMessageId.current;
    setMessages(previous => [...previous.slice(-29), { id, role, text, ...(picture ? { image: picture } : {}),...(widget?{widget}:{}) }]);
    return id;
  };
  const selectionFor = (value: AgentResult) => value.mode !== 'create' ? [] : value.drafts.flatMap((draft, index) =>
    !draftIssues(draft, tasksRef.current).length ? [index] : []);

  useEffect(() => {
    mounted.current = true; let current = true;
    clearAgentConnection();
    void businessRepository.read(owner).then(snapshot => {
      if (!current || !isCurrent()) return;
      const stored = snapshot?.data.settings.agentWorkspace;
      if(stored||snapshot?.data.settings.agentHasAsked)setHasAsked(true);
      if (!stored) return;
      const parsed = agentWorkspaceSchema.safeParse(stored);
      if (!parsed.success) { setRestoreFailed(true); setError(['已保存的草稿无法读取，原始记录已保留。', 'Saved drafts could not be read. Original records were preserved.']); return; }
      const workspace = parsed.data;
      setResult(workspace.result); setMode('chat'); setScenario(null); setFingerprint(workspace.fingerprint);
      setResultBudget(workspace.availableMinutes); setMinutes(workspace.result.mode === 'plan' ? workspace.availableMinutes : null);
      const valid = selectionFor(workspace.result);
      setSelected(workspace.selected ? workspace.selected.filter(index => valid.includes(index)) : valid);
      setResultMessageId(addMessage('assistant', workspace.result.summary));
      setNotice(['已恢复上次保存的结果。', 'Restored the last saved result.']);
    }).catch(() => { if (current && isCurrent()) { setRestoreFailed(true); setError(['草稿读取失败，请重新打开应用后重试。', 'Could not load drafts. Reopen the app and try again.']); } })
      .finally(() => { if (current && isCurrent()) setRestoring(false); });
    return () => { current = false; mounted.current = false; requestRef.current?.abort(); clearAgentConnection(); };
  }, [owner, sessionVersion]);
  useEffect(() => { if (!active) requestRef.current?.abort(); }, [active]);
  useEffect(() => { if (active) { inputRef.current?.focus(); logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); } }, [active, messages.length, busy, scenario]);
  useEffect(()=>{if(!active||scenario!=='schedule'||!scheduleMessageId)return;const log=logRef.current,card=log?.querySelector<HTMLElement>(`[data-message-id="${scheduleMessageId}"]`);if(log&&card)log.scrollTo({top:card.getBoundingClientRect().top-log.getBoundingClientRect().top+log.scrollTop,behavior:'smooth'});},[active,scenario,scheduleMessageId]);
  useEffect(() => { if (scenario === 'review') logRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [scenario]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => { if (dirty || locked) event.preventDefault(); };
    window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave);
  }, [dirty, locked]);

  const showError = (value: unknown) => {
    const code = value instanceof AgentClientError ? value.code : '';
    const errors: Record<string, Copy> = {
      UNAUTHORIZED: ['本机连接已过期，请重新发送。若仍失败，请重启本机 AI 服务。', 'The local connection expired. Send again, or restart the local AI service.'],
      GATEWAY_UNAVAILABLE: ['暂时无法连接 AI，请确认本机 AI 服务已启动后重试。', 'Cannot connect to AI. Check that the local AI service is running and retry.'],
      ORIGIN_DENIED: ['当前应用未获本机服务授权，请重启最新的 AI 服务。', 'This app is not allowed by the local service. Restart the updated AI service.'],
      UPSTREAM_REJECTED: ['AI 服务未能处理请求，请检查服务端配置和余额。', 'The AI service rejected the request. Check server settings and balance.'],
      UPSTREAM_UNAVAILABLE: ['AI 服务暂不可用或已超时，请稍后重试。', 'AI is unavailable or timed out. Please try again later.'],
      UPSTREAM_BUSY: ['AI 正忙，请稍后再试。', 'AI is busy. Please try again later.'],
      RATE_LIMITED: ['已达到本机调用上限，请稍后再试。', 'The local request limit was reached. Please try again later.'],
      REQUEST_IN_PROGRESS: ['上一个请求仍在处理中，请稍等。', 'The previous request is still running. Please wait.'],
      INVALID_MODEL_RESULT: ['回答未通过校验，没有修改任务。请补充说明后重试。', 'The response did not pass validation. Tasks are unchanged. Clarify and retry.'],
      INVALID_REQUEST: ['消息过长或格式不正确，请缩短内容后重试。', 'Input is too long or invalid. Shorten it and retry.'],
      INVALID_IMAGE: ['请选择 12 MB 以内的 PNG、JPEG 或 WebP 图片。', 'Choose a PNG, JPEG or WebP image under 12 MB.'],
      CANCELLED: ['已取消本次生成，之前的内容已保留。', 'Generation cancelled. Previous content was preserved.'],
    };
    setError(errors[code] ?? ['保存未完成，草稿已保留。请检查任务日期、重复项和保存状态后重试。', 'Saving did not finish. Drafts were preserved. Check dates, duplicates and save status before retrying.']);
  };
  const persist = async (value: AgentResult, fp = fingerprint, budget = resultBudget, chosen = selected,archive?:NonNullable<typeof archiveRef.current>) => {
    if(archive)archiveRef.current=archive;const pendingArchive=archive??archiveRef.current;
    const workspace = agentWorkspaceSchema.parse({ version: 1, savedAt: new Date().toISOString(), result: value, fingerprint: fp, availableMinutes: budget, selected: chosen });
    await businessRepository.transact(owner, data => ({ ...data, settings: { ...(pendingArchive?archiveGenerated(data.settings,pendingArchive.scenario,value,pendingArchive.tasks,pendingArchive.text,pendingArchive.picture,pendingArchive.now,pendingArchive.id):data.settings), agentWorkspace: workspace,agentHasAsked:true } }), isCurrent);
    if(archiveRef.current===pendingArchive)archiveRef.current=null;
  };
  const leaveScenario = () => { setScenario(null); setMode('chat'); setMinutes(null); setError(null); };
  const choose = (next: AgentScenario) => {
    if (busyRef.current || locked) return;
    if (scenario === next) { leaveScenario(); return; }
    setScenario(next); setMode(next === 'plan' || next === 'create' ? next : 'chat'); setError(null);setNotice(null); setMinutes(null);
    if(next==='schedule'){setScheduleMessageId(addMessage('assistant',['',''],undefined,'schedule'));}
    else if(next==='plan'||next==='review'||next==='recommend'){ void send({scenario:next,text:next==='recommend'?s('请根据我的偏好，推荐几件今天能行动的小事。','Suggest a few practical small steps based on my preferences.'):next==='plan'?s('请帮我安排今天的任务。','Please plan today using my existing tasks.'):s('陪我看看这周的进展，并和过去几周比较一下吧。','Review this week and compare it with the previous weeks.')} ); }
    else addMessage('assistant', agentScenarios.find(item => item.id === next)!.prompt);
    inputRef.current?.focus();
  };
  const send = async (initial?: {scenario:AgentScenario;text:string}) => {
    const activeScenario=initial?.scenario??scenario;
    if(activeScenario==='schedule'){if(!input.trim())return;setHasAsked(true);setScheduleRequest({id:Date.now(),text:input.trim()});addMessage('user',input.trim());setScheduleMessageId(addMessage('assistant',['',''],undefined,'schedule'));setInput('');onMessageSent();return;}
    const text = initial?.text??input.trim(), picture = initial?undefined:image;
    if ((!text && !picture) || busyRef.current || !isCurrent() || !visible.current) return;
    busyRef.current = true; setBusy(true); requestRef.current = null;
    if (dirty && result) {
      try { await persist(result); if (!isCurrent()) return; setDirty(false); }
      catch (err) { if (isCurrent()) { showError(err); busyRef.current = false; setBusy(false); } return; }
    }
    if (!isCurrent() || !visible.current) { busyRef.current = false; if (isCurrent()) setBusy(false); return; }
    setHasAsked(true);onMessageSent(); setInput(''); setImage(undefined); setError(null); setNotice(null);
    const latest = text || s('请看看这张图片，识别其中可整理的任务；若没有任务内容，请说明图片内容，不要编造任务。', 'Inspect this image for actionable tasks. If none are present, describe the image without inventing tasks.');
    addMessage('user', latest, picture);
    const explicitCreate = /(?:帮我|请|想|我要|需要).{0,12}(?:创建|添加|新建|安排)|(?:创建|添加|新建).{0,12}任务|\b(?:create|add|schedule)\b.{0,35}\b(?:task|reminder|meeting)\b/i.test(text) && !/不(?:要|用|想|需要|打算)|别(?:帮|创建|添加|新建)|do not|don't/i.test(text);
    const nextMode = initial?.scenario==='plan'?'plan':picture&&activeScenario!=='journal' || explicitCreate&&activeScenario!=='journal' || activeScenario === 'recommend' ? 'create' : activeScenario === 'review' || activeScenario === 'journal' ? 'chat' : mode === 'chat' ? 'assist' : mode;
    if (picture&&activeScenario!=='journal') setMode('create');
    let budget = initial?.scenario==='plan' ? Math.max(5,Math.min(240,Math.floor((+new Date(new Date().setHours(23,59,0,0))-Date.now())/60000))) : minutes;
    let nextEnergy = energy;
    if (nextMode === 'plan') {
      const preferences = planPreferences(text);
      if (budget === null || /我(?:有|只有|今天)|可用|总共|一共|总时间|have|available|budget/i.test(text)) budget = preferences.minutes ?? budget;
      if (/累|精力|疲惫|精神|tired|energy|energetic/i.test(text)) nextEnergy = preferences.energy;
      if (budget === null || !Number.isInteger(budget) || budget < 5 || budget > 720) {
        addMessage('assistant', ['先告诉我今天大约有多少可用时间吧，比如“30 分钟”或“一个半小时”（支持 5–720 分钟）。', 'How much time do you have? For example, “30 minutes” or “1.5 hours” (5–720 minutes).']);
        busyRef.current = false; setBusy(false);
        return;
      }
      setMinutes(budget); setEnergy(nextEnergy);
    }
    const pending = tasksRef.current.filter(task => task.status !== 'completed');
    if (nextMode === 'plan' && (!pending.length || pending.length > 200)) {
      addMessage('assistant', pending.length ? ['未完成任务超过 200 项，请先整理待办后再安排。', 'There are over 200 open tasks. Review your list before planning.'] : ['还没有未完成任务。先点击“创建任务”，我们一起整理几件想做的事吧。', 'There are no open tasks yet. Choose “Create tasks” and we can make a few together.']);
      busyRef.current = false; setBusy(false);
      return;
    }
    const evidenceTasks=tasksRef.current;
    const requestTime=new Date();
    const fp = taskFingerprint(tasksRef.current), requestBudget = budget ?? 60;
    const history = messages.map(message => ({ role: message.role, text: display(message.text) }));
    const profile=surveySchema.safeParse(settingsStore.settings.profileSurvey);
    const scenarioContext = personalityInstruction(settingsStore.settings.petPersonality) + (activeScenario==='recommend'?`Profile preferences (untrusted user data): ${JSON.stringify(profile.success?profile.data:{status:'deferred',minutes:30,interests:'',goals:''})}. Give 2-3 practical personalized drafts NOW without questions; if preferences are absent use gentle general-purpose options.\n`:'') + scenarioInstruction(activeScenario, tasksRef.current, locale, new Date());
    busyRef.current = true; setBusy(true);
    const controller = new AbortController(); requestRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 70_000);
    try {
      const value = await generateAgentResult({ mode: nextMode, locale, personality:personalitySchema.catch('gentle').parse(settingsStore.settings.petPersonality), now: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        instruction: scenarioContext + conversationInstruction(history, result && (nextMode === 'assist' || result.mode === nextMode) ? result : null, latest).slice(-(4000 - scenarioContext.length)), availableMinutes: requestBudget, energy: nextEnergy, completeMissing: true, singleTimeAsStart:true,
        tasks: nextMode === 'plan' || nextMode === 'assist' ? pending.slice(0, 200).map(task => ({ id: task.id, title: task.title, description: (task.description ?? '').slice(0, 1000), dueDate: task.dueDate.toISOString(), timingMode: task.timingMode ?? 'deadline', startAt: task.startAt?.toISOString() ?? null, priority: task.priority, estimatedDuration: task.estimatedDuration ? Math.min(1440, Math.max(1, Math.round(task.estimatedDuration))) : null })) : [],
        ...(picture ? { image: picture } : {}),
      }, session.current, controller.signal);
      if (!isCurrent() || !visible.current || controller.signal.aborted) return;
      setResult(value); setFingerprint(fp); setResultBudget(requestBudget); setSelected(selectionFor(value));
      setResultMessageId(addMessage('assistant', value.summary));
      setLocked(false); batchRef.current = null; setDirty(true);
      try { await persist(value, fp, requestBudget, selectionFor(value),{scenario:activeScenario,text:latest,picture,now:requestTime,id:crypto.randomUUID(),tasks:evidenceTasks}); if (isCurrent()) {setDirty(false);if(activeScenario==='plan')addMessage('assistant',['今日计划已收好，可以在「任务清单 → 今日计划」随时查看。我们从第一小步开始吧。','Your plan is saved in Task list → Daily plan. We can start with one small step.']);if(activeScenario==='review')addMessage('assistant',['这份周报已存入「日历&数据统计 → 周报档案」，以后也能回头看看自己的进步。','Your report is saved in Calendar & Statistics → Weekly reports.']);if(activeScenario==='journal')addMessage('assistant',['这一页已轻轻放进「手账本&纪念日 → 手账本」，你可以继续编辑、贴照片或画点什么。','Your page is saved in Journal & Anniversaries → Journal. Add photos, stickers or a little drawing whenever you like.']);} }
      catch { if (isCurrent()) setError(['回答已生成，但草稿保存失败。请保留此页并重试保存。', 'The answer is ready, but saving failed. Keep this page open and retry saving.']); }
    } catch (err) { if (isCurrent() && visible.current) showError(err); }
    finally { clearTimeout(timer); if (requestRef.current === controller) requestRef.current = null; if (isCurrent()) { busyRef.current = false; setBusy(false); } }
  };
  const saveDraft = async () => {
    if (!result || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    try { await persist(result); if (isCurrent()) { setDirty(false); setNotice(['草稿已保存。', 'Draft saved.']); } }
    catch (err) { if (isCurrent()) showError(err); }
    finally { if (isCurrent()) { busyRef.current = false; setBusy(false); } }
  };
  const saveResult = async (conflictsConfirmed = false) => {
    if (!result || result.mode === 'chat' || busyRef.current || !isCurrent()) return;
    busyRef.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      if (result.mode === 'plan') {
        await businessRepository.transact(owner, data => saveAgentPlan(data, result, fingerprint, resultBudget, new Date()), isCurrent);
        if (isCurrent()) setNotice(['今日计划已保存，任务优先级保持原样。', 'Daily plan saved. Task priorities are preserved.']);
      } else {
        if (!selected.length) throw new Error();
        let batch = batchRef.current;
        if (!locked || !batch) { batch = await prepareAgentBatch(result.drafts.filter((_, index) => selected.includes(index))); if(conflictsConfirmed)batch.confirmedConflictFingerprint=taskFingerprint(tasksRef.current); }
        if (!isCurrent()) return;
        await persist(result); if (!isCurrent()) return;
        batchRef.current = batch; setLocked(true);
        await importAgentTasks(batch);
        if (isCurrent()) { setResult(null); leaveScenario(); setSelected([]); setDirty(false); setLocked(false); batchRef.current = null; addMessage('assistant', ['所选任务已经整批录入。可以去“任务”查看，也可以继续告诉我下一件事。', 'Selected tasks were imported together. View them in Tasks, or tell me what is next.']); }
      }
    } catch (err) { if (isCurrent()) showError(err); }
    finally { if (isCurrent()) { busyRef.current = false; setBusy(false); } }
  };
  const attachImage = async (file:File) => {
    if(busyRef.current||locked||restoring||restoreFailed)return;busyRef.current=true;setBusy(true);setError(null);
    try{const picture=await prepareAgentImage(file,scenario==='journal'?700:1800);if(isCurrent()){setImage(picture);if(scenario==='journal')setMode('chat');else{setMode('create');setScenario('create');}}}
    catch(err){if(isCurrent())showError(err);}finally{if(isCurrent()){busyRef.current=false;setBusy(false);inputRef.current?.focus();}}
  };
  useEffect(()=>{
    if(!active||hasAsked||messages.some(message=>message.role==='user')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let direction=1;const timer=setInterval(()=>{const row=shortcutsRef.current;if(!row||row.matches(':hover')||row.contains(document.activeElement))return;const max=row.scrollWidth-row.clientWidth;if(max<=0)return;if(row.scrollLeft>=max-1)direction=-1;if(row.scrollLeft<=0)direction=1;row.scrollLeft+=direction*.5;},40);return()=>clearInterval(timer);
  },[active,messages,hasAsked]);
  const blocked = busy || restoring || restoreFailed || isLoading || isSaving || !!loadError;
  const stale = result?.mode === 'plan' && fingerprint !== taskFingerprint(tasks);
  return <><section className="mb-agent" aria-label={s('宠物助手', 'Pet assistant')}>
    <header className="mb-agent-header"><div><h1>{s('宠物助手', 'Pet assistant')}</h1><p>{s('聊聊想做的事，我们从一小步开始。', 'Tell me what you want to do. We will start small.')}</p></div><PersonalitySetting compact/></header>
    <div className="mb-agent-log" role="log" aria-label={s('助手对话', 'Assistant conversation')} aria-live="polite" aria-busy={busy} ref={logRef}>
      {scenario === 'review' && <div className="mb-agent-weekly"><strong>{s('最近 7 天的完成记录', 'Completions in the last seven days')}</strong><div className="mb-agent-weekly-bars">{weeklyEvidence(tasks).days.map(day => <div key={day.date}><span>{day.completed}</span><i style={{ height: `${8 + Math.min(64, day.completed * 12)}px` }} /><small>{new Date(day.date).toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })}</small></div>)}</div><p>{s(`完成 ${weeklyEvidence(tasks).completed} 项 · 未完成 ${weeklyEvidence(tasks).open} 项`, `${weeklyEvidence(tasks).completed} completed · ${weeklyEvidence(tasks).open} open`)}{weeklyEvidence(tasks).missingCompletionDate > 0 && s('（缺少完成日期的旧记录未计入图表）', ' (Legacy records without completion dates are excluded.)')}</p><div className="mb-agent-comparison"><strong>{s('本周与过去 3 周','This week and the previous three')}</strong>{weeklyComparison(tasks).weeks.map((week,index)=><div key={week.start}><span>{index===3?s('本周','This week'):new Date(week.start).toLocaleDateString(locale,{month:'numeric',day:'numeric'})}</span><i style={{width:`${12+week.total/Math.max(1,...weeklyComparison(tasks).weeks.map(w=>w.total))*70}%`}}/><b>{week.total}</b><small>{s(`同期 ${week.comparable} 项`,`${week.comparable} at the same point`)}</small></div>)}<p>{s('本周尚未结束，对比建议使用“同期”记录；未记录不等于没有努力。','This week is still in progress. Compare counts at the same point; missing records do not mean missing effort.')}</p></div></div>}
      {!messages.length && <div className="mb-agent-welcome"><span aria-hidden="true">✦</span><h2>{s('今天，想从哪件小事开始？', 'What would you like to start with today?')}</h2><p>{s('可以直接和我聊聊，也可以选择下方卡片，一起安排任务。', 'Chat with me, or choose a card below to work on your tasks.')}</p></div>}
      {messages.map(message => <article data-message-id={message.id} className={`mb-agent-message mb-agent-message-${message.role}${message.widget==='schedule'?' mb-agent-message-schedule':''}${result && resultMessageId === message.id && result.mode !== 'chat' ? ' mb-agent-message-result' : ''}`} key={message.id}>
        <span className="mb-agent-speaker">{message.role === 'user' ? s('你', 'You') : assistantName}</span>
        <div className="mb-agent-bubble">{display(message.text)&&<FormattedText text={display(message.text)}/>}{message.widget==='schedule'&&(message.id===scheduleMessageId?<div className="mb-agent-schedule"><ScheduledTasks request={scheduleRequest}/></div>:<p>{s('定时任务可在「任务清单 → 每日任务」查看。','View schedules in Task list → Scheduled tasks.')}</p>)}{message.image && <img src={message.image} alt={s('本次上传的图片', 'Attached image')} />}
          {result && resultMessageId === message.id && <>
            {result.questions.length > 0 && <div className="mb-agent-note"><strong>{s('我们再确认一下', 'Let us clarify')}</strong><ul>{result.questions.map((question, index) => <li key={index}>{question}</li>)}</ul></div>}
            {result.warnings.length > 0 && <div className="mb-agent-note"><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
            <AgentResultCards onSelectAll={indices=>{setSelected(indices);setDirty(true);}} result={result} tasks={tasks} budget={resultBudget} selected={selected} blocked={blocked} locked={locked} dirty={dirty} stale={!!stale}
              onSelect={(index, checked) => { setSelected(previous => checked ? [...new Set([...previous, index])] : previous.filter(value => value !== index)); setDirty(true); }}
              onEdit={(index: number, patch: Partial<AgentDraft>) => {
                if (result.mode !== 'create' || locked) return;
                const edited = editAgentDraft(result.drafts[index], patch);
                setResult({ ...result, questions: [], warnings: result.warnings.filter(warning => !/^建议补全|^Suggested defaults/.test(warning)), drafts: result.drafts.map((draft, i) => i === index ? edited : draft) });
                setSelected(previous => draftIssues(edited, tasksRef.current).length ? previous.filter(value => value !== index) : [...new Set([...previous, index])]);
                setError(null); setDirty(true); setNotice(null);
              }}
              onSaveDraft={() => void saveDraft()} onSaveResult={confirmed => void saveResult(confirmed)} />
          </>}
          {message.role==='assistant'&&display(message.text)&&<ReadAloud text={display(message.text)} active={active}/>}
        </div>
      </article>)}
      {busy && <p className="mb-agent-typing" role="status">{s(`${assistantName}正在想办法`, `${assistantName} is thinking`)}<span aria-hidden="true">···</span></p>}
      {notice && <p className="mb-agent-notice" role="status">{s(...notice)}</p>}
      {error && <p className="mb-agent-error" role="alert">{s(...error)}</p>}
      {loadError && <p className="mb-agent-error">{s('任务数据暂不可用，请先恢复任务读取。', 'Task data is unavailable. Restore task loading first.')}</p>}
    </div>
    <div className="mb-agent-compose-area">
      <div className={`mb-agent-carousel${(hasAsked||messages.some(message=>message.role==='user'))?' is-compact':''}`}>
      <div ref={shortcutsRef} className="mb-agent-shortcuts" aria-label={s('助手功能', 'Assistant actions')} onWheel={event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)){event.currentTarget.scrollLeft+=event.deltaY;}}}>
        {agentScenarios.map(item => <button key={item.id} className="mb-agent-shortcut" aria-pressed={scenario === item.id} disabled={blocked || locked} onClick={() => choose(item.id)}><strong><i className={`fa-solid ${({plan:'fa-route',create:'fa-circle-plus',review:'fa-chart-column',recommend:'fa-lightbulb',journal:'fa-heart',schedule:'fa-clock'})[item.id]}`} aria-hidden="true" />{s(...item.title)}</strong><span>{s(...item.description)}</span></button>)}
      </div>
      </div>
      <form className="mb-agent-composer" onSubmit={event => { event.preventDefault(); if (!blocked && !locked) void send(); }}>
        {scenario && <div className="mb-agent-mode"><span>{s(...agentScenarios.find(item => item.id === scenario)!.title)}</span><button type="button" aria-label={s('结束当前任务模式', 'Leave task mode')} disabled={blocked || locked} onClick={leaveScenario}>×</button></div>}
        {image && <div className="mb-agent-attachment"><img src={image} alt={s('待发送图片预览', 'Image ready to send')} /><span /><button type="button" disabled={blocked} onClick={() => setImage(undefined)} aria-label={s('移除图片', 'Remove image')}>✕</button></div>}
        <textarea onPaste={event=>{const file=[...event.clipboardData.items].find(item=>item.type.startsWith('image/'))?.getAsFile();if(file&&!blocked&&!locked){event.preventDefault();void attachImage(file);}}} ref={inputRef} aria-label={s('发送给伙伴的消息', 'Message to Buddy')} value={input} maxLength={1400} rows={2} disabled={blocked || locked} placeholder={s('告诉我你想做什么…', 'Tell me what you would like to do…')} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); if (!blocked && !locked) void send(); } }} />
        <div className="mb-agent-compose-tools"><input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={async event => {
          const file=event.target.files?.[0];event.target.value='';if(file)void attachImage(file);
        }} />
          <button type="button" className="mb-agent-attach-button" disabled={blocked || locked} onClick={() => imageRef.current?.click()}><i className="fa-solid fa-paperclip" aria-hidden="true" />{s('添加图片', 'Attach image')}</button>
          <DictationButton disabled={blocked || locked} active={active} onText={text => setInput(previous => `${previous}${previous.trim() ? ' ' : ''}${text}`.slice(0, 1400))} />
          <span className="mb-agent-input-hint">{s('Enter 发送 · Shift+Enter 换行', 'Enter to send · Shift+Enter for a new line')}</span>
          {busy && requestRef.current ? <button type="button" onClick={() => requestRef.current?.abort()}>{s('停止', 'Stop')}</button> : <button className="mb-agent-primary" type="submit" disabled={blocked || locked || (!input.trim() && !image)}>{s('发送', 'Send')}<i className="fa-solid fa-arrow-up" aria-hidden="true" /></button>}
        </div>
      </form>
      <p className="mb-agent-privacy">{s('以上内容均由 AI 生成，请谨慎参考。', 'The content above is AI-generated. Please use your judgment.')}</p>

    </div>
  </section>{active&&<ProfileSurvey/>}</>;
}
