import type { Task } from '../types/index.ts';
import type { AgentPlan } from './agentContracts.ts';
export function planTimeline(plan:AgentPlan,tasks:Task[],now=new Date()){
  const occupied=tasks.filter(t=>t.status!=='completed'&&t.timingMode==='range'&&t.startAt&&+t.dueDate>+now).map(t=>({start:+t.startAt!,end:+t.dueDate})).sort((a,b)=>a.start-b.start);
  let cursor=+now;const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  return plan.items.map(item=>{
    const task=tasks.find(t=>t.id===item.taskId);const fixed=task?.timingMode==='range'&&task.startAt;
    if(fixed)return {item,task,start:task.startAt!,end:task.dueDate,fixed:true,outsideToday:+task.startAt!>=+tomorrow||+task.dueDate<=+now};
    const duration=item.minutes*60000;
    for(const slot of occupied){if(cursor+duration<=slot.start)break;if(cursor<slot.end&&cursor+duration>slot.start)cursor=slot.end;}
    const start=new Date(cursor),end=new Date(cursor+duration);cursor=+end+5*60000;
    return {item,task,start,end,fixed:false,outsideToday:+end>+tomorrow,missesDeadline:!!task&&+end>+task.dueDate};
  }).sort((a,b)=>+a.start-+b.start);
}
