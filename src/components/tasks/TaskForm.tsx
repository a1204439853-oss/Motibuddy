import { useState, useContext, useEffect } from 'react';
import { TaskContext } from '@/contexts/taskContext';
import { Task, TaskPriority } from '@/types';
import { formatDateForInput } from '@/lib/utils';
import { motion } from 'framer-motion';

interface TaskFormProps {
  onClose: () => void;
  task?: Task;
}

const TaskForm = ({ onClose, task }: TaskFormProps) => {
  const { addTask, updateTask } = useContext(TaskContext);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.MEDIUM);
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | ''>('');
  const [reminderCount, setReminderCount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Set form data based on task if editing
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDueDate(formatDateForInput(task.dueDate));
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
      
      setReminderCount(task.reminders ? task.reminders.length : 0);
    } else {
      // Set default due date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDueDate(formatDateForInput(tomorrow));
      
      setEstimatedHours('');
      setEstimatedMinutes('');
    }
  }, [task]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!title.trim()) {
      alert('Please enter a task title');
      return;
    }
    
    if (!dueDate) {
      alert('Please select a due date');
      return;
    }
    
    setIsSubmitting(true);
    
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
      dueDate: new Date(dueDate),
      priority,
      estimatedDuration,
      reminders: reminderCount > 0 ? generateReminders(new Date(dueDate), reminderCount) : undefined
    };
    
    try {
      if (task) {
        // Update existing task
        updateTask(task.id, taskData);
      } else {
        // Add new task
        addTask(taskData);
      }
      
      // Reset form and close
      setTitle('');
      setDescription('');
      setPriority(TaskPriority.MEDIUM);
      setEstimatedHours('');
      setEstimatedMinutes('');
      setReminderCount(0);
      
      setIsSubmitting(false);
      onClose();
    } catch (error) {
      // Show error message if due date is in the past
      if (error instanceof Error && error.message === 'Due date cannot be in the past') {
        alert('Due date cannot be in the past. Please select a future date.');
      } else {
        alert('An error occurred while saving the task. Please try again.');
      }
      setIsSubmitting(false);
    }
  };
  
  // Generate reminder times based on due date and count
  const generateReminders = (dueDate: Date, count: number) => {
    const reminders = [];
    const now = new Date();
    
    // For each reminder, calculate time based on count
    for (let i = 1; i <= count; i++) {
      const reminderTime = new Date(dueDate);
      
      // For 1 reminder: 1 hour before
      // For 2 reminders: 24 hours and 1 hour before
      // For 3 reminders: 48 hours, 24 hours, and 1 hour before
      if (count === 1) {
        reminderTime.setHours(reminderTime.getHours() - 1);
      } else if (count === 2) {
        reminderTime.setHours(reminderTime.getHours() - (i === 1 ? 24 : 1));
      } else if (count >= 3) {
        reminderTime.setHours(reminderTime.getHours() - (i === 1 ? 48 : i === 2 ? 24 : 1));
      }
      
      // Only add reminder if it's in the future
      if (reminderTime > now) {
        reminders.push({
          time: reminderTime,
          sent: false
        });
      }
    }
    
    return reminders;
  };
  
  return (
    <motion.form 
      onSubmit={handleSubmit}
      className="space-y-3"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800" style={{ fontSize: '16px' }}>
          {task ? 'Edit Task' : 'Add New Task'}
        </h2>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </motion.button>
      </div>
      
      <div className="space-y-2">
        {/* Task title */}
        <div className="space-y-1">
          <label htmlFor="title" className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>
            Task Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
            placeholder="What do you need to do?"
            maxLength={100}
            style={{ fontSize: '12px' }}
          />
          <p className="text-xs text-gray-500 text-right">{title.length}/100</p>
        </div>
        
        {/* Task description */}
        <div className="space-y-1">
          <label htmlFor="description" className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>
            Description (Optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all min-h-[50px]"
            placeholder="Add more details..."
            maxLength={500}
            style={{ fontSize: '11px' }}
          />
          <p className="text-xs text-gray-500 text-right">{description.length}/500</p>
        </div>
        
        {/* Due date and priority */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor="dueDate" className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>
              Due Date <span className="text-red-500">*</span>
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
            <label htmlFor="priority" className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
              style={{ fontSize: '11px' }}
            >
              <option value={TaskPriority.LOW}>Low</option>
              <option value={TaskPriority.MEDIUM}>Medium</option>
              <option value={TaskPriority.HIGH}>High</option>
              <option value={TaskPriority.URGENT}>Urgent</option>
            </select>
          </div>
        </div>
        
        {/* Estimated duration and reminders */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>
              Duration
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                  placeholder="Hours"
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
                  placeholder="Minutes"
                  style={{ fontSize: '11px' }}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <label htmlFor="reminders" className="block font-medium text-gray-700" style={{ fontSize: '12px' }}>
              Reminders
            </label>
            <select
              id="reminders"
              value={reminderCount}
              onChange={(e) => setReminderCount(parseInt(e.target.value))}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
              style={{ fontSize: '11px' }}
            >
              <option value={0}>None</option>
              <option value={1}>1 hour before</option>
              <option value={2}>24h & 1h before</option>
              <option value={3}>48h, 24h & 1h before</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Submit button */}
      <div className="flex gap-2 pt-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
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
          {isSubmitting ? 'Saving...' : (task ? 'Update Task' : 'Add Task')}
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={onClose}
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
        >
          Cancel
        </motion.button>
      </div>
    </motion.form>
  );
};

export default TaskForm;
