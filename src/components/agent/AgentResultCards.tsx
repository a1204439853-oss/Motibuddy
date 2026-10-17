import { label } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import type { Task } from '@/types';
import type { AgentDraft, AgentResult } from '@/services/agentContracts';
import { duplicateTaskKey } from '@/services/agentActions';
import { useState } from 'react';
import { draftIssues } from '@/services/agentDraftReview';
import { planTimeline } from '@/services/planTimeline';
import { taskConflicts } from '@/services/productData';

function localDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
}
export default function AgentResultCards({ result, tasks, budget, selected, blocked, locked, dirty, stale, onSelect, onSelectAll, onEdit, onSaveDraft, onSaveResult }: {
  result: AgentResult; tasks: Task[]; budget: number; selected: number[];
  blocked: boolean; locked: boolean; dirty: boolean; stale: boolean;
  onSelectAll:(indices:number[])=>void;
  onSelect: (index: number, checked: boolean) => void; onEdit: (index: number, patch: Partial<AgentDraft>) => void;
  onSaveDraft: () => void; onSaveResult: (confirmed?: boolean) => void;
}) {
  const { locale } = useLocale();
  const [editing, setEditing] = useState<number[]>([]);
  const [approved,setApproved]=useState('');
  const issueMap = result.mode === 'create' ? result.drafts.map(draft => draftIssues(draft, tasks)) : [];
  const selectedKeys = result.mode === 'create' ? result.drafts.filter((_, index) => selected.includes(index)).map(draft => draft.dueDate ? duplicateTaskKey(draft.title, draft.dueDate) : '') : [];
  const repeatedSelection = new Set(selectedKeys).size !== selectedKeys.length;
  const s = (zh: string, en: string) => locale === 'zh-CN' ? zh : en;
  const proposals: Task[] = result.mode==='create'?result.drafts.flatMap((draft,index)=>draft.dueDate&&selected.includes(index)?[{...draft,id:`proposal-${index}`,dueDate:new Date(draft.dueDate),startAt:draft.startAt?new Date(draft.startAt):undefined,status:'pending',createdAt:new Date(0),estimatedDuration:draft.estimatedDuration??undefined} as Task]:[]):[];
  const overlaps=proposals.flatMap(task=>taskConflicts(task,[...tasks,...proposals]).map(other=>`${task.title} ↔ ${other.title}`));
  const conflictSignature=JSON.stringify([proposals,tasks.filter(task=>task.status!=='completed').map(task=>[task.id,task.startAt,task.dueDate])]);
  if (result.mode === 'chat') return null;
  return <div className="mb-agent-result">
    {result.mode === 'plan' ? <>
      <p className="mb-agent-muted">{s(`建议安排 ${result.items.reduce((sum, item) => sum + item.minutes, 0)} / ${budget} 分钟，耗时为估计。`, `${result.items.reduce((sum, item) => sum + item.minutes, 0)} / ${budget} minutes planned. Durations are estimates.`)}</p>
      <div className="mb-agent-plan-timeline">{planTimeline(result,tasks).map(({item,task,start,end,fixed,outsideToday,missesDeadline},index)=><div className="mb-agent-plan-slot" key={item.taskId}><time>{start.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',hour12:false})} – {end.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit',hour12:false})} · {fixed?s('固定日程','Fixed event'):s('建议时段','Suggested time')}</time><article className="mb-agent-card"><h4>{index+1}. {task?.title??s('任务已变化','Task changed')}<span>{item.minutes} {s('分钟','min')}</span></h4><p>{item.reason}</p><p><strong>{s('先做一小步：','One small step: ')}</strong>{item.firstStep}</p>{outsideToday&&<p className="mb-agent-note">{s('此安排不在今天剩余时间内，可移至之后再做。','This falls outside the rest of today. Consider a later day.')}</p>}{missesDeadline&&<p className="mb-agent-note">{s('此时段晚于截止，请调整任务或重新安排。','This slot misses the deadline. Adjust or replan.')}</p>}</article></div>)}</div>
      {stale && <p className="mb-agent-error">{s('任务已变化，请重新生成计划后再保存。', 'Tasks changed. Regenerate before saving.')}</p>}
    </> : <>
      <p className="mb-agent-muted">{s('已整理待确认任务，可点击“修改”调整。确认后直接同步到任务栏。', 'Review the proposed tasks. Choose Edit to adjust details, then confirm to add them to Tasks.')}</p>
      <button type="button" className="mb-agent-select-all" disabled={blocked||locked} onClick={()=>{const valid=issueMap.flatMap((issues,index)=>issues.length?[]:[index]);const all=valid.every(index=>selected.includes(index));onSelectAll(all?[]:valid);}}>{issueMap.every((issues,index)=>issues.length||selected.includes(index))?s('取消全选','Deselect all'):s('一键全选','Select all')}</button>
      {result.drafts.map((draft, index) => {
        const duplicate = draft.dueDate && tasks.some(task => duplicateTaskKey(task.title, task.dueDate.toISOString()) === duplicateTaskKey(draft.title, draft.dueDate!));
        return <article className="mb-agent-card" key={index}>
          <label className="mb-agent-check"><input type="checkbox" aria-label={s(`录入第 ${index + 1} 项`, `Import draft ${index + 1}`)} checked={selected.includes(index)} disabled={blocked || locked} onChange={event => onSelect(index, event.target.checked)} /><strong>{s(`任务 ${index + 1}`, `Task ${index + 1}`)}</strong></label>
          <h4>{draft.title}</h4><p>{draft.description}</p>
          <p>{draft.timingMode === 'range' ? `${localDate(draft.startAt ?? null).replace('T', ' ')} → ` : ''}{localDate(draft.dueDate).replace('T', ' ') || s('待补充时间', 'Time needed')} · {label(draft.priority)}{draft.estimatedDuration ? ` · ${draft.estimatedDuration} ${s('分钟', 'min')}` : ''}</p>
          <button type="button" className="mb-agent-edit-toggle" aria-expanded={editing.includes(index)} disabled={blocked || locked} onClick={() => setEditing(values => values.includes(index) ? values.filter(value => value !== index) : [...values, index])}>{editing.includes(index) ? s('收起修改', 'Close editor') : s('修改', 'Edit')}</button>
          {editing.includes(index) && <div className="mb-agent-draft-editor">
          <label>{s('标题', 'Title')}<input value={draft.title} maxLength={200} disabled={blocked || locked} onChange={event => onEdit(index, { title: event.target.value })} /></label>
          <label>{s('说明', 'Description')}<textarea value={draft.description} maxLength={2000} rows={2} disabled={blocked || locked} onChange={event => onEdit(index, { description: event.target.value })} /></label>
          <label>{s('时间类型', 'Task timing')}<select value={draft.timingMode ?? 'deadline'} disabled={blocked || locked} onChange={event => onEdit(index, { timingMode: event.target.value as 'deadline' | 'range', startAt: event.target.value === 'range' ? draft.dueDate ? new Date(new Date(draft.dueDate).getTime() - 30 * 60000).toISOString() : new Date().toISOString() : null })}><option value="deadline">{s('截止时间', 'Deadline')}</option><option value="range">{s('时间段', 'Time range')}</option></select></label>
          {draft.timingMode === 'range' && <label>{s('开始时间', 'Start time')}<input type="datetime-local" value={localDate(draft.startAt ?? null)} disabled={blocked || locked} onChange={event => onEdit(index, { startAt: event.target.value && Number.isFinite(new Date(event.target.value).getTime()) ? new Date(event.target.value).toISOString() : null })} /></label>}
          <div className="mb-agent-fields"><label>{draft.timingMode === 'range' ? s('结束时间', 'End time') : s('截止时间', 'Due date')}<input type="datetime-local" value={localDate(draft.dueDate)} disabled={blocked || locked} onChange={event => onEdit(index, { dueDate: event.target.value && Number.isFinite(new Date(event.target.value).getTime()) ? new Date(event.target.value).toISOString() : null })} /></label>
            <label>{s('优先级', 'Priority')}<select value={draft.priority} disabled={blocked || locked} onChange={event => onEdit(index, { priority: event.target.value as AgentDraft['priority'] })}>{['low', 'medium', 'high', 'urgent'].map(value => <option value={value} key={value}>{label(value)}</option>)}</select></label>
            {draft.timingMode !== 'range' && <label>{s('预计分钟', 'Est. minutes')}<input type="number" min="1" max="1440" value={draft.estimatedDuration ?? ''} disabled={blocked || locked} onChange={event => onEdit(index, { estimatedDuration: event.target.value ? Number(event.target.value) : null })} /></label>}</div>
          </div>}
          {draft.timingMode === 'range' && (!draft.startAt || !draft.dueDate || new Date(draft.startAt) >= new Date(draft.dueDate)) && <p className="mb-agent-error">{s('结束时间必须晚于开始时间。', 'End time must be after start time.')}</p>}
          {duplicate && <p className="mb-agent-error">{s('已有相同标题和截止时间的任务，请调整或取消勾选。', 'A task has the same title and due time. Edit or deselect this draft.')}</p>}
          {issueMap[index].includes('date') && <p className="mb-agent-note">{s('请检查时间格式，修改后可直接勾选。', 'Check the time format, then select the task.')}</p>}
          {issueMap[index].includes('duration') && <p className="mb-agent-error">{s('预计耗时需为 1–1440 的整数分钟。', 'Estimated duration must be 1–1440 whole minutes.')}</p>}
        </article>;
      })}
    </>}
    {!!overlaps.length&&!locked&&<div className="mb-agent-note" role="alert"><strong>{s('⚠ 时间段可能冲突','⚠ Overlapping events')}</strong><p>{[...new Set(overlaps)].join('；')}</p><label className="mb-agent-check"><input type="checkbox" checked={approved===conflictSignature} onChange={e=>setApproved(e.target.checked?conflictSignature:'')}/>{s('已核对，保留这些安排','I reviewed the overlap and want to keep these events')}</label></div>}
    {locked && <p className="mb-agent-note">{s('上次导入尚未确认成功，请重试同一批次。', 'The import was not confirmed. Retry the same batch.')}</p>}
    {repeatedSelection && <p className="mb-agent-error">{s('已勾选的草稿有相同标题和时间，请修改或取消重复项。', 'Selected drafts share a title and time. Edit or deselect duplicates.')}</p>}
    <div className="mb-agent-actions"><button aria-label={s('保存草稿', 'Save draft')} disabled={blocked || locked || !dirty} onClick={onSaveDraft}>{s('保存草稿', 'Save draft')}{dirty ? ' *' : ''}</button>
      <button className="mb-agent-primary" disabled={blocked || stale || (!locked&&!!overlaps.length&&approved!==conflictSignature) || (result.mode === 'create' ? !locked && (!selected.length || repeatedSelection || selected.some(index => issueMap[index]?.length)) : !result.items.length)} onClick={()=>onSaveResult(!overlaps.length||approved===conflictSignature)}>{result.mode === 'plan' ? s('保存今日计划', 'Save daily plan') : locked ? s('重试本批次', 'Retry this batch') : s(`确认录入 ${selected.length} 项`, `Import ${selected.length} selected`)}</button></div>
  </div>;
}
