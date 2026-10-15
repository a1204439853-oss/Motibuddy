import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n/core';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import { isTauri } from '@/services/tauriCommands';
import { applicationWrites } from '@/services/writeBarrier';

export function useSafeExit() {
  const [closing, setClosing] = useState(false);
  const generation = useRef(0);
  const cancel = async () => {
    generation.current++;
    try {
      await invoke('cancel_shutdown');
      applicationWrites.resume();
      setClosing(false);
    } catch { toast.error(t('Could not cancel exit. Please wait for pending saves.')); }
  };
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<string>('prepare-exit', event => {
      if (disposed) return;
      const version = ++generation.current;
      setClosing(true);
      void applicationWrites.closeAndDrain().then(async () => {
        if (disposed || version !== generation.current) return;
        await invoke('complete_shutdown', { requestId: event.payload });
      }).catch(async () => {
        if (disposed || version !== generation.current) return;
        await cancel();
        toast.error(t('Some saves could not finish. Review the saved progress before exiting.'));
      });
    }).then(dispose => { if (disposed) dispose(); else unlisten = dispose; }).catch(() => {
      if (!disposed) toast.error(t('Safe exit is unavailable. Reopen the application before making changes.'));
    });
    return () => { disposed = true; generation.current++; unlisten?.(); };
  }, []);
  return { closing, cancel };
}
