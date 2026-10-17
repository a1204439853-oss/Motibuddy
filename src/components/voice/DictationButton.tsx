import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { isTauri } from '@/services/tauriCommands';
import { useLocale } from '@/i18n/react';

/** Dictation only: no automatic send, task mutation, recording file, or audio upload. */
export default function DictationButton({ disabled, active, onText }: { disabled: boolean; active: boolean; onText: (text: string) => void }) {
  const { locale } = useLocale();
  const s = (zh: string, en: string) => locale === 'zh-CN' ? zh : en;
  const [recording, setRecording] = useState(false), [error, setError] = useState('');
  const current = useRef<string | null>(null), receive = useRef(onText);
  receive.current = onText;
  const cancel = () => {
    const id = current.current; current.current = null;
    if (id && isTauri()) void invoke('cancel_voice', { requestId: id }).catch(() => {});
    setRecording(false);
  };
  useEffect(() => { if (!active || disabled) cancel(); }, [active, disabled]);
  useEffect(() => { setError(''); return cancel; }, [locale]);
  const start = async () => {
    if (recording) { cancel(); return; }
    if (disabled || !active) return;
    const id = crypto.randomUUID(); current.current = id;
    setError(''); setRecording(true);
    try {
      if (!isTauri()) throw new Error('SPEECH_UNAVAILABLE');
      const text = await invoke<string>('recognize_voice', { locale, requestId: id });
      if (current.current !== id) return;
      if (!text.trim()) throw new Error('SPEECH_NO_RESULT');
      receive.current(text.trim());
    } catch (value) {
      if (current.current !== id) return;
      const code = value instanceof Error ? value.message : String(value);
      setError(code === 'SPEECH_LANGUAGE_MISSING' ? s('请在 Windows 语言设置中安装当前语言的语音识别组件。', 'Install speech recognition for this language in Windows language settings.')
        : code === 'SPEECH_NO_RESULT' ? s('没有听清，请靠近麦克风再试一次。', 'No speech recognized. Move closer to the microphone and retry.')
        : code === 'SPEECH_BUSY' ? s('麦克风正在使用中，请稍后重试。', 'Speech input is in use. Please retry shortly.')
        : s('语音输入不可用，请检查麦克风权限、默认输入设备和系统语音组件。', 'Speech input is unavailable. Check microphone permission, default input device and installed speech components.'));
    } finally { if (current.current === id) { current.current = null; setRecording(false); } }
  };
  return <><button type="button" className="mb-agent-voice-button" aria-pressed={recording} disabled={disabled} onClick={() => void start()} title={s('识别文字会先放入输入框，检查后再发送。', 'Recognized text goes into the input for review before sending.')}><i className={`fa-solid ${recording ? 'fa-stop' : 'fa-microphone'}`} aria-hidden="true" />{recording ? s('取消录音', 'Cancel voice') : s('语音输入', 'Voice input')}</button>
    {recording && <span role="status" className="mb-agent-voice-status">{s('正在聆听，说完停顿即可；最长 25 秒。', 'Listening. Pause to finish; up to 25 seconds.')}</span>}
    {error && <span className="mb-agent-voice-error" role="alert">{error}</span>}</>;
}
