import { t, label, getLocale } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useContext, useMemo } from 'react';
import { TaskContext } from '@/contexts/taskContext';
import { Task, TaskPriority, TaskStatus } from '@/types';
import { motion } from 'framer-motion';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ZAxis
} from 'recharts';

interface TimelineDataPoint {
  x: number;
  y: number;
  tasks: Task[];
  color: string;
}

const priorityColors: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: '#06D6A0',
  [TaskPriority.MEDIUM]: '#FFD166',
  [TaskPriority.HIGH]: '#FF9F1C',
  [TaskPriority.URGENT]: '#EF476F',
};

const priorityOrder: Record<TaskPriority, number> = {
  [TaskPriority.LOW]: 1,
  [TaskPriority.MEDIUM]: 2,
  [TaskPriority.HIGH]: 3,
  [TaskPriority.URGENT]: 4,
};

const TaskTimeline = () => {
  const { locale } = useLocale();
  const { tasks } = useContext(TaskContext);

  const { data, yAxisLabels } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Generate next 7 days labels - 使用更短的格式确保一行显示
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      // 使用更短的格式: "Mon 2/27" (星期几 + 月/日)
      const dayName = date.toLocaleDateString(getLocale(), { weekday: 'short' });
      const month = date.getMonth() + 1;
      const day = date.getDate();
      labels.push(`${dayName} ${month}/${day}`);
    }

    // Filter tasks due in next 7 days and not completed
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7);
    endDate.setHours(23, 59, 59, 999);

    const upcomingTasks = tasks.filter(task => {
      const dueDate = new Date(task.dueDate);
      return dueDate >= now && dueDate <= endDate && task.status !== TaskStatus.COMPLETED;
    });

    // Group tasks by day and time (within 30 minutes)
    const groupedTasks: Map<string, Task[]> = new Map();

    upcomingTasks.forEach(task => {
      const dueDate = new Date(task.dueDate);
      const dayIndex = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const hour = dueDate.getHours();
      const minute = dueDate.getMinutes();
      const timeValue = hour + minute / 60;

      // Round to nearest 30 minutes for grouping
      const roundedTime = Math.round(timeValue * 2) / 2;
      const key = `${dayIndex}-${roundedTime}`;

      if (!groupedTasks.has(key)) {
        groupedTasks.set(key, []);
      }
      groupedTasks.get(key)!.push(task);
    });

    // Convert to scatter data
    const scatterData: TimelineDataPoint[] = [];
    groupedTasks.forEach((taskGroup, key) => {
      const [dayIndexStr, timeStr] = key.split('-');
      const dayIndex = parseInt(dayIndexStr);
      const time = parseFloat(timeStr);

      // Find highest priority in group
      const highestPriorityTask = taskGroup.reduce((highest, task) => {
        return priorityOrder[task.priority] > priorityOrder[highest.priority] ? task : highest;
      }, taskGroup[0]);

      scatterData.push({
        x: time,
        y: dayIndex,
        tasks: taskGroup,
        color: priorityColors[highestPriorityTask.priority],
      });
    });

    return { data: scatterData, yAxisLabels: labels };
  }, [tasks, locale]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  useLocale();
    if (active && payload && payload.length > 0) {
      const dataPoint: TimelineDataPoint = payload[0].payload;
      const taskList = dataPoint.tasks;

      return (
        <div
          style={{
            backgroundColor: 'white',
            border: '2px solid #222222',
            borderRadius: '6px',
            padding: '10px',
            boxShadow: '3px 3px 0 #222222',
            maxWidth: '240px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {taskList.map((task, index) => {
              const dueDate = new Date(task.dueDate);
              const timeStr = dueDate.toLocaleTimeString(getLocale(), {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              });
              const dateStr = dueDate.toLocaleDateString(getLocale(), {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div key={task.id} style={{ fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: priorityColors[task.priority],
                        border: '1px solid #222222',
                      }}
                    />
                    <span style={{ fontWeight: 'bold', color: '#222222', fontSize: '12px' }}>{task.title}</span>
                  </div>
                  <div style={{ paddingLeft: '14px', color: '#666666', lineHeight: '1.4', fontSize: '10px' }}>
                    <div>{t("Priority:")}{' '}<span style={{ color: priorityColors[task.priority], fontWeight: 'bold' }}>
                      {label(task.priority)}
                    </span></div>
                    <div>{t("Due:")}{' '}{dateStr} {timeStr}</div>
                  </div>
                  {index < taskList.length - 1 && (
                    <div style={{ borderBottom: '1px dashed #e0e0e0', marginTop: '6px' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const formatXAxisLabel = (value: number) => {
    const hour = Math.floor(value);
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const formatYAxisLabel = (value: number) => {
    const index = Math.round(value);
    if (index >= 0 && index < yAxisLabels.length) {
      return yAxisLabels[index];
    }
    return '';
  };

  const hasData = data.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      style={{
        backgroundColor: 'white',
        padding: '12px',
        borderRadius: '8px',
        boxShadow: '3px 3px 0 #222222',
        border: '2px solid #222222',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#222222', fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{t("Weekly Task Timeline")}</h3>
        <div style={{ display: 'flex', gap: '8px', fontSize: locale === 'zh-CN' ? '11px' : '9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: priorityColors[TaskPriority.LOW], border: '1px solid #222222' }} />
            <span>{t("Low")}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: priorityColors[TaskPriority.MEDIUM], border: '1px solid #222222' }} />
            <span>{t("Med")}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: priorityColors[TaskPriority.HIGH], border: '1px solid #222222' }} />
            <span>{t("High")}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: priorityColors[TaskPriority.URGENT], border: '1px solid #222222' }} />
            <span>{t("Urg")}</span>
          </div>
        </div>
      </div>
      <div className="h-56">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[0, 24]}
                ticks={[0, 4, 8, 12, 16, 20, 24]}
                tickFormatter={formatXAxisLabel}
                stroke="#222222"
                fontSize={9}
                label={{ value: t('Time'), position: 'insideBottom', offset: -2, fill: '#222222', fontSize: locale === 'zh-CN' ? 11 : 9, fontWeight: 'bold' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[-0.5, 6.5]}
                ticks={[0, 1, 2, 3, 4, 5, 6]}
                tickFormatter={formatYAxisLabel}
                stroke="#222222"
                width={locale === 'zh-CN' ? 88 : 70}
                fontSize={10}
                tick={{ fill: '#222222', fontSize: locale === 'zh-CN' ? 11 : 10, fontWeight: 'bold' }}
              />
              <ZAxis type="number" dataKey="z" range={[60, 200]} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={data} shape="circle">
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="#222222"
                    strokeWidth={1}
                    r={entry.tasks.length > 1 ? 7 : 5}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              padding: '10px',
            }}
          >
            <p
              style={{
                fontSize: '11px',
                color: '#222222',
                fontWeight: 'bold',
              }}
            >{t("No upcoming tasks in the next 7 days. Enjoy your free time!")}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TaskTimeline;
