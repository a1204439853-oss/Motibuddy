import { t } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from 'react';
import Home from "@/pages/Home";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import PetCreationPage from "@/pages/PetCreationPage";
import ProfilePage from "@/pages/ProfilePage";
import AchievementsPage from "@/pages/AchievementsPage";
import { AuthProvider } from "@/contexts/authContext";
import { TaskProvider } from "@/contexts/taskContext";
import { PetProvider } from "@/contexts/petContext";
import { StatisticsProvider } from "@/contexts/statisticsContext";
import { useSafeExit } from '@/hooks/useSafeExit';
import { AuthContext } from '@/contexts/authContext';
import DesktopServices from '@/components/DesktopServices';
import { FocusProvider } from '@/contexts/focusContext';

function SettingsRedirect() {
  const { isAuthenticated } = useContext(AuthContext);
  return <Navigate to={isAuthenticated ? '/profile' : '/login'} replace />;
}

export default function App() {
  useLocale();
  const { closing, cancel } = useSafeExit();
  return (
    <>
    <AuthProvider>
      <FocusProvider>
      <TaskProvider>
        <PetProvider>
          <StatisticsProvider>
            <DesktopServices />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/create-pet" element={<PetCreationPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/achievements" element={<AchievementsPage />} />
              <Route path="/settings" element={<SettingsRedirect />} />
            </Routes>
          </StatisticsProvider>
        </PetProvider>
      </TaskProvider>
      </FocusProvider>
    </AuthProvider>
    {closing && <div role="dialog" aria-modal="true" aria-label={t('Preparing to close')} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(255,255,255,.96)', display: 'grid', placeContent: 'center', textAlign: 'center', gap: 16 }}>
      <p>{t('Waiting for your changes to save…')}</p>
      <button onClick={() => { void cancel(); }}>{t('Cancel exit')}</button>
    </div>}
    </>
  );
}
