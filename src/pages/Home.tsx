import { useContext, useState } from 'react';
import { AuthContext } from '@/contexts/authContext';
import { WelcomePage } from '../components/welcome/WelcomePage';
import LoginPage from './LoginPage';
import MainApp from './MainApp';

export default function Home() {
  const { isAuthenticated } = useContext(AuthContext);
  const [showWelcome, setShowWelcome] = useState(true);
  
  const handleStart = () => {
    setShowWelcome(false);
  };
  
  if (isAuthenticated) {
    return <MainApp />;
  }
  
  if (showWelcome) {
    return <WelcomePage onStart={handleStart} />;
  }
  
  return <LoginPage />;
}