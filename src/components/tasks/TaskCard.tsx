import { t, label } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useContext, useState } from 'react';
import { TaskContext } from '@/contexts/taskContext';
import { Task } from '@/types';
import { formatDate, getTimeRemaining } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { taskMinutes } from '@/services/taskSchedule';

interface TaskCardProps {
  task: Task;
  onEditTask?: (task: Task) => void;
  isCompleting?: boolean;
  onCompleteAnimationStart?: () => void;
}

const TaskCard = ({ task, onEditTask, isCompleting = false, onCompleteAnimationStart }: TaskCardProps) => {
  const { locale } = useLocale();
  const { completeTask, uncompleteTask, updateTask, deleteTask } = useContext(TaskContext);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isPending, setIsPending] = useState(false);
  
  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };
  
  // Handle complete/uncomplete task
  const handleToggleComplete = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      if (task.status === 'completed') await uncompleteTask(task.id);
      else {
        await completeTask(task.id);
        onCompleteAnimationStart?.();
      }
    } catch (error) {
      toast.error(error instanceof Error ? t(error.message) : t("Task changes were not saved. Please retry."));
    } finally { setIsPending(false); }
  };
  
  // Handle delete task
  const handleDeleteTask = async () => {
    if (isPending) return;
    const isCompleted = task.status === 'completed';
    const message = isCompleted 
      ? t("This task has been completed. Are you sure you want to delete it?")
      : t("Are you sure you want to delete this task?");
    
    if (window.confirm(message)) {
      setIsPending(true);
      try {
        await deleteTask(task.id);
        toast.success(t("Task deleted successfully"));
      } catch {
        toast.error(t("Task was not deleted. Please retry."));
      } finally { setIsPending(false); }
    }
  };

  return (
    <article
      className={`neo-task-card${isCompleting ? ' is-completing' : ''}`}
      data-status={task.status}
      aria-busy={isPending}
      style={{
        backgroundColor: 'white',
        padding: '12px',
        borderRadius: '8px',
        border: '2px solid #222222',
        boxShadow: '3px 3px 0 #222222',
        opacity: task.status === 'completed' ? 0.7 : 1,
        borderLeft: task.status === 'completed' ? '4px solid #00CECB' : '4px solid #FF5E5B',
        position: 'relative'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsMenuOpen(false);
      }}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {/* Task title and status */}
          <div className="flex items-start gap-2">
            <button
              type="button"
              aria-label={`${task.status === 'completed' ? (locale === 'zh-CN' ? '重新打开任务' : 'Reopen task') : (locale === 'zh-CN' ? '完成任务' : 'Complete task')}：${task.title}`}
              aria-pressed={task.status === 'completed'}
              onClick={handleToggleComplete}
              disabled={isPending}
              className="neo-task-toggle"
            >
              {task.status === 'completed' ? (
                <i className="fa-solid fa-check" aria-hidden="true"></i>
              ) : null}
            </button>
            
            <div className="flex-1">
              <h3 style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: task.status === 'completed' ? '#808080' : '#222222',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                margin: '0 0 6px 0'
              }}>
                {task.title}
              </h3>
              
              {task.description && (
                <div className="neo-task-description-wrap">
                <p className="neo-task-description" style={{
                  fontSize: '11px',
                  color: task.status === 'completed' ? '#808080' : '#222222',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                  margin: '4px 0'
                }}>
                  {task.description}
                </p>
                </div>
              )}
              
              <div className="neo-task-meta flex flex-wrap gap-1.5 mt-2">
                {/* Priority badge */}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                  {label(task.priority)}
                </span>
                
                {/* Status badge */}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
                  {label(task.status)}
                </span>
                
                {/* Due date badge */}
                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 border border-gray-300 rounded-full text-xs font-medium">
                  {task.timingMode === 'range' && task.startAt ? `${formatDate(task.startAt)} → ${formatDate(task.dueDate)}` : formatDate(task.dueDate)}
                  {taskMinutes(task) !== null && <span className="ml-2 text-gray-500">· {Math.round(taskMinutes(task)!)} {t('min')}</span>}
                </span>
                
                {/* Time remaining badge */}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  task.status === 'completed' 
                    ? 'bg-gray-100 text-gray-800 border border-gray-300' 
                    : task.status === 'overdue'
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}>
                  {getTimeRemaining(task.dueDate)}
                </span>
                
                {/* Reminders badge */}
                {task.reminders && task.reminders.length > 0 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-800 border border-gray-300 rounded-full text-xs font-medium">
                    <i className="fa-solid fa-bell mr-1"></i>
                    {task.reminders.length}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions menu */}
        <div className="relative ml-2" style={{ position: 'relative', zIndex: 1000, overflow: 'visible' }}>
          <motion.button
            aria-label={locale === 'zh-CN' ? `任务操作：${task.title}` : `Task actions: ${task.title}`}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <i className="fa-solid fa-ellipsis-vertical text-gray-500 text-base"></i>
          </motion.button>
          
          {isMenuOpen && (
            <motion.div
              className="neo-task-menu"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '4px',
                width: '140px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '3px 3px 0 #222222',
                border: '2px solid #222222',
                zIndex: 10000,
                overflow: 'visible',
                transform: 'translateX(0)',
                marginRight: '-8px'
              }}
            >
              <button
                disabled={isPending}
                onClick={() => {
                  if (onEditTask) {
                    onEditTask(task);
                  }
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-orange-50 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-pen-to-square text-sm"></i>
                <span>{t("Edit")}</span>
              </button>
              
              <button
                disabled={isPending}
                onClick={() => {
                  void handleDeleteTask();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-trash-can text-sm"></i>
                <span>{t("Delete")}</span>
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </article>
  );
};

export default TaskCard;
