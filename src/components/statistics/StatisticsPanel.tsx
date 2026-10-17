import { t, label } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useContext, useEffect } from 'react';
import { StatisticsContext } from '@/contexts/statisticsContext';
import { TaskContext } from '@/contexts/taskContext';
import { motion } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import {SavedWeeklyReports} from '@/components/agent/SavedAssistantViews';
import TaskTimeline from './TaskTimeline';
import { FocusContext, focusTotals } from '@/contexts/focusContext';
import { focusDuration } from '@/components/focus/FocusSpace';

const StatisticsPanel = () => {
  const { locale } = useLocale();
  const focus = useContext(FocusContext), totals = focusTotals(focus.journal);
  const focusUnavailable = focus.loading || focus.error;
  const { 
    statistics, 
    updateStatistics, 
    exportStatistics,
    getTasksCompletedThisWeek,
    getTasksByPriority,
    getTasksByStatus
  } = useContext(StatisticsContext);
  
  const { tasks } = useContext(TaskContext);

  const fontFamily = 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif';
  
  // Update statistics when component mounts
  useEffect(() => {
    updateStatistics();
  }, [updateStatistics]);
  
  // Chart data
  const weeklyData = statistics.performanceOverTime.map(day => ({ ...day, date: t(day.date) }));
  const priorityData = getTasksByPriority().map(item => ({ ...item, name: t(item.name) }));
  const statusData = getTasksByStatus().map(item => ({ ...item, name: t(item.name) }));
  
  // Colors for charts
  const priorityColors = ['#06D6A0', '#FFD166', '#FF9F1C', '#EF476F', '#8B0000']; // Low (Green), Medium (Yellow), High (Orange), Urgent (Red), Overdue (Dark Red)
  const statusColors = ['#06D6A0', '#118AB2', '#EF476F', '#EF476F']; // Completed (Green), In Progress (Blue), Overdue (Red)
  
  // Format numbers to have 0 decimal places
  const formatNumber = (value: number) => {
    return value.toFixed(0);
  };
  
  // Format minutes to hours and minutes
  const formatTime = (minutes: number) => {
    if (minutes < 0) return t("N/A");
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    
    if (hours > 0) {
      if (remainingMinutes > 0) {
        return t("{hours}h{minutes}min", { hours, minutes: remainingMinutes });
      }
      return t("{hours}h", { hours });
    }
    return t("{minutes}min", { minutes: remainingMinutes });
  };
  

  
  return (
    <div className="space-y-3 overflow-y-auto max-h-full p-1">
      <SavedWeeklyReports/>
      {/* Stats summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            backgroundColor: '#00CECB',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '3px 3px 0 #222222',
            border: '2px solid #222222'
          }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p style={{ color: '#222222', fontSize: '12px', fontWeight: 'bold', fontFamily: fontFamily }}>{t("Total Tasks")}</p>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', marginTop: '4px', fontFamily: fontFamily }}>{statistics.totalTasks}</h3>
            </div>
            <div style={{ width: '32px', height: '32px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222222', border: '1px solid #222222' }}>
              <i className="fa-solid fa-tasks text-base"></i>
            </div>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            backgroundColor: '#FF5E5B',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '3px 3px 0 #222222',
            border: '2px solid #222222'
          }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p style={{ color: '#222222', fontSize: '12px', fontWeight: 'bold', fontFamily: fontFamily }}>{t("Completed")}</p>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', marginTop: '4px', fontFamily: fontFamily }}>{statistics.completedTasks}</h3>
            </div>
            <div style={{ width: '32px', height: '32px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222222', border: '1px solid #222222' }}>
              <i className="fa-solid fa-check-circle text-base"></i>
            </div>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            backgroundColor: '#FFD700',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '3px 3px 0 #222222',
            border: '2px solid #222222'
          }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p style={{ color: '#222222', fontSize: '12px', fontWeight: 'bold', fontFamily: fontFamily }}>{t("Rate")}</p>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', marginTop: '4px', fontFamily: fontFamily }}>{statistics.taskCompletionRate}%</h3>
            </div>
            <div style={{ width: '32px', height: '32px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222222', border: '1px solid #222222' }}>
              <i className="fa-solid fa-chart-pie text-base"></i>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Weekly Task Timeline - Full Width */}
      <section className="focus-statistics" aria-label={t('Focus statistics')}><h3>{t('Focus statistics')}</h3><div><span>{t('Total focus time')}</span><strong>{focusUnavailable ? '—' : focusDuration(totals.focusMs, locale)}</strong></div><div><span>{t('Focus sessions started')}</span><strong>{focusUnavailable ? '—' : totals.entries}</strong></div><div><span>{t('Completed focus rounds')}</span><strong>{focusUnavailable ? '—' : totals.completedCycles}</strong></div><p>{focus.loading ? t('Loading focus records…') : focus.error ? t('Focus records unavailable. Retry in Focus space.') : t('Breaks are excluded. Partial focus time is retained when you leave early.')}</p></section>
      <TaskTimeline />

      {/* Task distribution charts */}
      <div className="grid grid-cols-3 gap-3">
        {/* Weekly performance chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '8px',
            boxShadow: '3px 3px 0 #222222',
            border: '2px solid #222222'
          }}
        >
          <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#222222', marginBottom: '8px', fontFamily: fontFamily }}>{t("Weekly Performance")}</h3>
          <div className="h-40">
            {weeklyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#222222" fontSize={10} tick={{ fill: '#222222', fontSize: 10, fontFamily: fontFamily }} />
                  <YAxis stroke="#222222" fontSize={10} tickFormatter={formatNumber} ticks={[0, 5, 10, 15]} tick={{ fill: '#222222', fontSize: 10, fontFamily: fontFamily }} />
                  <Tooltip
                    formatter={(value) => [t("{count} tasks", { count: String(value) }), t("Completed")]}
                    contentStyle={{ borderRadius: '6px', border: '2px solid #222222', boxShadow: '2px 2px 0 #222222', fontFamily: fontFamily, fontSize: '11px' }}
                    itemStyle={{ fontFamily: fontFamily, fontSize: '11px' }}
                    labelStyle={{ fontFamily: fontFamily, fontSize: '11px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completedTasks"
                    stroke="#FF5E5B"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#FF5E5B', strokeWidth: 1, stroke: '#222222' }}
                    activeDot={{ r: 6, fill: '#FF5E5B', strokeWidth: 1, stroke: '#222222' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                textAlign: 'center',
                padding: '10px'
              }}>
                <p style={{ 
                  fontSize: '11px', 
                  color: '#222222', 
                  fontWeight: 'bold',
                  fontFamily: fontFamily
                }}>{t("No tasks yet. Create one!")}</p>
              </div>
            )}
          </div>
        </motion.div>
        
        {/* Priority distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '8px',
            boxShadow: '3px 3px 0 #222222',
            border: '2px solid #222222'
          }}
        >
          <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#222222', marginBottom: '8px', fontFamily: fontFamily }}>{t("By Priority")}</h3>
          <div className="h-40">
            {priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={45}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent, value }) => value > 0 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                    fontSize={10}
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={priorityColors[index % priorityColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [t("{count} tasks", { count: String(value) }), name]}
                    contentStyle={{ borderRadius: '6px', border: '2px solid #222222', boxShadow: '2px 2px 0 #222222', fontFamily: fontFamily, fontSize: '11px' }}
                    itemStyle={{ fontFamily: fontFamily, fontSize: '11px' }}
                    labelStyle={{ fontFamily: fontFamily, fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                textAlign: 'center',
                padding: '10px'
              }}>
                <p style={{ 
                  fontSize: '11px', 
                  color: '#222222', 
                  fontWeight: 'bold',
                  fontFamily: fontFamily
                }}>{t("No tasks yet. Create one!")}</p>
              </div>
            )}
          </div>
        </motion.div>
        
        {/* Status distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '8px',
            boxShadow: '3px 3px 0 #222222',
            border: '2px solid #222222'
          }}
        >
          <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#222222', marginBottom: '8px', fontFamily: fontFamily }}>{t("By Status")}</h3>
          <div className="h-40">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" stroke="#222222" fontSize={9} tick={{ fill: '#222222', fontSize: 9, fontFamily: fontFamily }} />
                  <YAxis stroke="#222222" fontSize={10} tickFormatter={formatNumber} ticks={[0, 5, 10, 15]} tick={{ fill: '#222222', fontSize: 10, fontFamily: fontFamily }} />
                  <Tooltip
                    formatter={(value, name) => [t("{count} tasks", { count: String(value) }), name]}
                    contentStyle={{ borderRadius: '6px', border: '2px solid #222222', boxShadow: '2px 2px 0 #222222', fontFamily: fontFamily, fontSize: '11px' }}
                    itemStyle={{ fontFamily: fontFamily, fontSize: '11px' }}
                    labelStyle={{ fontFamily: fontFamily, fontSize: '11px' }}
                  />
                  <Bar dataKey="value" name={t('Tasks')} radius={[6, 6, 0, 0]}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={statusColors[index % statusColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                textAlign: 'center',
                padding: '10px'
              }}>
                <p style={{ 
                  fontSize: '11px', 
                  color: '#222222', 
                  fontWeight: 'bold',
                  fontFamily: fontFamily
                }}>{t("No tasks yet. Create one!")}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      
      {/* Additional stats */}
      <div className="grid grid-cols-2 gap-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          style={{
            backgroundColor: '#FFD700',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '3px 3px 0 #222222',
            border: '2px solid #222222'
          }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p style={{ color: '#222222', fontSize: '12px', fontWeight: 'bold', fontFamily: fontFamily }}>{t("Avg Time")}</p>
              {statistics.averageCompletionTime > 0 ? (
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#222222', marginTop: '4px', fontFamily: fontFamily }}>
                  {formatTime(statistics.averageCompletionTime)}
                </h3>
              ) : (
                <p style={{ fontSize: '12px', fontWeight: 'normal', color: '#666666', marginTop: '4px', fontFamily: fontFamily }}>{t("Complete a task!")}</p>
              )}
            </div>
            <div style={{ width: '32px', height: '32px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222222', border: '1px solid #222222' }}>
              <i className="fa-solid fa-clock text-base"></i>
            </div>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          style={{
            backgroundColor: '#00CECB',
            padding: '12px',
            borderRadius: '8px',
            boxShadow: '3px 3px 0 #222222',
            border: '2px solid #222222'
          }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p style={{ color: '#222222', fontSize: '12px', fontWeight: 'bold', fontFamily: fontFamily }}>{t("Streak")}</p>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#222222', marginTop: '4px', fontFamily: fontFamily }}>
                {statistics.streakDays}{' '}{t(statistics.streakDays === 1 ? "day" : "days")}
              </h3>
            </div>
            <div style={{ width: '32px', height: '32px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222222', border: '1px solid #222222' }}>
              <i className="fa-solid fa-fire text-base"></i>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Export button */}
      <motion.button
        onClick={exportStatistics}
        style={{
          backgroundColor: '#FF5E5B',
          color: 'black',
          border: '2px solid #222222',
          padding: '6px 12px',
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '2px 2px 0 #222222',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          transition: 'all 0.2s ease',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          borderRadius: '6px',
          marginTop: '8px',
          fontFamily: fontFamily
        }}
        whileHover={{ scale: 1, x: 1, y: 1, boxShadow: '1px 1px 0 #222222' }}
        whileTap={{ scale: 1, x: 2, y: 2, boxShadow: 'none' }}
      >
        <i className="fa-solid fa-download text-sm"></i>
        <span>{t("Export")}</span>
      </motion.button>
    </div>
  );
};

export default StatisticsPanel;
