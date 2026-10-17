import type { BusinessData } from './businessRepository.ts';
import type { Achievement } from '../types/index.ts';
import { decodeFocusJournal, focusTotals } from './focusSession.ts';
import { grantExperience } from './petRewards.ts';
function streak(tasks: BusinessData['tasks']) {
  const days=[...new Set(tasks.filter(t=>t.status==='completed'&&t.completedAt).map(t=>{const d=t.completedAt!;return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000;}))].sort((a,b)=>a-b);
  let best=0,run=0,previous=-Infinity;for(const day of days){run=day===previous+1?run+1:1;best=Math.max(best,run);previous=day;}return best;
}
export const progressAchievements=[
  {id:'8',type:'first_task',zh:'第一步',en:'First Step',description:['完成第一个任务','Complete your first task'],icon:'fa-solid fa-flag-checkered',xp:20,goal:1,count:(d:BusinessData)=>d.tasks.filter(t=>t.status==='completed').length},
  {id:'2',type:'productivity_master',zh:'稳步前行',en:'Steady progress',description:['累计完成 50 个任务','Complete 50 tasks'],icon:'fa-solid fa-check-double',xp:50,goal:50,count:(d:BusinessData)=>d.tasks.filter(t=>t.status==='completed').length},
  {id:'3',type:'punctuality_pro',zh:'从容赴约',en:'On time',description:['按时完成 10 个任务','Complete 10 tasks by their deadline'],icon:'fa-solid fa-clock',xp:30,goal:10,count:(d:BusinessData)=>d.tasks.filter(t=>t.status==='completed'&&t.completedAt&&t.completedAt<=t.dueDate).length},
  ...[3,7,30].map((days,i)=>({id:String(9+i),type:['three_day_streak','seven_day_streak','thirty_day_streak'][i],zh:`${days} 天的坚持`,en:`${days} day streak`,description:[`连续 ${days} 天完成任务`,`Complete tasks on ${days} consecutive days`],icon:'fa-solid fa-calendar-check',xp:days===30?100:30,goal:days,count:(d:BusinessData)=>streak(d.tasks)})),
  {id:'focus-first',type:'focus_first',zh:'沉浸初体验',en:'First focus',description:['完成 1 轮专注','Complete one focus round'],icon:'fa-regular fa-hourglass-half',xp:20,goal:1,count:(d:BusinessData)=>focusTotals(decodeFocusJournal(d.settings.focusSpace)).completedCycles},
  {id:'focus-120',type:'focus_120',zh:'时间的朋友',en:'A friend of time',description:['累计专注 120 分钟','Accumulate 120 minutes of focus'],icon:'fa-solid fa-stopwatch',xp:40,goal:120,count:(d:BusinessData)=>Math.floor(focusTotals(decodeFocusJournal(d.settings.focusSpace)).focusMs/60000)},
  {id:'anniversary-first',type:'anniversary_first',zh:'珍藏这一天',en:'A day to treasure',description:['创建 1 个纪念日','Create one anniversary note'],icon:'fa-regular fa-heart',xp:10,goal:1,count:(d:BusinessData)=>Array.isArray(d.settings.anniversaries)?d.settings.anniversaries.length:0},
  {id:'pet-care-10',type:'pet_care_10',zh:'贴心照料',en:'Caring companion',description:['累计喂食或玩耍 10 次','Feed or play with your pet 10 times'],icon:'fa-solid fa-paw',xp:20,goal:10,count:(d:BusinessData)=>Number(d.settings.petInteractionCount??0)},
];
export function applyProgressAchievements(data:BusinessData,now:Date):BusinessData{
  const earned=progressAchievements.filter(item=>item.count(data)>=item.goal);
  const receipts=new Set(Array.isArray(data.settings.achievementRewards)?data.settings.achievementRewards as string[]:[]);
  const rewards=earned.filter(item=>!receipts.has(item.id));
  const fresh=earned.filter(item=>!data.achievements.some(a=>a.id===item.id));
  if(!fresh.length&&(!data.pet||!rewards.length))return data;
  return {...data,achievements:[...data.achievements,...fresh.map(item=>({id:item.id,type:item.type,name:item.en,description:item.description[1],icon:item.icon,unlockedAt:now}) as Achievement)],pet:data.pet?grantExperience(data.pet,rewards.reduce((sum,item)=>sum+item.xp,0)):null,settings:{...data.settings,...(data.pet?{achievementRewards:[...receipts,...rewards.map(item=>item.id)]}:{})}};
}
