/**
 * Tauri 命令封装
 * 用于前端调用 Rust 后端功能
 */

import { invoke } from '@tauri-apps/api/tauri';

/**
 * 获取应用数据目录路径
 */
export async function getDataDirectory(): Promise<string> {
  try {
    const path = await invoke<string>('get_data_directory');
    return path;
  } catch (error) {
    console.error('Failed to get data directory:', error);
    throw error;
  }
}

/**
 * 检查是否在 Tauri 环境中运行
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && 
         (typeof window.__TAURI__ !== 'undefined' || 
          typeof window.__TAURI_IPC__ !== 'undefined');
}

/**
 * 检查是否为桌面环境
 */
export function isDesktop(): boolean {
  return isTauri();
}

/**
 * 检查是否为 Web 环境
 */
export function isWeb(): boolean {
  return !isTauri();
}
