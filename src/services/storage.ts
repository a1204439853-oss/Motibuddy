import { BaseDirectory, readTextFile, writeTextFile, exists, createDir } from '@tauri-apps/api/fs';
import { appDataDir, join } from '@tauri-apps/api/path';

// 数据文件路径
const DATA_DIR = 'MotiBuddyData';
const TASKS_FILE = 'tasks.json';
const PET_FILE = 'pet.json';
const USER_FILE = 'user.json';
const SETTINGS_FILE = 'settings.json';

/**
 * 确保数据目录存在
 */
async function ensureDataDir(): Promise<string> {
  const appDir = await appDataDir();
  const dataDir = await join(appDir, DATA_DIR);
  
  const dirExists = await exists(dataDir);
  if (!dirExists) {
    await createDir(dataDir, { recursive: true });
  }
  
  return dataDir;
}

/**
 * 获取完整文件路径
 */
async function getFilePath(filename: string): Promise<string> {
  const dataDir = await ensureDataDir();
  return await join(dataDir, filename);
}

/**
 * 读取 JSON 数据
 */
async function readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  try {
    const filePath = await getFilePath(filename);
    const fileExists = await exists(filePath);
    
    if (!fileExists) {
      return defaultValue;
    }
    
    const content = await readTextFile(filePath);
    return JSON.parse(content, (key, value) => {
      // 自动转换日期字符串为 Date 对象
      if (key === 'dueDate' || key === 'createdAt' || key === 'completedAt' || key === 'unlockedAt' || key === 'lastInteraction' || key === 'adoptedAt') {
        return value ? new Date(value) : value;
      }
      return value;
    });
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return defaultValue;
  }
}

/**
 * 写入 JSON 数据
 */
async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  try {
    const filePath = await getFilePath(filename);
    await ensureDataDir();
    const content = JSON.stringify(data, null, 2);
    await writeTextFile(filePath, content);
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    throw error;
  }
}

// ==================== 任务数据存储 ====================

// 获取当前用户ID
function getCurrentUserId(): string | null {
  if (typeof window !== 'undefined') {
    // 从 localStorage 获取当前登录的用户ID
    const currentUserId = localStorage.getItem('currentUserId');
    if (currentUserId) {
      return currentUserId;
    }
  }
  return null;
}

// 获取用户特定的任务文件名
function getUserTasksFile(): string {
  const userId = getCurrentUserId();
  return userId ? `tasks_${userId}.json` : TASKS_FILE;
}

export async function loadTasks<T>(): Promise<T[]> {
  const filename = getUserTasksFile();
  return readJsonFile<T[]>(filename, []);
}

export async function saveTasks<T>(tasks: T[]): Promise<void> {
  const filename = getUserTasksFile();
  return writeJsonFile(filename, tasks);
}

// ==================== 宠物数据存储 ====================

// 获取用户特定的宠物文件名
function getUserPetFile(): string {
  const userId = getCurrentUserId();
  return userId ? `pet_${userId}.json` : PET_FILE;
}

export async function loadPet<T>(): Promise<T | null> {
  const filename = getUserPetFile();
  return readJsonFile<T | null>(filename, null);
}

export async function savePet<T>(pet: T): Promise<void> {
  const filename = getUserPetFile();
  return writeJsonFile(filename, pet);
}

// ==================== 用户数据存储 ====================

export async function loadUser<T>(): Promise<T | null> {
  return readJsonFile<T | null>(USER_FILE, null);
}

export async function saveUser<T>(user: T): Promise<void> {
  return writeJsonFile(USER_FILE, user);
}

// ==================== 设置数据存储 ====================

// 获取用户特定的设置文件名
function getUserSettingsFile(): string {
  const userId = getCurrentUserId();
  return userId ? `settings_${userId}.json` : SETTINGS_FILE;
}

export async function loadSettings<T>(): Promise<T | null> {
  const filename = getUserSettingsFile();
  return readJsonFile<T | null>(filename, null);
}

export async function saveSettings<T>(settings: T): Promise<void> {
  const filename = getUserSettingsFile();
  return writeJsonFile(filename, settings);
}

// ==================== 数据迁移 ====================

/**
 * 从 localStorage 迁移数据到本地文件系统
 */
export async function migrateFromLocalStorage(): Promise<void> {
  try {
    // 迁移任务数据
    const tasksKey = Object.keys(localStorage).find(k => k.startsWith('tasks_'));
    if (tasksKey) {
      const tasks = localStorage.getItem(tasksKey);
      if (tasks) {
        await writeJsonFile(TASKS_FILE, JSON.parse(tasks));
        localStorage.removeItem(tasksKey);
      }
    }
    
    // 迁移宠物数据
    const petKey = Object.keys(localStorage).find(k => k.startsWith('pet_'));
    if (petKey) {
      const pet = localStorage.getItem(petKey);
      if (pet) {
        await writeJsonFile(PET_FILE, JSON.parse(pet));
        localStorage.removeItem(petKey);
      }
    }
    
    // 迁移当前宠物
    const currentPet = localStorage.getItem('currentPet');
    if (currentPet && !petKey) {
      await writeJsonFile(PET_FILE, JSON.parse(currentPet));
      localStorage.removeItem('currentPet');
    }
    
    console.log('Data migration completed successfully');
  } catch (error) {
    console.error('Error migrating data:', error);
  }
}

// ==================== 数据导出/导入 ====================

/**
 * 导出所有数据
 */
export async function exportAllData(): Promise<Blob> {
  const data = {
    tasks: await loadTasks(),
    pet: await loadPet(),
    user: await loadUser(),
    settings: await loadSettings(),
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
  
  const json = JSON.stringify(data, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * 导入数据
 */
export async function importAllData(jsonContent: string): Promise<void> {
  try {
    const data = JSON.parse(jsonContent);
    
    if (data.tasks) await saveTasks(data.tasks);
    if (data.pet) await savePet(data.pet);
    if (data.user) await saveUser(data.user);
    if (data.settings) await saveSettings(data.settings);
    
    console.log('Data imported successfully');
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
}
