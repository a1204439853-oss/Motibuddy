import { useNavigate } from 'react-router-dom';
import { useLocale } from '@/i18n/react';
import { Pet } from '@/types';

interface NavbarProps {
  currentPet: Pet;
  onToggleSidebar: () => void;
}

const Navbar = ({ currentPet, onToggleSidebar }: NavbarProps) => {
  const { t } = useLocale();
  const navigate = useNavigate();
  const getPetMoodEmoji = () => {
    if (currentPet.health < 30) return '🤒';
    if (currentPet.hunger > 80) return '🍖';
    if (currentPet.happiness > 70 && currentPet.energy > 70) return '😊';
    if (currentPet.happiness < 30) return '😢';
    if (currentPet.energy < 30) return '😴';
    return '😐';
  };

  return <div style={{
    backgroundColor: 'white', height: '48px', padding: '0 20px', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', zIndex: 100,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  }}>
    <div className="flex items-center">
      <button onClick={onToggleSidebar} aria-label={t('Toggle navigation')} style={{
        backgroundColor: 'transparent', border: 'none', padding: '8px', cursor: 'pointer',
        marginRight: '12px', fontSize: '18px', color: '#222222',
      }}><i className="fa-solid fa-bars" aria-hidden="true"></i></button>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>MotiBuddy</h1>
        <p style={{ fontSize: '11px', color: '#222222', margin: '2px 0 0 0', fontWeight: 'bold' }}>
          <span>{currentPet.name}</span> {getPetMoodEmoji()}{' '}{t('• Level')}{' '}{currentPet.level}
        </p>
      </div>
    </div>
    <button type="button" onClick={() => navigate('/profile')} title={t('Profile & Settings')} aria-label={t('Profile & Settings')} style={{
      backgroundColor: 'transparent', border: 'none', padding: '8px', cursor: 'pointer', fontSize: '18px', color: '#222222',
    }}><i className="fa-solid fa-gear" aria-hidden="true"></i></button>
  </div>;
};

export default Navbar;
