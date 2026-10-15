import { useSyncExternalStore } from 'react';
import { getLocale, localeStore, t, label, type Locale } from './core';
import { isTauri } from '@/services/tauriCommands';
import { invoke } from '@tauri-apps/api/tauri';

export function useLocale() {
  const locale = useSyncExternalStore(localeStore.subscribe, getLocale, () => 'en-US' as Locale);
  return { locale, t, label, setLocale };
}
export function setLocale(locale: Locale) {
  localeStore.set(locale);
  if (isTauri()) {
    void invoke('set_ui_language', { locale }).catch(() => {});
    void import('@tauri-apps/api/event').then(({ emit }) => emit('ui-language-changed', locale)).catch(() => {
    // Same-origin storage events also synchronize windows. Local preference is already saved.
    });
  }
}
let connected = false;
export function connectLocaleWindows() {
  if (connected || !isTauri()) return;
  connected = true;
  void invoke('set_ui_language', { locale: getLocale() }).catch(() => {});
  void import('@tauri-apps/api/event').then(({ listen }) => listen('ui-language-changed', event => localeStore.receive(event.payload))).catch(() => { connected = false; });
}
