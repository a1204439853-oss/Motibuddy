import { useNavigate } from 'react-router-dom';
import { useLocale } from '@/i18n/react';
import LanguageSwitch from './LanguageSwitch';

export default function PublicHeader({ onLogin }: { onLogin?: () => void }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  return <header className="public-topbar">
    <img className="public-topbar-logo" src="/logo.png" alt={t('MotiBuddy Logo')} />
    <div className="public-topbar-actions">
      <LanguageSwitch />
      <button type="button" className="public-login" onClick={onLogin ?? (() => navigate('/login'))}>{t('LOGIN')}</button>
    </div>
  </header>;
}
