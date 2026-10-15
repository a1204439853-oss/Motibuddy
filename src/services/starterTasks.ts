import type { User, Task } from '../types/index.ts';
import type { BusinessRepository, BusinessSnapshot } from './businessRepository.ts';

/** Real, editable examples, generated once in the language used for the first sign-in. */
export function createStarterTasks(locale: 'en-US' | 'zh-CN', now = new Date()): Task[] {
  const copy = locale === 'zh-CN' ? [
    ['[示例] 完成你的第一个任务', '点击任务左侧圆圈，体验完成任务后伙伴的变化。这是入门示例，可以编辑或删除。'],
    ['[示例] 试试编辑任务', '打开这条任务的菜单，把标题、截止时间或优先级改成自己的安排，也可以直接删除。'],
    ['[示例] 花 5 分钟整理桌面', '从一件容易完成的小事开始。这条示例可以替换成你自己的日常任务。'],
  ] : [
    ['[Example] Complete your first task', 'Click the circle beside this task to see how completing a task helps your buddy. This example can be edited or deleted.'],
    ['[Example] Try editing a task', 'Open this task’s menu and change its title, due date or priority to suit your plans. You can also delete it.'],
    ['[Example] Tidy your desk for 5 minutes', 'Start with a small, achievable step. Replace this example with a daily task of your own.'],
  ];
  return copy.map(([title, description], index) => {
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7 + index);
    return {
      id: `starter-v1-${index + 1}`, title, description,
      priority: 'low' as Task['priority'], status: 'pending' as Task['status'],
      createdAt: new Date(now), dueDate, estimatedDuration: 5,
    };
  });
}

export async function ensureStarterTasks(
  repository: BusinessRepository, user: Pick<User, 'id' | 'starterTasksVersion'>,
  snapshot: BusinessSnapshot, locale: 'en-US' | 'zh-CN', isActive: () => boolean, now = new Date(),
): Promise<BusinessSnapshot> {
  if (snapshot.userId !== user.id) throw new Error('The account session has changed.');
  if (user.starterTasksVersion !== 1 || snapshot.data.settings.starterTasksVersion !== undefined) return snapshot;
  // Separate from migration: an empty old authority remains empty. The transaction's
  // durable marker prevents resurrection after examples are completed or deleted.
  return repository.transact(user.id, data => {
    if (data.settings.starterTasksVersion !== undefined) return data;
    return { ...data,
      tasks: data.tasks.length ? data.tasks : createStarterTasks(locale, now),
      settings: { ...data.settings, starterTasksVersion: 1 },
    };
  }, isActive);
}
