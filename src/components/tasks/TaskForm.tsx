import { t, label } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useState, useContext, useEffect } from 'react';
import { TaskContext } from '@/contexts/taskContext';
import { Task, TaskPriority } from '@/types';
import { formatDateForInput } from '@/lib/utils';
import { motion } from 'framer-motion';
import { taskConflicts, conflictApproval } from '@/services/productData';
import { enableDesktopNotifications } from '@/services/desktopNotifications';
import { timeRangePatch, taskMinutes } from '@/services/taskSchedule';

interface TaskFormProps {
  onClose: () => void;
  task?: Task;
}

const TaskForm = ({ onClose, task }: TaskFormProps) => {
  const { locale } = useLocale();
  const s = (zh:string,en:string) => locale === 'zh-CN' ? zh : en;
  const { addTask, updateTask, tasks } = useContext(TaskContext);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [timingMode, setTimingMode] = useState<'deadline' | 'range'>(task?.timingMode ?? 'deadline');
  const [startAt, setStartAt] = useState(task?.startAt ? formatDateForInput(task.startAt) : formatDateForInput(new Date()));
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | ''>('');
  const [reminderMinutes, setReminderMinutes] = useState<number>(0);
  const [approved,setApproved] = useState('');
  const candidate = {id:task?.id ?? 'new-draft',timingMode,startAt:timingMode==='range'?new Date(startAt):undefined,dueDate:new Date(dueDate)};
  const conflicts = Number.isFinite(+candidate.dueDate)&&(!candidate.startAt||Number.isFinite(+candidate.startAt))?taskConflicts(candidate,tasks):[];
  const signature=conflicts.map(other=>conflictApproval(candidate,other)).sort().join(';');
  const alreadyApproved=conflicts.every(other=>task?.conflictApprovals?.includes(conflictApproval(candidate,other)));

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Set form data based on task if editing
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDueDate(formatDateForInput(task.dueDate));
      setTimingMode(task.timingMode ?? 'deadline');
      setStartAt(formatDateForInput(task.startAt ?? new Date()));
      setPriority(task.priority);
      
      // Convert total minutes to hours and minutes
      if (task.estimatedDuration) {
        const hours = Math.floor(task.estimatedDuration / 60);
        const minutes = task.estimatedDuration % 60;
        setEstimatedHours(hours);
        setEstimatedMinutes(minutes);
      } else {
        setEstimatedHours('');
        setEstimatedMinutes('');
      }
      
      setReminderMinutes(task.reminders?.length ? Math.max(0,Math.round((+task.dueDate-+task.reminders[0].time)/60000)) : 0);
    } else {
      // Set default due date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDueDate(formatDateForInput(tomorrow));
      
      setEstimatedHours('');
      setEstimatedMinutes('');
    }
  }, [task?.id]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    // Validate form
    if (!title.trim()) {
      alert(t("Please enter a task title"));
      return;
    }
    
    if (!dueDate) {
      alert(t("Please select a due date"));
      return;
    }
    
    let schedule;
    try { schedule = timeRangePatch(timingMode, startAt, dueDate); }
    catch { alert(t('End time must be after start time')); return; }
    if(conflicts.length && approved!==signature && !alreadyApproved){ alert(s('请先确认时间冲突，或调整日程。','Review the overlapping events or adjust the schedule.')); return; }
    setIsSubmitting(true);
    if(reminderMinutes>0){try{if(!await enableDesktopNotifications())throw new Error();}catch{alert(s('未启用 Windows 桌面通知，请授权后重试，或选择不提醒。','Windows notifications are disabled. Enable them or choose no reminder.'));setIsSubmitting(false);return;}}
    
    // Calculate total estimated duration in minutes
    let estimatedDuration: number | undefined;
    if (estimatedHours || estimatedMinutes) {
      const hours = Number(estimatedHours) || 0;
      const minutes = Number(estimatedMinutes) || 0;
      estimatedDuration = hours * 60 + minutes;
    }
    
    // Create task data
    const taskData = {
      title: title.trim(),
      description: description.trim(),
      ...schedule,
      priority,
      estimatedDuration: timingMode === 'range' ? taskMinutes(schedule) ?? undefined : estimatedDuration,
      conflictApprovals: conflicts.map(other=>conflictApproval(candidate,other)),
      reminders: reminderMinutes > 0 ? [{time:new Date(+schedule.dueDate-reminderMinutes*60000),sent:false}] : undefined
    };
    
    try {
      if (task) {
        // Update existing task
        await updateTask(task.id, taskData);
      } else {
        // Add new task
        await addTask(taskData);
      }
      
      // Reset form and close
      setTitle('');
      setDescription('');
      setPriority(TaskPriority.MEDIUM);
      setEstimatedHours('');
      setEstimatedMinutes('');
      setReminderMinutes(0);
      
      setIsSubmitting(false);
      onClose();
    } catch (error) {
      // Show error message if due date is in the past
      if (error instanceof Error && error.message === 'Due date cannot be in the past') {
        alert(t("Due date cannot be in the past. Please select a future date."));
      } else {
        alert(t("An error occurred while saving the task. Please try again."));
      }
      setIsSubmitting(false);
    }
  };
  
  return (
    <motion.form 
      onSubmit={handleSubmit}
      className="space-y-3"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800" style={{ fontSize: '16px' }}>
          {task ? t("Edit Task") : t("Add New Task")}
        </h2>
        <motion.button
          whileHover={{ x: -1, y: -1 }}
          whileTap={{ x: 2, y: 2 }}
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </motion.button>
      </div>
      
      <div className="space-y-2">
        {/* Task title */}
        <div className="space-y-1">
          <label htmlFor="title" className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>{t("Task Title")}{' '}<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
            placeholder={t("What do you need to do?")}
            maxLength={100}
            style={{ fontSize: '12px' }}
          />
          <p className="text-xs text-gray-500 text-right">{title.length}/100</p>
        </div>
        
        {/* Task description */}
        <div className="space-y-1">
          <label htmlFor="description" className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>{t("Description (Optional)")}</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all min-h-[50px]"
            placeholder={t("Add more details...")}
            maxLength={500}
            style={{ fontSize: '11px' }}
          />
          <p className="text-xs text-gray-500 text-right">{description.length}/500</p>
        </div>
        
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium text-gray-700">{t('Task timing')}</legend>
          <div className="flex gap-2">{(['deadline', 'range'] as const).map(value => <button type="button" key={value} aria-pressed={timingMode === value} onClick={() => setTimingMode(value)} className="flex-1 rounded-md border border-black px-2 py-1.5 text-xs font-semibold" style={{ background: timingMode === value ? '#dff8f5' : '#fff' }}>{t(value === 'deadline' ? 'Deadline' : 'Time range')}</button>)}</div>
          {timingMode === 'range' && <label className="block text-xs text-gray-700">{t('Start time')}<input aria-label={t('Start time')} type="datetime-local" required value={startAt} onChange={event => setStartAt(event.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs" /></label>}
        </fieldset>
        {/* Due date and priority */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor="dueDate" className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>{t(timingMode === 'range' ? 'End time' : 'Due Date')}{' '}<span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              id="dueDate"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
              style={{ fontSize: '11px' }}
            />
          </div>
          
          <div className="space-y-1">
            <label htmlFor="priority" className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>{t("Priority")}</label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
              style={{ fontSize: '11px' }}
            >
              <option value={TaskPriority.LOW}>{t("Low")}</option>
              <option value={TaskPriority.MEDIUM}>{t("Medium")}</option>
              <option value={TaskPriority.HIGH}>{t("High")}</option>
              <option value={TaskPriority.URGENT}>{t("Urgent")}</option>
            </select>
          </div>
        </div>
        
        {/* Estimated duration and reminders */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1" style={{ display: timingMode === 'range' ? 'none' : undefined }}>
            <label className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>{t("Duration")}</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  placeholder={t("Hours")}
                  style={{ fontSize: '11px' }}
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  placeholder={t("Minutes")}
                  style={{ fontSize: '11px' }}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <label htmlFor="reminders" className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>{t("Reminders")}</label>
            <div className="flex items-center gap-2"><input id="reminders" type="number" min="0" max="10080" step="1" value={reminderMinutes} onChange={e=>setReminderMinutes(Number(e.target.value))} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg" style={{fontSize:11}}/><span style={{fontSize:11,whiteSpace:'nowrap'}}>{s('分钟前','minutes before')}</span></div><p style={{fontSize:10,color:'#888'}}>{s('0 表示不提醒；截止前提醒，应用需保持运行或在托盘中。','0 disables reminders. Reminds before the deadline while the app is running or in the tray.')}</p>

          </div>
        </div>
      </div>
      
      {conflicts.length>0&&!alreadyApproved&&<div role="alert" style={{background:'#fff4d9',border:'1px solid #dfc472',borderRadius:7,padding:12,fontSize:12}}><strong>{s('⚠ 可能需要同时出席两件事','⚠ These events may need your attention at the same time')}</strong><p>{conflicts.map(t=>t.title).join('、')}</p><label className="flex items-center gap-2"><input type="checkbox" checked={approved===signature} onChange={e=>setApproved(e.target.checked?signature:'')}/>{s('已核对，可以同时安排','I reviewed the overlap and want to keep both')}</label></div>}
      {/* Submit button */}
      <div className="flex gap-2 pt-2">
        <motion.button
          whileHover={{ x: -1, y: -1 }}
          whileTap={{ x: 2, y: 2 }}
          type="submit"
          disabled={isSubmitting}
          style={{
            backgroundColor: '#00CECB',
            color: 'black',
            border: '1px solid #222222',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '2px 2px 0 #222222',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.2s ease',
            width: '100%',
            textAlign: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translate(1px, 1px)';
            e.currentTarget.style.boxShadow = '1px 1px 0 #222222';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translate(0, 0)';
            e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translate(2px, 2px)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translate(1px, 1px)';
            e.currentTarget.style.boxShadow = '1px 1px 0 #222222';
          }}
        >
          {isSubmitting ? t("Saving...") : (task ? t("Update Task") : t("Add Task"))}
        </motion.button>
        
        <motion.button
          whileHover={{ x: -1, y: -1 }}
          whileTap={{ x: 2, y: 2 }}
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          style={{
            backgroundColor: '#f0f0f0',
            color: '#222222',
            border: '1px solid #222222',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '2px 2px 0 #222222',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.2s ease',
            width: '100%',
            textAlign: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translate(1px, 1px)';
            e.currentTarget.style.boxShadow = '1px 1px 0 #222222';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translate(0, 0)';
            e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translate(2px, 2px)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translate(1px, 1px)';
            e.currentTarget.style.boxShadow = '1px 1px 0 #222222';
          }}
        >{t("Cancel")}</motion.button>
      </div>
    </motion.form>
  );
};

export default TaskForm;
