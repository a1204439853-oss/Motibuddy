import { t, label } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useContext, useState } from 'react';
import { TaskContext } from '@/contexts/taskContext';
import { Task } from '@/types';
import { formatDate, getTimeRemaining } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface TaskCardProps {
  task: Task;
  onEditTask?: (task: Task) => void;
  isCompleting?: boolean;
  onCompleteAnimationStart?: () => void;
}

const TaskCard = ({ task, onEditTask, isCompleting = false, onCompleteAnimationStart }: TaskCardProps) => {
  useLocale();
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
    <motion.div
      aria-busy={isPending}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: isCompleting ? 0.7 : 1, 
        y: 0,
        scale: isCompleting ? 0.9 : 1,
        zIndex: isCompleting ? 0 : 1
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ 
        layout: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
        opacity: { duration: 0.3 },
        scale: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
        y: { duration: 0.3 }
      }}
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
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleToggleComplete}
              disabled={isPending}
              className="mt-0.5 flex-shrink-0"
            >
              {task.status === 'completed' ? (
                <i className="fa-solid fa-check-circle text-green-500 text-lg"></i>
              ) : (
                <i className="fa-regular fa-circle text-gray-400 text-lg"></i>
              )}
            </motion.button>
            
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
                <p style={{
                  fontSize: '11px',
                  color: task.status === 'completed' ? '#808080' : '#222222',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                  margin: '4px 0'
                }}>
                  {task.description}
                </p>
              )}
              
              <div className="flex flex-wrap gap-1.5 mt-2">
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
                  {formatDate(task.dueDate)}
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
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <i className="fa-solid fa-ellipsis-vertical text-gray-500 text-base"></i>
          </motion.button>
          
          {isMenuOpen && (
            <motion.div
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
    </motion.div>
  );
};

export default TaskCard;
