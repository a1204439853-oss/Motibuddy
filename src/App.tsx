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

export default function App() {
  return (
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
  );
}
