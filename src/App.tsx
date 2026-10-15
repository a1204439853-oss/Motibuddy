import { Routes, Route } from "react-router-dom";
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

export default function App() {
  const { closing, cancel } = useSafeExit();
  return (
    <>
    <AuthProvider>
      <TaskProvider>
        <PetProvider>
          <StatisticsProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/create-pet" element={<PetCreationPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/achievements" element={<AchievementsPage />} />
            </Routes>
          </StatisticsProvider>
        </PetProvider>
      </TaskProvider>
    </AuthProvider>
    {closing && <div role="dialog" aria-modal="true" aria-label="正在退出" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(255,255,255,.96)', display: 'grid', placeContent: 'center', textAlign: 'center', gap: 16 }}>
      <p>正在等待保存完成，请稍候…</p>
      <button onClick={() => { void cancel(); }}>取消退出</button>
    </div>}
    </>
  );
}
