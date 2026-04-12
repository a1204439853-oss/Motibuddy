/**
 * MotiBuddy - Clear All User Data Script
 * 
 * 使用方法：
 * 1. 在浏览器控制台中复制粘贴此脚本
 * 2. 或在 HTML 文件中引入此脚本
 * 3. 运行 clearAllData() 函数
 */

function clearAllUserData() {
  const keysToRemove = [];
  
  // 收集所有需要删除的 localStorage 键
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      // 删除所有用户相关数据
      if (
        key === 'users' ||
        key === 'currentUser' ||
        key === 'currentPet' ||
        key === 'tasks' ||
        key.startsWith('pet_') ||
        key.startsWith('statistics_') ||
        key.startsWith('achievements_') ||
        key.startsWith('task_') ||
        key.startsWith('user_')
      ) {
        keysToRemove.push(key);
      }
    }
  }
  
  // 删除所有收集到的键
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`Removed: ${key}`);
  });
  
  console.log(`\n✅ Cleared ${keysToRemove.length} items from localStorage`);
  console.log('All user data has been deleted!');
  
  return keysToRemove.length;
}

// 如果需要在页面加载时自动清除，取消下面的注释
// clearAllUserData();

// 导出函数供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { clearAllUserData };
}
