import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Pet, PetType } from '@/types';

interface NavbarProps {
  currentUser: User;
  currentPet: Pet;
  onLogout: () => void;
  onToggleSidebar: () => void;
}

const Navbar = ({ currentUser, currentPet, onLogout, onToggleSidebar }: NavbarProps) => {
  const navigate = useNavigate();
  
  // Get pet mood emoji
  const getPetMoodEmoji = () => {
    if (!currentPet) return '';
    
    if (currentPet.health < 30) return '🤒';
    if (currentPet.hunger > 80) return '🍖';
    if (currentPet.happiness > 70 && currentPet.energy > 70) return '😊';
    if (currentPet.happiness < 30) return '😢';
    if (currentPet.energy < 30) return '😴';
    
    return '😐';
  };
  
  // Get pet image based on type
  const getPetImage = () => {
    if (!currentPet) return '';
    
    switch (currentPet.type) {
      case PetType.DOG:
        return '/dog.jpg';
      case PetType.PANDA:
        return '/panda.jpg';
      case PetType.CAT:
        return '/cat.jpg';
      case PetType.BIRD:
        return '/bird.jpg';
      default:
        return '';
    }
  };
  
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  
  return (
    <div style={{
      backgroundColor: 'white',
      height: '48px',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 100,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'  
    }}>
      <div className="flex items-center">
        <button
          onClick={onToggleSidebar}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            padding: '8px',
            cursor: 'pointer',
            marginRight: '12px',
            fontSize: '18px',
            color: '#222222'
          }}
        >
          <i className="fa-solid fa-bars"></i>
        </button>
        
        <div className="flex items-center">
          <div>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#222222',
              fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif'
            }}>MotiBuddy</h1>
            <p style={{
              fontSize: '11px',
              color: '#222222',
              margin: '2px 0 0 0',
              fontWeight: 'bold'
            }}>
              <span>{currentPet.name}</span> {getPetMoodEmoji()} • Level {currentPet.level}
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        <div className="relative">
          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#222222'
            }}
            title="Settings"
          >
            <i className="fa-solid fa-gear"></i>
          </button>
          
          {showSettingsMenu && (
            <div style={{
              position: 'absolute',
              right: 0,
              marginTop: '8px',
              width: '180px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '4px 4px 0 #222222',
              border: '2px solid #222222',
              zIndex: 50
            }}>
              <div style={{
                padding: '8px 0'
              }}>
                <button 
                  onClick={() => {
                    navigate('/profile');
                    setShowSettingsMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left' as const,
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#222222',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fa-solid fa-user text-base"></i>
                  <span>Profile</span>
                </button>
                <button 
                  onClick={() => {
                    navigate('/profile');
                    setShowSettingsMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left' as const,
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#222222',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fa-solid fa-cog text-base"></i>
                  <span>Settings</span>
                </button>
              </div>
              <div style={{
                padding: '4px 0',
                borderTop: '1px solid #222222'
              }}>
                <button 
                  onClick={() => {
                    onLogout();
                    setShowSettingsMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left' as const,
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#FF5E5B',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fa-solid fa-sign-out-alt text-base"></i>
                  <span>LOGOUT</span>
                </button>
              </div>
            </div>
          )}
        </div>
        

      </div>
    </div>
  );
};

export default Navbar;
