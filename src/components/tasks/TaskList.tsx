import { t, label } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { TaskContext } from '@/contexts/taskContext';
import { TaskStatus, Task } from '@/types';
import { formatDate, getTimeRemaining } from '@/lib/utils';
import TaskCard from './TaskCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Empty } from '../Empty';
import {SavedDailyPlan} from '@/components/agent/SavedAssistantViews';
import ScheduledTasks from '@/components/ScheduledTasks';
import { compareTaskDuration } from '@/services/taskSchedule';

interface TaskListProps {
  onEditTask?: (task: Task) => void;
}

const TaskList = ({ onEditTask }: TaskListProps) => {
  const {locale}=useLocale();
  const { tasks, sortTasks, filterTasks, searchTasks, isLoading, isSaving, loadError, saveError, retryLoad } = useContext(TaskContext);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all' | 'today' | 'daily'>('all');
  const [sortCriteria, setSortCriteria] = useState<'dueDate' | 'priority' | 'createdAt' | 'durationAsc' | 'durationDesc'>('dueDate');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isScrollable, setIsScrollable] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  
  // Update visible tasks when filters, sort criteria, search query, or tasks change
  const visibleTasks = useMemo(() => {
    let filtered = filterTasks(filterStatus==='today'||filterStatus==='daily'?'all':filterStatus);
    let searched = searchTasks(searchQuery);
    
    // Combine filter and search results
    let combined = filtered.filter(task => 
      searched.some(searchedTask => searchedTask.id === task.id)
    );
    
    // Sort the combined results
    // First, separate completed and non-completed tasks
    const completedTasks = combined.filter(task => task.status === 'completed');
    const nonCompletedTasks = combined.filter(task => task.status !== 'completed');
    
    // Sort non-completed tasks based on criteria
    const sortedNonCompleted = [...nonCompletedTasks].sort((a, b) => {
      if (sortCriteria === 'durationAsc' || sortCriteria === 'durationDesc') return compareTaskDuration(a, b, sortCriteria === 'durationAsc' ? 'asc' : 'desc');
      if (sortCriteria === 'dueDate') {
        return a.dueDate.getTime() - b.dueDate.getTime();
      } else if (sortCriteria === 'priority') {
        const priorityOrder = {
          'urgent': 4,
          'high': 3,
          'medium': 2,
          'low': 1
        };
        return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
               (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
      } else if (sortCriteria === 'createdAt') {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      return 0;
    });
    
    // Sort completed tasks by completion date (newest last)
    const sortedCompleted = [...completedTasks].sort((a, b) => {
      if (sortCriteria === 'durationAsc' || sortCriteria === 'durationDesc') return compareTaskDuration(a, b, sortCriteria === 'durationAsc' ? 'asc' : 'desc');
      if (a.completedAt && b.completedAt) {
        return a.completedAt.getTime() - b.completedAt.getTime();
      }
      return 0;
    });
    
    // Combine: non-completed first, then completed
    const sorted = [...sortedNonCompleted, ...sortedCompleted];
    
    return sorted;
  }, [tasks, filterStatus, sortCriteria, searchQuery, filterTasks, searchTasks]);
  
  // Handle scroll events and check if task list is scrollable
  useEffect(() => {
    const handleScroll = () => {
      if (taskListRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = taskListRef.current;
        setScrollTop(scrollTop);
        setIsScrollable(scrollHeight > clientHeight);
        // Check if scrolled to bottom
        setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 10); // -10 for tolerance
      }
    };
    
    const taskListElement = taskListRef.current;
    if (taskListElement) {
      taskListElement.addEventListener('scroll', handleScroll);
      // Initial check
      handleScroll();
    }
    
    return () => {
      if (taskListElement) {
        taskListElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, [visibleTasks]);
  
  // Handle task completion animation
  const handleCompleteAnimationStart = (taskId: string) => {
    setCompletingTaskId(taskId);
    
    // Clear the completing state after animation completes
    setTimeout(() => {
      setCompletingTaskId(null);
    }, 800);
  };
  
  // Task counts for each status
  const taskCounts = {
    all: tasks.length,
    'in-progress': tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
    completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
    overdue: tasks.filter(t => t.status === TaskStatus.OVERDUE).length
  };
  
  return (
    <div className="space-y-3 h-full flex flex-col">
      {(loadError || saveError) && (
        <div role="alert" className="rounded-lg border-2 border-red-600 bg-white p-3 text-sm text-red-800">
          <p>{t(loadError || saveError || "")}</p>
          {loadError && <button type="button" onClick={() => { void retryLoad(); }} className="mt-2 underline">{t("Retry reading tasks")}</button>}
        </div>
      )}
      {(isLoading || isSaving) && <p role="status" aria-live="polite" className="text-xs text-gray-700">
        {isLoading ? t("Loading tasks…") : t("Saving task changes…")}
      </p>}
      {/* Search and filters */}
      <div className="bg-white p-3 rounded-lg border-2 border-black" style={{ boxShadow: '3px 3px 0 #222222' }}>
        <div className="flex flex-col md:flex-row gap-2">
          {/* Search input */}
          <div className="relative flex-1">
            <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              placeholder={t("Search tasks...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid black',
                padding: '6px 10px',
                fontSize: '12px',
                color: 'black',
                width: '100%',
                outline: 'none',
                textAlign: 'center',
                paddingLeft: '36px',
                borderRadius: '6px',
                fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif'
              }}
            />
          </div>
          
          {/* Sort dropdown */}
          <select
            value={sortCriteria}
            onChange={(e) => setSortCriteria(e.target.value as any)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid black',
              padding: '6px 10px',
              fontSize: '12px',
              color: 'black',
              outline: 'none',
              borderRadius: '6px',
              minWidth: '140px',
              fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif'
            }}
          >
            <option value="dueDate" style={{ fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{t("Sort by Due Date")}</option>
            <option value="priority" style={{ fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{t("Sort by Priority")}</option>
            <option value="createdAt" style={{ fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{t("Sort by Creation Date")}</option>
            <option value="durationAsc">{t('Duration: shortest first')}</option>
            <option value="durationDesc">{t('Duration: longest first')}</option>
          </select>
        </div>
        
        {/* Status filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { value: 'all', label: t("All") },
            {value:'today',label:locale==='zh-CN'?'今日计划':'Daily plan'},
            {value:'daily',label:locale==='zh-CN'?'每日任务':'Scheduled tasks'},
            { value: TaskStatus.IN_PROGRESS, label: t("In Progress") },
            { value: TaskStatus.COMPLETED, label: t("Completed") },
            { value: TaskStatus.OVERDUE, label: t("Overdue") }
          ].map((status) => (
            <motion.button
              key={status.value}
              aria-label={status.label}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterStatus(status.value as TaskStatus | 'all' | 'today' | 'daily')}
              style={{
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 'bold',
                transition: 'all 0.2s ease',
                backgroundColor: filterStatus === status.value ? '#FF5E5B' : 'rgba(255, 255, 255, 0.8)',
                color: filterStatus === status.value ? 'white' : '#222222',
                border: '2px solid #222222',
                boxShadow: filterStatus === status.value ? '3px 3px 0 #222222' : 'none',
                fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {status.label} {status.value!=='today'&&status.value!=='daily'&&<span className="ml-1 bg-white text-gray-700 rounded-full px-2 py-0.5 text-xs">{taskCounts[status.value as keyof typeof taskCounts]}</span>}
            </motion.button>
          ))}
        </div>
      </div>
      
      {/* Task list with gradient masks */}
      {filterStatus==='today'?<div className="flex-1 overflow-auto"><SavedDailyPlan/></div>:filterStatus==='daily'?<div className="flex-1 overflow-auto"><ScheduledTasks compact/></div>:visibleTasks.length > 0 ? (
        <div className="flex-1 relative overflow-hidden">
          {/* Task list container */}
          <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-2 pr-1 pb-8 overflow-y-auto h-full scrollbar-hide"
              ref={taskListRef}
              style={{
                scrollbarWidth: 'none', /* Firefox */
                msOverflowStyle: 'none', /* IE and Edge */
              }}
            >
            <AnimatePresence mode="popLayout">
              {visibleTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    scale: completingTaskId === task.id ? 0.9 : 1
                  }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ 
                    layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
                    opacity: { duration: 0.3 },
                    scale: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
                    y: { duration: 0.3 }
                  }}
                  style={{
                    position: 'relative',
                    zIndex: completingTaskId === task.id ? 0 : visibleTasks.length - index
                  }}
                >
                  <TaskCard 
                    task={task} 
                    onEditTask={onEditTask}
                    isCompleting={completingTaskId === task.id}
                    onCompleteAnimationStart={() => handleCompleteAnimationStart(task.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          
          {/* Top gradient mask - only show when scrolled down */}
          {scrollTop > 0 && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '20px',
              background: 'linear-gradient(to bottom, rgba(255,255,255,1), rgba(255,255,255,0))',
              zIndex: 10,
              pointerEvents: 'none'
            }} />
          )}
          
          {/* Bottom gradient mask - only show when list is scrollable and not at bottom */}
          {isScrollable && !isAtBottom && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '30px',
              background: 'linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0))',
              zIndex: 10,
              pointerEvents: 'none'
            }} />
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <Empty />
        </div>
      )}
    </div>
  );
};

export default TaskList;
