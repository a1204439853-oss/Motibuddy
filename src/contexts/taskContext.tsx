import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Task, TaskStatus, TaskPriority, AchievementType, Achievement } from '@/types';
import { generateId } from '@/lib/utils';
import { AuthContext } from './authContext';
import { PetContext } from './petContext';
import { useContext } from 'react';
import { loadTasks, saveTasks } from '@/services/storage';
import { invoke } from '@tauri-apps/api/tauri';
import { isTauri } from '@/services/tauriCommands';

interface TaskContextType {
  tasks: Task[];
  addTask: (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'completedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  uncompleteTask: (id: string) => void;
  sortTasks: (criteria: 'dueDate' | 'priority' | 'createdAt') => Task[];
  filterTasks: (status: TaskStatus | 'all') => Task[];
  searchTasks: (query: string) => Task[];
  isLoading: boolean;
}

export const TaskContext = createContext<TaskContextType>({
  tasks: [],
  addTask: () => {},
  updateTask: () => {},
  deleteTask: () => {},
  completeTask: () => {},
  uncompleteTask: () => {},
  sortTasks: () => [],
  filterTasks: () => [],
  searchTasks: () => [],
  isLoading: true,
});

interface TaskProviderProps {
  children: ReactNode;
}

export const TaskProvider = ({ children }: TaskProviderProps) => {
  const { currentUser, updateUserProfile, currentPet, setCurrentPet } = useContext(AuthContext);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State to store original pet stats when tasks are completed
  const [taskCompletionStats, setTaskCompletionStats] = useState<Map<string, {
    health: number;
    happiness: number;
    hunger: number;
    energy: number;
    experience: number;
  }>>(new Map());

  // Load tasks from local file system on mount and when user changes
  useEffect(() => {
    const loadTasksData = async () => {
      try {
        // Clear tasks first to prevent showing previous user's data
        setTasks([]);
        setIsLoading(true);
        
        const savedTasks = await loadTasks<Task>();
        if (savedTasks && savedTasks.length > 0) {
          setTasks(savedTasks);
        } else if (!currentUser) {
          // 未登录状态下不显示任何任务
          setTasks([]);
        } else {
          // New user, start with template tasks
          const templateTasks: Task[] = [
            {
              id: generateId(),
              title: 'Complete project documentation',
              description: 'Finish writing the project documentation and submit it for review',
              dueDate: new Date(Date.now() + 86400000),
              priority: TaskPriority.HIGH,
              status: TaskStatus.IN_PROGRESS,
              createdAt: new Date(),
              reminders: [
                {
                  time: new Date(Date.now() + 3600000),
                  sent: false
                }
              ]
            },
            {
              id: generateId(),
              title: 'Buy groceries',
              description: 'Buy milk, eggs, bread, and vegetables for the week',
              dueDate: new Date(Date.now() + 172800000),
              priority: TaskPriority.MEDIUM,
              status: TaskStatus.IN_PROGRESS,
              createdAt: new Date()
            },
            {
              id: generateId(),
              title: 'Call dentist',
              description: 'Schedule a dental appointment for next month',
              dueDate: new Date(Date.now() + 43200000),
              priority: TaskPriority.LOW,
              status: TaskStatus.IN_PROGRESS,
              createdAt: new Date()
            },
            {
              id: generateId(),
              title: 'Morning workout',
              description: 'Go for a 30-minute run or gym session',
              dueDate: new Date(Date.now() + 86400000),
              priority: TaskPriority.MEDIUM,
              status: TaskStatus.IN_PROGRESS,
              createdAt: new Date()
            }
          ];
          setTasks(templateTasks);
          // Save template tasks for the new user
          saveTasks(templateTasks).catch(error => {
            console.error('Error saving template tasks:', error);
          });
        }
      } catch (error) {
        console.error('Error loading tasks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTasksData();
  }, [currentUser?.id]); // Reload when user ID changes

  // Save tasks to local file system whenever they change
  useEffect(() => {
    if (!isLoading) {
      saveTasks(tasks).catch(error => {
        console.error('Error saving tasks:', error);
      });
      
      // Prepare widget data
      const widgetData = {
        user_id: currentUser?.id || null,
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          due_date: t.dueDate.toISOString(),
          priority: t.priority,
          status: t.status
        })),
        pet: currentPet ? {
          name: currentPet.name,
          pet_type: currentPet.type,
          level: currentPet.level,
          health: currentPet.health,
          happiness: currentPet.happiness,
          hunger: currentPet.hunger,
          energy: currentPet.energy
        } : null,
        timestamp: Date.now()
      };
      
      // Save to localStorage for widget to read
      localStorage.setItem('widget_data', JSON.stringify(widgetData));
      console.log('Widget data saved to localStorage');
      
      // Sync to Rust backend for widget - save to file
      console.log('Checking isTauri:', isTauri());
      if (isTauri()) {
        console.log('Tauri detected, syncing to widget...');
        const syncToWidget = async () => {
          try {
            console.log('Calling save_widget_data with', tasks.length, 'tasks');
            await invoke('save_widget_data', {
              userId: currentUser?.id || null,
              tasks: widgetData.tasks,
              pet: widgetData.pet
            });
            console.log('save_widget_data called successfully');
          } catch (error) {
            console.error('Error syncing to widget:', error);
          }
        };
        syncToWidget();
      } else {
        console.log('Not in Tauri environment, skipping widget sync');
      }
    }
  }, [tasks, isLoading, currentUser?.id, currentPet]);
  
  // Periodic sync to ensure widget always has latest data
  useEffect(() => {
    if (!isTauri() || !currentUser?.id) return;
    
    const intervalId = setInterval(() => {
      console.log('Periodic sync to widget...');
      const syncToWidget = async () => {
        try {
          await invoke('save_widget_data', {
            userId: currentUser?.id || null,
            tasks: tasks.map(t => ({
              id: t.id,
              title: t.title,
              due_date: t.dueDate.toISOString(),
              priority: t.priority,
              status: t.status
            })),
            pet: currentPet ? {
              name: currentPet.name,
              pet_type: currentPet.type,
              level: currentPet.level,
              health: currentPet.health,
              happiness: currentPet.happiness,
              hunger: currentPet.hunger,
              energy: currentPet.energy
            } : null
          });
          console.log('Periodic sync completed');
        } catch (error) {
          console.error('Periodic sync failed:', error);
        }
      };
      syncToWidget();
    }, 5000); // Sync every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [currentUser?.id, tasks, currentPet]);

  const addTask = (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'completedAt'>) => {
    const now = new Date();
    if (taskData.dueDate < now) {
      throw new Error('Due date cannot be in the past');
    }
    
    const newTask: Task = {
      ...taskData,
      id: generateId(),
      status: TaskStatus.IN_PROGRESS,
      createdAt: new Date()
    };
    
    setTasks(prevTasks => [newTask, ...prevTasks]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    if (updates.dueDate) {
      const now = new Date();
      if (updates.dueDate < now) {
        throw new Error('Due date cannot be in the past');
      }
    }
    
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === id ? { ...task, ...updates } : task
      )
    );
  };

  const deleteTask = (id: string) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== id));
  };

  const completeTask = (id: string) => {
    // Find the task being completed
    const taskToComplete = tasks.find(t => t.id === id);
    if (!taskToComplete || taskToComplete.status === TaskStatus.COMPLETED) return;
    
    // Create updated task
    const completedTask = { 
      ...taskToComplete, 
      status: TaskStatus.COMPLETED, 
      completedAt: new Date() 
    };
    
    // Remove from current position and add to end
    const otherTasks = tasks.filter(t => t.id !== id);
    const updatedTasks = [...otherTasks, completedTask];
    
    setTasks(updatedTasks);

    const task = tasks.find(t => t.id === id);
    if (task && task.status !== TaskStatus.COMPLETED && currentPet) {
      const originalStats = {
        health: currentPet.health,
        happiness: currentPet.happiness,
        hunger: currentPet.hunger,
        energy: currentPet.energy,
        experience: currentPet.experience
      };
      
      setTaskCompletionStats(prev => {
        const newMap = new Map(prev);
        newMap.set(id, originalStats);
        return newMap;
      });
      
      const now = new Date();
      let updatedPet = {
        ...currentPet,
        health: Math.min(100, currentPet.health + 10),
        happiness: Math.min(100, currentPet.happiness + 20),
        hunger: Math.max(0, currentPet.hunger - 5),
        energy: Math.max(0, currentPet.energy - 10),
        experience: currentPet.experience + 10,
        lastInteraction: now
      };
      
      const expNeededForLevel = currentPet.level * 50;
      if (updatedPet.experience >= expNeededForLevel) {
        updatedPet = {
          ...updatedPet,
          level: updatedPet.level + 1,
          experience: 0,
          health: 80,
          happiness: 70,
          energy: 90
        };
      }
      
      setCurrentPet(updatedPet);
      localStorage.setItem('pet_show_completed', 'true');
    }

    if (currentUser) {
      const completedTasks = updatedTasks.filter(task => task.status === TaskStatus.COMPLETED).length;
      
      // Check if this is the first task completed by this user (not counting mock tasks)
      const hasFirstStep = currentUser.achievements?.some(achievement => 
        achievement.type === AchievementType.FIRST_TASK
      ) || false;
      
      if (!hasFirstStep && completedTasks >= 1) {
        const newAchievement: Achievement = {
          id: '8',
          type: AchievementType.FIRST_TASK,
          name: 'First Step',
          description: 'Complete your first task',
          unlockedAt: new Date(),
          icon: 'fa-solid fa-flag-checkered'
        };
        
        const updatedAchievements = [...(currentUser.achievements || []), newAchievement];
        updateUserProfile({ achievements: updatedAchievements });
        
        // Show toast notification
        import('sonner').then(({ toast }) => {
          toast.success('🏆 Achievement Unlocked: First Step!', {
            duration: 5000,
            icon: '🎉'
          });
        });
      }
    }
  };

  const uncompleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task && task.status === TaskStatus.COMPLETED && currentPet) {
      const originalStats = taskCompletionStats.get(id);
      
      const now = new Date();
      let updatedPet;
      
      if (originalStats) {
        updatedPet = {
          ...currentPet,
          health: originalStats.health,
          happiness: originalStats.happiness,
          hunger: originalStats.hunger,
          energy: originalStats.energy,
          experience: originalStats.experience,
          lastInteraction: now
        };
        
        setTaskCompletionStats(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      } else {
        updatedPet = {
          ...currentPet,
          health: Math.max(0, currentPet.health - 10),
          happiness: Math.max(0, currentPet.happiness - 20),
          hunger: Math.min(100, currentPet.hunger + 5),
          energy: Math.min(100, currentPet.energy + 10),
          experience: Math.max(0, currentPet.experience - 10),
          lastInteraction: now
        };
      }
      
      setCurrentPet(updatedPet);
    }
    
    updateTask(id, { 
      status: TaskStatus.IN_PROGRESS, 
      completedAt: undefined 
    });
  };

  const sortTasks = useCallback((criteria: 'dueDate' | 'priority' | 'createdAt') => {
    return [...tasks].sort((a, b) => {
      if (criteria === 'dueDate') {
        return a.dueDate.getTime() - b.dueDate.getTime();
      } else if (criteria === 'priority') {
        const priorityOrder = {
          [TaskPriority.URGENT]: 4,
          [TaskPriority.HIGH]: 3,
          [TaskPriority.MEDIUM]: 2,
          [TaskPriority.LOW]: 1
        };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      } else if (criteria === 'createdAt') {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      return 0;
    });
  }, [tasks]);

  const filterTasks = useCallback((status: TaskStatus | 'all') => {
    if (status === 'all') {
      return tasks;
    }
    return tasks.filter(task => task.status === status);
  }, [tasks]);

  const searchTasks = useCallback((query: string) => {
    if (!query.trim()) {
      return tasks;
    }
    
    const lowerCaseQuery = query.toLowerCase();
    return tasks.filter(task => 
      task.title.toLowerCase().includes(lowerCaseQuery) || 
      (task.description && task.description.toLowerCase().includes(lowerCaseQuery))
    );
  }, [tasks]);

  // Auto-update overdue tasks
  useEffect(() => {
    const checkOverdue = () => {
      const now = new Date();
      let tasksToUpdate = tasks;
      let shouldUpdatePet = false;
      
      const updatedTasks = tasks.map(task => {
        if (task.status !== TaskStatus.COMPLETED && task.dueDate < now && task.status !== TaskStatus.OVERDUE) {
          shouldUpdatePet = true;
          return { ...task, status: TaskStatus.OVERDUE };
        }
        return task;
      });
      
      if (shouldUpdatePet && currentPet) {
        const updatedPet = {
          ...currentPet,
          health: Math.max(0, currentPet.health - 20),
          happiness: Math.max(0, currentPet.happiness - 20),
          experience: Math.max(0, currentPet.experience - 10),
          lastInteraction: now
        };
        
        setCurrentPet(updatedPet);
        localStorage.setItem('task_overdue', 'true');
      }
      
      if (JSON.stringify(updatedTasks) !== JSON.stringify(tasksToUpdate)) {
        setTasks(updatedTasks);
      }
    };

    checkOverdue();
    const interval = setInterval(checkOverdue, 60000);
    
    return () => clearInterval(interval);
  }, [tasks, currentPet, currentUser]);

  return (
    <TaskContext.Provider value={{
      tasks,
      addTask,
      updateTask,
      deleteTask,
      completeTask,
      uncompleteTask,
      sortTasks,
      filterTasks,
      searchTasks,
      isLoading
    }}>
      {children}
    </TaskContext.Provider>
  );
};
