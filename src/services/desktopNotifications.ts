import {invoke} from '@tauri-apps/api/tauri';
import { isTauri } from './tauriCommands';
export async function enableDesktopNotifications(){
  if(!isTauri()) return false;
  return await invoke<boolean>('desktop_notification_status');
}
export async function desktopNotify(title:string,body:string){
  if(!isTauri())throw new Error('Desktop notifications require the native app');
  await invoke('desktop_notify',{title:[...title].slice(0,100).join(''),body:[...body].slice(0,1000).join('')});
}
