const fs = require('fs');
const path = require('path');

const videoDir = 'f:\\MotiBuddy1\\dist_videos';

const renameMap = {
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
  '熊猫随机动作2.mp4': 'panda_random2.mp4'
};

console.log('Renaming video files...');

for (const [oldName, newName] of Object.entries(renameMap)) {
  const oldPath = path.join(videoDir, oldName);
  const newPath = path.join(videoDir, newName);
  
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`✓ ${oldName} -> ${newName}`);
  } else {
    console.log(`✗ ${oldName} not found`);
  }
}

console.log('\nDone!');
