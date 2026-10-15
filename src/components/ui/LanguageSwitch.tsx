import { useLocale } from '@/i18n/react';
import type { Locale } from '@/i18n/core';
import { toast } from 'sonner';

/** Inline device preference; switching never navigates or remounts the current form. */
export default function LanguageSwitch() {
  const { locale, setLocale, t } = useLocale();
  const choose = (next: Locale) => {
    try { setLocale(next); }
    catch { toast.error(t('Language preference could not be saved. Please try again.')); }
  };
  return <div className="language-switch" role="group" aria-label={t('Display language')}>
    <button type="button" lang="zh-CN" aria-label="简体中文" title="简体中文" aria-pressed={locale === 'zh-CN'} onClick={() => choose('zh-CN')}>中</button>
    <span aria-hidden="true">/</span>
    <button type="button" lang="en-US" aria-label="English" title="English" aria-pressed={locale === 'en-US'} onClick={() => choose('en-US')}>英</button>
  </div>;
}
