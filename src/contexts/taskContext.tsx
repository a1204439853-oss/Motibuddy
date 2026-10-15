import { createContext, useEffect, ReactNode, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types';
import { generateId } from '@/lib/utils';
import { AuthContext } from './authContext';
import { useContext } from 'react';
import { loadTasks, businessRepository } from '@/services/storage';
import type { BusinessData } from '@/services/businessRepository';
import { TaskSession } from '@/services/taskSession';
import { completeBusinessTask, reopenBusinessTask, markBusinessOverdue } from '@/services/businessActions';
import { readSessionStamp } from '@/services/runtimeSession';

interface TaskContextType {
  tasks: Task[];
  addTask: (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'completedAt'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  uncompleteTask: (id: string) => Promise<void>;
  sortTasks: (criteria: 'dueDate' | 'priority' | 'createdAt') => Task[];
  filterTasks: (status: TaskStatus | 'all') => Task[];
  searchTasks: (query: string) => Task[];
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  saveError: string | null;
  retryLoad: () => Promise<void>;
}

export const TaskContext = createContext<TaskContextType>({
  tasks: [],
  addTask: async () => {},
  updateTask: async () => {},
  deleteTask: async () => {},
  completeTask: async () => {},
  uncompleteTask: async () => {},
  sortTasks: () => [],
  filterTasks: () => [],
  searchTasks: () => [],
  isLoading: true,
  isSaving: false,
  loadError: null,
  saveError: null,
  retryLoad: async () => {},
});

interface TaskProviderProps {
  children: ReactNode;
}

export const TaskProvider = ({ children }: TaskProviderProps) => {
  const { currentUser, currentPet, sessionVersion } = useContext(AuthContext);
  const activeSession = useRef<TaskSession | null>(null);
  const session = useMemo(() => {
    const stamp = readSessionStamp(localStorage);
    const next: TaskSession = new TaskSession(currentUser?.id ?? null, {
      load: userId => loadTasks<Task>(userId),
      save: async () => { throw new Error('Task changes require an account transaction.'); },
    }, () => activeSession.current === next && !!stamp && readSessionStamp(localStorage)?.token === stamp.token);
    return next;
  }, [currentUser?.id, sessionVersion]);
  activeSession.current = session;
  const { tasks, status, isSaving, loadError, saveError } = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const isLoading = status === 'loading';
  
  useEffect(() => {
    void session.load();
    return session.deactivate;
  }, [session]);

  useEffect(() => businessRepository.subscribe(snapshot => {
    if (snapshot.userId === session.userId) session.acceptCommitted(snapshot.data.tasks);
  }), [session]);

  const commitBusiness = (change: (data: BusinessData) => BusinessData) => session.commit(async () => {
    if (!session.userId) throw new Error('Sign in before changing tasks.');
    const snapshot = await businessRepository.transact(session.userId, change, session.isCurrent);
    return snapshot.data.tasks;
  }, false);

  const addTask = async (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'completedAt'>) => {
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
    
    await commitBusiness(data => ({ ...data, tasks: [newTask, ...data.tasks] }));
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    if ('id' in updates || 'status' in updates || 'completedAt' in updates || 'createdAt' in updates) throw new Error('Task identity and completion must be changed through their dedicated actions.');
    if (updates.dueDate) {
      const now = new Date();
      if (updates.dueDate < now) {
        throw new Error('Due date cannot be in the past');
      }
    }
    
    await commitBusiness(data => ({ ...data, tasks: data.tasks.map(task =>
        task.id === id ? { ...task, ...updates } : task
      ) }));
  };

  const deleteTask = async (id: string) => {
    await commitBusiness(data => ({ ...data, tasks: data.tasks.filter(task => task.id !== id) }));
  };

  const completeTask = async (id: string) => {
    await commitBusiness(data => completeBusinessTask(data, id, new Date()));
    if (session.isCurrent() && currentPet) localStorage.setItem('pet_show_completed', 'true');
  };

  const uncompleteTask = async (id: string) => {
    await commitBusiness(data => reopenBusinessTask(data, id, new Date()));
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

  // Failed saves leave the committed list unchanged; retries occur on the next interval.
  useEffect(() => {
    if (status !== 'ready' || !currentUser) return;
    const checkOverdue = async () => {
      if (!session.isCurrent() || session.getSnapshot().isSaving) return;
      const now = new Date();
      if (!session.getSnapshot().tasks.some(task => task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.OVERDUE && task.dueDate < now)) return;
      try {
        await commitBusiness(data => markBusinessOverdue(data, now));
        if (session.isCurrent()) localStorage.setItem('task_overdue', 'true');
      } catch {
        if (session.isCurrent()) import('sonner').then(({ toast }) => toast.error('Overdue processing could not finish. Check the task and pet progress before continuing.'));
      }
    };
    void checkOverdue();
    const interval = setInterval(() => { void checkOverdue(); }, 60000);
    return () => clearInterval(interval);
  }, [tasks, currentPet, currentUser, session, status]);

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
      isLoading,
      isSaving,
      loadError,
      saveError,
      retryLoad: session.load,
    }}>
      {children}
    </TaskContext.Provider>
  );
};
