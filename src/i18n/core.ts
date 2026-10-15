import { zhCN } from './messages.ts';

export type Locale = 'en-US' | 'zh-CN';
export const LOCALE_KEY = 'motibuddy.ui.locale';
export const isLocale = (value: unknown): value is Locale => value === 'en-US' || value === 'zh-CN';
export interface LocaleStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** A device preference, independent of account/session/business records. */
export class LocaleStore {
  private locale: Locale = 'en-US';
  private storage: LocaleStorage;
  private listeners = new Set<() => void>();
  constructor(storage: LocaleStorage) {
    this.storage = storage;
    try { const value = storage.getItem(LOCALE_KEY); if (isLocale(value)) this.locale = value; } catch { /* Keep the app usable when preferences are unreadable. */ }
  }
  getSnapshot = () => this.locale;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  receive = (value: unknown) => {
    if (!isLocale(value) || value === this.locale) return;
    this.locale = value;
    this.listeners.forEach(listener => listener());
  };
  set = (locale: Locale) => {
    if (!isLocale(locale)) throw new Error('Invalid locale');
    // Persist first; a failed write must not claim the preference was remembered.
    this.storage.setItem(LOCALE_KEY, locale);
    this.receive(locale);
  };
}

const browserStorage: LocaleStorage = {
  getItem: key => typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
  setItem: (key, value) => { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); },
};
export const localeStore = new LocaleStore(browserStorage);
export const getLocale = localeStore.getSnapshot;

export function translate(message: string, params: Record<string, string | number> = {}, locale: Locale = getLocale()): string {
  const template = locale === 'zh-CN' ? zhCN[message] ?? message : message;
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (placeholder, key: string) => Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : placeholder);
}
export const t = translate;
export function label(value: string): string {
  const labels: Record<string, string> = { 'in-progress': 'In Progress', pending: 'Pending', completed: 'Completed', overdue: 'Overdue', low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent', cat: 'Cat', dog: 'Dog', panda: 'Panda', bird: 'Bird', neutral: 'Neutral', happy: 'Happy', hungry: 'Hungry', tired: 'Tired', sad: 'Sad', sick: 'Sick' };
  return t(labels[value] ?? value);
}

function applyDocumentLocale() {
  if (typeof document !== 'undefined') document.documentElement.lang = getLocale();
}
applyDocumentLocale();
localeStore.subscribe(applyDocumentLocale);
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === LOCALE_KEY) localeStore.receive(event.newValue);
});
