import { readTextFile, writeTextFile, exists, createDir, copyFile, renameFile, removeFile } from '@tauri-apps/api/fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/tauri';
import { JsonFileStore, type JsonDecoder } from './jsonFileStore';
import { decodeTasks } from './taskData';
import { decodePet } from './petData';
import { PetRepository, decodePetArchive } from './petRepository';
import { BusinessRepository } from './businessRepository';
import type { User } from '../types';
import { applicationWrites } from './writeBarrier';
import { checkLegacyBusinessCaches } from './businessMigration';

// 数据文件路径
const DATA_DIR = 'MotiBuddyData';
const USER_FILE = 'user.json';

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
  return await join(await appDataDir(), DATA_DIR, filename);
}

const store = new JsonFileStore({
  // Tauri v1's generic exists() hides IO errors; the backend preserves them.
  exists: path => invoke<boolean>('data_file_exists', { filename: path.split(/[\\/]/).pop() }),
  read: readTextFile, copy: copyFile, rename: renameFile, remove: removeFile,
  write: async (path, contents) => {
    await ensureDataDir();
    await writeTextFile(path, contents);
  },
});

function decodeRecord<T>(value: unknown): T {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a data record');
  }
  return JSON.parse(JSON.stringify(value), (key, field) => {
    if (['dueDate', 'createdAt', 'completedAt', 'unlockedAt', 'lastInteraction', 'lastFed', 'adoptedAt', 'time'].includes(key) && field) {
      const date = new Date(field);
      if (!Number.isFinite(date.getTime())) throw new Error('Invalid date');
      return date;
    }
    return field;
  }) as T;
}

/**
 * 读取 JSON 数据
 */
async function readJsonFile<T>(filename: string, defaultValue: T, decode: JsonDecoder<T> = decodeRecord<T>): Promise<T> {
  const result = await store.read(await getFilePath(filename), decode);
  return result.status === 'missing' ? defaultValue : result.value;
}

/**
 * 写入 JSON 数据
 */
async function writeJsonFile<T>(filename: string, data: T, decode: JsonDecoder<T> = decodeRecord<T>): Promise<void> {
  return applicationWrites.run(async () => store.write(await getFilePath(filename), data, decode));
}

export const businessRepository = new BusinessRepository({
  read: userId => invoke('read_business_state', { userId }),
  initialize: (userId, data) => invoke('initialize_business_state', { userId, data }),
  commit: (userId, expectedRevision, operationId, data) => invoke('commit_business_state', { userId, expectedRevision, operationId, data }),
}, applicationWrites);

/** Called after legacy pet conflicts have been resolved, before activating the session. */
export async function initializeBusiness(user: User, pet: unknown, isActive: () => boolean) {
  const data = {
    tasks: await readJsonFile(getUserTasksFile(user.id), [], decodeTasks),
    pet: pet === null ? null : decodePet(pet, user.id),
    achievements: user.achievements ?? [],
    settings: await readJsonFile<Record<string, unknown>>(getUserSettingsFile(user.id), {}),
  };
  checkLegacyBusinessCaches(user.id, data, key => localStorage.getItem(key));
  return businessRepository.initialize(user.id, data, isActive);
}

async function requireBusiness(userId?: string) {
  const snapshot = await businessRepository.read(getCurrentUserId(userId));
  if (!snapshot) throw new Error('Account migration must finish before accessing business data.');
  return snapshot;
}

// ==================== 任务数据存储 ====================

// 获取当前用户ID
function getCurrentUserId(userId?: string): string {
  const id = userId ?? (typeof window !== 'undefined' ? localStorage.getItem('currentUserId') : null);
  if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('A valid account is required to access data.');
  return id;
}

// 获取用户特定的任务文件名
function getUserTasksFile(userId?: string): string {
  return `tasks_${getCurrentUserId(userId)}.json`;
}

export async function loadTasks<T>(userId?: string): Promise<T[]> {
  return (await requireBusiness(userId)).data.tasks as T[];
}

export async function saveTasks<T>(tasks: T[], userId?: string): Promise<void> {
  void tasks; void userId;
  throw new Error('Use an account transaction to change tasks and their associated progress.');
}

// ==================== 宠物数据存储 ====================

// 获取用户特定的宠物文件名
function getUserPetFile(userId?: string): string {
  return `pet_${getCurrentUserId(userId)}.json`;
}

export async function loadPet<T>(userId?: string): Promise<T | null> {
  return (await requireBusiness(userId)).data.pet as T | null;
}

export const petRepository = new PetRepository({
  read: async userId => store.read(await getFilePath(getUserPetFile(userId)), value => decodePet(value, userId)),
  write: (userId, pet) => applicationWrites.run(async () => store.write(await getFilePath(getUserPetFile(userId)), pet, value => decodePet(value, userId))),
  readArchive: async userId => store.read(await getFilePath(`migration_pet_${getCurrentUserId(userId)}.json`), value => decodePetArchive(value, userId)),
  writeArchive: (userId, archive) => applicationWrites.run(async () => store.write(await getFilePath(`migration_pet_${getCurrentUserId(userId)}.json`), archive, value => decodePetArchive(value, userId))),
  getLegacy: key => localStorage.getItem(key),
});

// ==================== 用户数据存储 ====================

export async function loadUser<T>(): Promise<T | null> {
  return readJsonFile<T | null>(USER_FILE, null);
}

export async function saveUser<T>(user: T): Promise<void> {
  return writeJsonFile(USER_FILE, user);
}

// ==================== 设置数据存储 ====================

// 获取用户特定的设置文件名
function getUserSettingsFile(userId?: string): string {
  return `settings_${getCurrentUserId(userId)}.json`;
}

export async function loadSettings<T>(userId?: string): Promise<T | null> {
  return (await requireBusiness(userId)).data.settings as T;
}

export async function saveSettings<T>(settings: T, userId?: string): Promise<void> {
  void settings; void userId;
  throw new Error('Use an account transaction to change settings without replacing other saved progress.');
}

// ==================== 数据迁移 ====================

/**
 * 从 localStorage 迁移数据到本地文件系统
 */
export async function migrateFromLocalStorage(): Promise<void> {
  // The old first-match migration deleted source keys and discarded account ownership.
  // Keep this API fail-closed until the versioned, backed-up migration is implemented.
  throw new Error('Legacy migration requires a verified backup and an account-specific migration plan. No data has been changed.');
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
  void jsonContent;
  throw new Error('Data import is unavailable until validated, backed-up, all-or-nothing restoration is implemented. Existing data has not been changed.');
}
