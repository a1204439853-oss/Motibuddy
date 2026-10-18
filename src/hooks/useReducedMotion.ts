import { useSyncExternalStore } from 'react';

let preference: MediaQueryList | undefined;
function media() {
  if (typeof window === 'undefined' || !window.matchMedia) return undefined;
  return preference ??= window.matchMedia('(prefers-reduced-motion: reduce)');
}
const snapshot = () => media()?.matches ?? false;
const subscribe = (listener: () => void) => {
  const query = media();
  query?.addEventListener('change', listener);
  return () => query?.removeEventListener('change', listener);
};

/** Unlike the animation library's initial snapshot, this follows live OS changes. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
