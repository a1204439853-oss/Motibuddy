const fs = require('fs');
const path = require('path');

const publicDir = 'f:\\MotiBuddy1\\public';

const renameMap = {
  '小狗.jpg': 'dog.jpg',
  '小猫.jpg': 'cat.jpg',
  '小鸟.jpg': 'bird.jpg',
  '熊猫.jpg': 'panda.jpg',
  '选择宠物时页面背景.png': 'pet_selection_bg.png',
  '用户注册登录背景视频.mp4': 'login_bg.mp4',
  '欢迎页面视频背景.mp4': 'welcome_bg.mp4',
  '小狗待机动作.mp4': 'dog_idle.mp4',
  '小狗玩耍动作.mp4': 'dog_play.mp4',
  '小狗生病视频.mp4': 'dog_sick.mp4',
  '小狗被投喂动作.mp4': 'dog_feed.mp4',
  '小狗转圈视频.mp4': 'dog_spin.mp4',
  '小狗随机动作1.mp4': 'dog_random1.mp4',
  '小狗随机动作2.mp4': 'dog_random2.mp4',
  '小猫待机动作.mp4': 'cat_idle.mp4',
  '小猫玩耍动作.mp4': 'cat_play.mp4',
  '小猫生病视频.mp4': 'cat_sick.mp4',
  '小猫被投喂动作.mp4': 'cat_feed.mp4',
  '小猫跳跃视频.mp4': 'cat_jump.mp4',
  '小猫随机动作1.mp4': 'cat_random1.mp4',
  '小猫随机动作2.mp4': 'cat_random2.mp4',
  '小鸟待机动作.mp4': 'bird_idle.mp4',
  '小鸟玩耍动作.mp4': 'bird_play.mp4',
  '小鸟生病视频.mp4': 'bird_sick.mp4',
  '小鸟被投喂动作.mp4': 'bird_feed.mp4',
  '小鸟随机动作1.mp4': 'bird_random1.mp4',
  '小鸟随机动作2.mp4': 'bird_random2.mp4',
  '小鸟飞翔视频.mp4': 'bird_fly.mp4',
  '熊猫待机动作.mp4': 'panda_idle.mp4',
  '熊猫打招呼视频.mp4': 'panda_greet.mp4',
  '熊猫玩耍动作.mp4': 'panda_play.mp4',
  '熊猫生病视频.mp4': 'panda_sick.mp4',
  '熊猫被投喂的动作.mp4': 'panda_feed.mp4',
  '熊猫随机动作1.mp4': 'panda_random1.mp4',
  '熊猫随机动作2.mp4': 'panda_random2.mp4',
  '完成任务时小狗视频.mp4': 'task_complete_dog.mp4',
  '完成任务时小猫视频.mp4': 'task_complete_cat.mp4',
  '完成任务时小鸟视频.mp4': 'task_complete_bird.mp4',
  '完成任务时熊猫视频.mp4': 'task_complete_panda.mp4',
  '任务逾期时小狗视频.mp4': 'task_overdue_dog.mp4',
  '任务逾期时小猫视频.mp4': 'task_overdue_cat.mp4',
  '任务逾期时小鸟视频.mp4': 'task_overdue_bird.mp4',
  '任务逾期时熊猫视频.mp4': 'task_overdue_panda.mp4'
};

console.log('Renaming files in public directory...');

for (const [oldName, newName] of Object.entries(renameMap)) {
  const oldPath = path.join(publicDir, oldName);
  const newPath = path.join(publicDir, newName);

  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`✓ ${oldName} -> ${newName}`);
  } else {
    console.log(`✗ ${oldName} not found`);
  }
}

console.log('\nDone!');
