import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Statistics, TaskStatus, TaskPriority, Task } from '@/types';
import { AuthContext } from './authContext';
import { TaskContext } from './taskContext';
import { useContext } from 'react';
import { FocusContext, focusTotals } from './focusContext';

interface StatisticsContextType {
  statistics: Statistics;
  updateStatistics: () => void;
  exportStatistics: () => void;
  getTasksCompletedThisWeek: () => { date: string; completedTasks: number }[];
  getTasksByPriority: () => { name: string; value: number }[];
  getTasksByStatus: () => { name: string; value: number }[];
}

export const StatisticsContext = createContext<StatisticsContextType>({
  statistics: {
    userId: '',
    totalTasks: 0,
    completedTasks: 0,
    averageCompletionTime: 0,
    streakDays: 0,
    taskCompletionRate: 0,
    performanceOverTime: [],
    categoryDistribution: []
  },
  updateStatistics: () => {},
  exportStatistics: () => {},
  getTasksCompletedThisWeek: () => [],
  getTasksByPriority: () => [],
  getTasksByStatus: () => [],
});

interface StatisticsProviderProps {
  children: ReactNode;
}

export const StatisticsProvider = ({ children }: StatisticsProviderProps) => {
  const focus = useContext(FocusContext);
  const { currentUser } = useContext(AuthContext);
  const { tasks } = useContext(TaskContext);
  const [statistics, setStatistics] = useState<Statistics>(() => {
    // Load statistics from localStorage if available
    if (currentUser) {
      const savedStats = localStorage.getItem(`statistics_${currentUser.id}`);
      if (savedStats) {
        try {
          return JSON.parse(savedStats);
        } catch (error) {
          console.error('Error parsing saved statistics:', error);
        }
      }
    }
    
    // Return mock statistics if no saved stats or user
    const today = new Date();
    const weekDays = [];
    
    // Generate the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      weekDays.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        completedTasks: Math.floor(Math.random() * 10) + 1
      });
    }
    
    return {
      userId: currentUser?.id || 'mock-user',
      totalTasks: 30,
      completedTasks: 24,
      averageCompletionTime: 45,
      streakDays: 5,
      taskCompletionRate: 80,
      performanceOverTime: weekDays,
      categoryDistribution: [
        { category: 'Work', count: 12 },
        { category: 'Personal', count: 8 },
        { category: 'Health', count: 5 },
        { category: 'Other', count: 5 }
      ]
    };
  });

  // Update statistics whenever tasks change
  useEffect(() => {
    updateStatistics();
  }, [tasks]);

  const updateStatistics = useCallback(() => {
    if (!currentUser) return;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === TaskStatus.COMPLETED).length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Calculate average completion time (in minutes)
    let totalCompletionTime = 0;
    let completionCount = 0;
    
    tasks.forEach(task => {
      if (task.status === TaskStatus.COMPLETED && task.completedAt && task.createdAt) {
        const completionTimeMs = task.completedAt.getTime() - task.createdAt.getTime();
        const completionTimeMinutes = completionTimeMs / (1000 * 60);
        totalCompletionTime += completionTimeMinutes;
        completionCount++;
      }
    });
    
    const averageCompletionTime = completionCount > 0 ? totalCompletionTime / completionCount : 0;
    
    // Calculate current streak days (simplified implementation)
    // For now, we'll use a fixed value since proper streak calculation requires date tracking
    const streakDays = 1;
    
    // Update performance over time (last 7 days)
    const today = new Date();
    const performanceOverTime = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Count completed tasks for this date
      const dayCompletedTasks = tasks.filter(task => 
        task.status === TaskStatus.COMPLETED && 
        task.completedAt && 
        task.completedAt.toDateString() === date.toDateString()
      ).length;
      
      performanceOverTime.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        completedTasks: dayCompletedTasks
      });
    }
    
    // Mock category distribution
    const categoryDistribution = [
      { category: 'Work', count: Math.floor(Math.random() * 15) + 5 },
      { category: 'Personal', count: Math.floor(Math.random() * 10) + 3 },
      { category: 'Health', count: Math.floor(Math.random() * 8) + 2 },
      { category: 'Other', count: Math.floor(Math.random() * 7) + 1 }
    ];
    
    const updatedStatistics: Statistics = {
      userId: currentUser.id,
      totalTasks,
      completedTasks,
      averageCompletionTime,
      streakDays,
      taskCompletionRate,
      performanceOverTime,
      categoryDistribution
    };
    
    setStatistics(updatedStatistics);
    localStorage.setItem(`statistics_${currentUser.id}`, JSON.stringify(updatedStatistics));
  }, [currentUser, tasks]);

  const exportStatistics = useCallback(() => {
    // Create a JSON string of the statistics
    const statisticsJSON = JSON.stringify({ ...statistics, focus: focus.error || focus.loading ? null : focusTotals(focus.journal) }, null, 2);
    
    // Create a Blob object
    const blob = new Blob([statisticsJSON], { type: 'application/json' });
    
    // Create a URL for the Blob
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element and trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = `MotiBuddy_statistics_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [statistics, focus.journal, focus.error, focus.loading]);

  const getTasksCompletedThisWeek = useCallback(() => {
    return statistics.performanceOverTime;
  }, [statistics]);

  const getTasksByPriority = useCallback(() => {
    const now = new Date();
    
    // Count overdue tasks separately
    const overdueCount = tasks.filter(task => {
      if (task.status === TaskStatus.COMPLETED) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate < now;
    }).length;
    
    const priorityCount = {
      [TaskPriority.LOW]: tasks.filter(task => task.priority === TaskPriority.LOW && !(new Date(task.dueDate) < now && task.status !== TaskStatus.COMPLETED)).length,
      [TaskPriority.MEDIUM]: tasks.filter(task => task.priority === TaskPriority.MEDIUM && !(new Date(task.dueDate) < now && task.status !== TaskStatus.COMPLETED)).length,
      [TaskPriority.HIGH]: tasks.filter(task => task.priority === TaskPriority.HIGH && !(new Date(task.dueDate) < now && task.status !== TaskStatus.COMPLETED)).length,
      [TaskPriority.URGENT]: tasks.filter(task => task.priority === TaskPriority.URGENT && !(new Date(task.dueDate) < now && task.status !== TaskStatus.COMPLETED)).length
    };
    
    const result = Object.entries(priorityCount).map(([priority, count]) => ({
      name: priority.charAt(0).toUpperCase() + priority.slice(1),
      value: count
    }));
    
    // Add overdue category if there are overdue tasks
    if (overdueCount > 0) {
      result.push({ name: 'Overdue', value: overdueCount });
    }
    
    return result;
  }, [tasks]);

  const getTasksByStatus = useCallback(() => {
    const statusCount = {
      [TaskStatus.COMPLETED]: tasks.filter(task => task.status === TaskStatus.COMPLETED).length,
      [TaskStatus.IN_PROGRESS]: tasks.filter(task => task.status === TaskStatus.IN_PROGRESS).length,
      [TaskStatus.OVERDUE]: tasks.filter(task => task.status === TaskStatus.OVERDUE).length
    };
    
    return Object.entries(statusCount).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
      value: count
    }));
  }, [tasks]);

  return (
    <StatisticsContext.Provider value={{
      statistics,
      updateStatistics,
      exportStatistics,
      getTasksCompletedThisWeek,
      getTasksByPriority,
      getTasksByStatus
    }}>
      {children}
    </StatisticsContext.Provider>
  );
};
