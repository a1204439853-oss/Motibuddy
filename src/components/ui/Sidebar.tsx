import { t, label } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Pet } from '@/types';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/tauri';
import { isTauri } from '@/services/tauriCommands';
import { toast } from 'sonner';

interface SidebarProps {
  activeView: 'tasks' | 'statistics';
  setActiveView: (view: 'tasks' | 'statistics') => void;
  currentUser: User;
  currentPet: Pet;
  isAuthenticated: boolean;
}

const Sidebar = ({ activeView, setActiveView, currentUser, currentPet, isAuthenticated }: SidebarProps) => {
  useLocale();
  const navigate = useNavigate();
  const [widgetVisible, setWidgetVisible] = useState(false);
  
  // Inspirational quotes array
  const quotes = [
    "The secret of getting ahead is getting started. - Mark Twain",
    "Success is the sum of small efforts repeated day in and day out. - Robert Collier",
    "The only way to do great work is to love what you do. - Steve Jobs",
    "Don't watch the clock; do what it does. Keep going. - Sam Levenson",
    "The future belongs to those who prepare for it today. - African Proverb",
    "Believe you can and you're halfway there. - Theodore Roosevelt",
    "The harder I work, the luckier I get. - Gary Player",
    "Motivation is what gets you started. Habit is what keeps you going. - Jim Ryun",
    "Success is not final, failure is not fatal: It is the courage to continue that counts. - Winston Churchill",
    "Your time is limited, don't waste it living someone else's life. - Steve Jobs",
    "The best way to predict the future is to create it. - Abraham Lincoln",
    "Action is the foundational key to all success. - Pablo Picasso",
    "The only limit to our realization of tomorrow will be our doubts of today. - Franklin D. Roosevelt",
    "Start where you are. Use what you have. Do what you can. - Arthur Ashe",
    "Success usually comes to those who are too busy to be looking for it. - Henry David Thoreau",
    "The difference between ordinary and extraordinary is that little extra. - Jimmy Johnson",
    "Don't wait for opportunity, create it. - George Bernard Shaw",
    "The key to success is to start before you're ready. - Marie Forleo",
    "Success is walking from failure to failure with no loss of enthusiasm. - Winston Churchill",
    "The future depends on what you do today. - Mahatma Gandhi",
    "Hard work beats talent when talent doesn't work hard. - Tim Notke",
    "You miss 100% of the shots you don't take. - Wayne Gretzky",
    "Every accomplishment starts with the decision to try. - Gail Devers",
    "The more you sweat in training, the less you bleed in battle. - Navy SEAL Saying",
    "Success doesn't come to you, you go to it. - Marva Collins",
    "The only person you should try to be better than is the person you were yesterday. - Anonymous",
    "Small changes can make a big difference. Start today. - Anonymous",
    "The future is bright for those who believe in the beauty of their dreams. - Eleanor Roosevelt",
    "Don't let yesterday take up too much of today. - Will Rogers",
    "The path to success is to take massive, determined action. - Tony Robbins",
    "Success is not about being the best, it's about being better than you were yesterday. - Anonymous",
    "Your attitude, not your aptitude, will determine your altitude. - Zig Ziglar",
    "The secret to getting things done is to act now, not tomorrow. - Anonymous",
    "Great things never come from comfort zones. - Anonymous",
    "If it doesn't challenge you, it doesn't change you. - Fred DeVito",
    "The only way to achieve the impossible is to believe it is possible. - Charles Kingsleigh",
    "Success is a journey, not a destination. - Ben Sweetland",
    "Do the hard things first. The easy things will take care of themselves. - Brian Tracy",
    "The more disciplined you are, the easier life becomes. - Anonymous",
    "Wake up with determination, go to bed with satisfaction. - Anonymous",
    "Your best teacher is your last mistake. - Ralph Nader",
    "The greatest glory in living lies not in never falling, but in rising every time we fall. - Nelson Mandela"
  ];
  
  // State for current quote index
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  
  // Auto switch quotes every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prevIndex) => (prevIndex + 1) % quotes.length);
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, [quotes.length]);
  
  // Listen for widget visibility changes
  useEffect(() => {
    const checkWidgetVisibility = async () => {
      if (isTauri()) {
        try {
          // Check if widget window exists and is visible
          const widgetWindow = await invoke<boolean>('check_widget_visibility');
          setWidgetVisible(widgetWindow);
        } catch (error) {
          console.error('Failed to check widget visibility:', error);
        }
      }
    };
    
    // Check immediately
    checkWidgetVisibility();
    
    // Set up interval to check every 2 seconds
    const interval = setInterval(checkWidgetVisibility, 2000);
    
    // Listen for user logout event to hide widget
    const handleLogout = async () => {
      console.log('User logged out, hiding widget...');
      if (isTauri()) {
        try {
          await invoke('hide_widget_window');
          setWidgetVisible(false);
          console.log('Widget hidden after logout');
        } catch (error) {
          console.error('Failed to hide widget on logout:', error);
        }
      }
    };
    
    window.addEventListener('user-logout', handleLogout);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('user-logout', handleLogout);
    };
  }, []);

  // Navigation items
  const toggleWidget = async () => {
    console.log('Toggle widget clicked, isAuthenticated:', isAuthenticated);
    
    if (!isAuthenticated) {
      toast.error(t("Please login first to use the desktop widget"));
      return;
    }
    
    const tauriAvailable = isTauri();
    console.log('isTauri():', tauriAvailable);
    
    if (tauriAvailable) {
      try {
        console.log('Calling toggle_widget_window...');
        const isVisible = await invoke<boolean>('toggle_widget_window');
        console.log('toggle_widget_window returned:', isVisible);
        setWidgetVisible(isVisible);
        if (isVisible) {
          toast.success(t("Desktop widget shown"));
        } else {
          toast.success(t("Desktop widget hidden"));
        }
      } catch (error) {
        console.error('Failed to toggle widget:', error);
        toast.error(t('Operation failed: {message}', { message: t((error as Error).message) }));
      }
    } else {
      toast.error(t("Desktop widget is only available in desktop app"));
    }
  };



  const navItems = [
    {
      id: 'tasks',
      label: t("Tasks"),
      icon: 'fa-solid fa-tasks',
      onClick: () => setActiveView('tasks')
    },
    {
      id: 'statistics',
      label: t('Statistics'),
      icon: 'fa-solid fa-chart-bar',
      onClick: () => setActiveView('statistics')
    },
    {
      id: 'profile',
      label: t('Profile & Settings'),
      icon: 'fa-solid fa-user',
      onClick: () => navigate('/profile')
    },
    {
      id: 'widget',
      label: t("Desktop Widget"),
      icon: 'fa-solid fa-window-restore',
      onClick: toggleWidget,
      badge: widgetVisible ? 'Active' : 'Inactive'
    }
  ];
  
  // Get pet mood
  const getPetMood = () => {
    if (!currentPet) return 'neutral';
    
    if (currentPet.health < 30) return 'sick';
    if (currentPet.hunger > 80) return 'hungry';
    if (currentPet.happiness > 70 && currentPet.energy > 70) return 'happy';
    if (currentPet.happiness < 30) return 'sad';
    if (currentPet.energy < 30) return 'tired';
    
    return 'neutral';
  };
  
  // Get pet mood color
  const getPetMoodColor = () => {
    const mood = getPetMood();
    
    switch (mood) {
      case 'happy': return '#00CECB';
      case 'hungry': return '#FF5E5B';
      case 'tired': return '#8A2BE2';
      case 'sad': return '#808080';
      case 'sick': return '#FF0000';
      default: return '#0000FF';
    }
  };
  
  // Get avatar image - use user's avatar if set, otherwise use pet image
  const getAvatarImage = () => {
    // If user has custom avatar, use it
    if (currentUser?.avatar) {
      return currentUser.avatar;
    }
    
    // Otherwise use pet image
    if (!currentPet) return '';
    
    const petType = currentPet.type.toUpperCase();
    
    switch (petType) {
      case 'DOG':
        return '/dog.jpg';
      case 'PANDA':
        return '/panda.jpg';
      case 'CAT':
        return '/cat.jpg';
      case 'BIRD':
        return '/bird.jpg';
      default:
        return '';
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Pet quick info */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '16px',
          borderBottom: '1px solid #222222'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div 
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                overflow: 'hidden',
                marginRight: '10px',
                border: '2px solid #222222',
                boxShadow: '2px 2px 0 #222222',
                cursor: 'pointer'
              }}
              onClick={() => navigate('/profile')}
            >
              <img 
                src={getAvatarImage()} 
                alt={currentUser?.username || currentPet.name} 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>
            <div>
              <p style={{
                fontWeight: 'bold',
                color: '#222222',
                margin: 0,
                fontSize: '16px',
                fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif'
              }}>{currentPet.name}</p>
              <p style={{
                fontSize: '12px',
                color: '#222222',
                margin: '2px 0 0 0',
                fontWeight: 'bold',
                fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif'
              }}>{t("Level")}{' '}{currentPet.level}</p>
            </div>
          </div>
          <span style={{
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 'bold',
            backgroundColor: 'white',
            color: getPetMoodColor(),
            border: '2px solid #222222',
            boxShadow: '2px 2px 0 rgba(0, 0, 0, 0.1)',
            fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
            textTransform: 'capitalize'
          }}>
            {label(getPetMood())}
          </span>
        </div>
        
        {/* Pet quick stats */}
        <div className="mt-4 space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span style={{ color: '#222222', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{t("Health")}</span>
              <span style={{ color: '#222222', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{currentPet.health}/100</span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#222222',
              borderRadius: '9999px',
              border: '1px solid #222222',
              boxShadow: 'inset 1px 1px 0 rgba(0, 0, 0, 0.2)',
              margin: 0,
              padding: 0
            }}>
              <div 
                style={{
                  height: '100%',
                  borderRadius: '9999px',
                  backgroundColor: currentPet.health > 70 ? '#00CECB' : currentPet.health > 30 ? '#FFD700' : '#FF5E5B',
                  width: `${currentPet.health}%`,
                  boxShadow: 'inset -1px 0 0 rgba(0, 0, 0, 0.2)',
                  margin: 0,
                  padding: 0
                }}
              ></div>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between">
              <span style={{ color: '#222222', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{t("Happiness")}</span>
              <span style={{ color: '#222222', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{currentPet.happiness}/100</span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#222222',
              borderRadius: '9999px',
              border: '1px solid #222222',
              boxShadow: 'inset 1px 1px 0 rgba(0, 0, 0, 0.2)',
              margin: 0,
              padding: 0
            }}>
              <div 
                style={{
                  height: '100%',
                  borderRadius: '9999px',
                  backgroundColor: currentPet.happiness > 70 ? '#00CECB' : currentPet.happiness > 30 ? '#FFD700' : '#FF5E5B',
                  width: `${currentPet.happiness}%`,
                  boxShadow: 'inset -1px 0 0 rgba(0, 0, 0, 0.2)',
                  margin: 0,
                  padding: 0
                }}
              ></div>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between">
              <span style={{ color: '#222222', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{t("Hunger")}</span>
              <span style={{ color: '#222222', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{currentPet.hunger}/100</span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#222222',
              borderRadius: '9999px',
              border: '1px solid #222222',
              boxShadow: 'inset 1px 1px 0 rgba(0, 0, 0, 0.2)',
              margin: 0,
              padding: 0
            }}>
              <div 
                style={{
                  height: '100%',
                  borderRadius: '9999px',
                  backgroundColor: currentPet.hunger < 30 ? '#00CECB' : currentPet.hunger < 70 ? '#FFD700' : '#FF5E5B',
                  width: `${currentPet.hunger}%`,
                  boxShadow: 'inset -1px 0 0 rgba(0, 0, 0, 0.2)',
                  margin: 0,
                  padding: 0
                }}
              ></div>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between">
              <span style={{ color: '#222222', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{t("Energy")}</span>
              <span style={{ color: '#222222', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}>{currentPet.energy}/100</span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#222222',
              borderRadius: '9999px',
              border: '1px solid #222222',
              boxShadow: 'inset 1px 1px 0 rgba(0, 0, 0, 0.2)',
              margin: 0,
              padding: 0
            }}>
              <div 
                style={{
                  height: '100%',
                  borderRadius: '9999px',
                  backgroundColor: currentPet.energy > 70 ? '#00CECB' : currentPet.energy > 30 ? '#FFD700' : '#FF5E5B',
                  width: `${currentPet.energy}%`,
                  boxShadow: 'inset -1px 0 0 rgba(0, 0, 0, 0.2)',
                  margin: 0,
                  padding: 0
                }}
              ></div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-3">
        <div className="px-4 mb-3">
          <p style={{
            fontSize: '11px',
            fontWeight: 'bold',
            color: '#222222',
            fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            margin: 0
          }}>{t("Main")}</p>
        </div>
        
        <div className="space-y-2 px-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              style={{
                width: '100%',
                textAlign: 'left' as const,
                padding: '10px 14px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.2s ease',
                backgroundColor: (item.id === 'tasks' || item.id === 'statistics') && activeView === item.id ? '#FF5E5B' : 'transparent',
                color: (item.id === 'tasks' || item.id === 'statistics') && activeView === item.id ? 'white' : '#222222',
                border: '2px solid #222222',
                boxShadow: (item.id === 'tasks' || item.id === 'statistics') && activeView === item.id ? '4px 4px 0 #222222' : 'none',
                fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                if (!((item.id === 'tasks' || item.id === 'statistics') && activeView === item.id)) {
                  e.currentTarget.style.backgroundColor = '#FF5E5B';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
                }
              }}
              onMouseLeave={(e) => {
                if (!((item.id === 'tasks' || item.id === 'statistics') && activeView === item.id)) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#222222';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <i className={`${item.icon} text-base`}></i>
              <span>{item.label}</span>
              
              {item.badge && (
                <span style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  backgroundColor: item.badge === 'Active' ? '#00CECB' : '#808080',
                  color: 'white',
                  border: '1px solid #222222',
                  boxShadow: '1px 1px 0 rgba(0, 0, 0, 0.2)'
                }}>
                  {t(item.badge)}
                </span>
              )}
            </button>
          ))}
          

        </div>
        
        <div className="mt-6 px-4 mb-3">
          <p style={{
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#222222',
            fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            margin: 0
          }}>{t("Achievements")}</p>
        </div>
        
        <div className="px-3 mb-4">
          <button
            onClick={() => navigate('/achievements')}
            style={{
              width: '100%',
              textAlign: 'left' as const,
              padding: '10px 14px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s ease',
              backgroundColor: 'transparent',
              color: '#222222',
              border: '2px solid #222222',
              fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
              fontWeight: 'bold',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FF5E5B';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#222222';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <i className="fa-solid fa-trophy text-base text-amber-500"></i>
            <span>{t("Achievements")}</span>
            <span style={{
              marginLeft: 'auto',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '10px',
              fontWeight: 'bold',
              backgroundColor: '#00CECB',
              color: 'white',
              border: '1px solid #222222',
              boxShadow: '1px 1px 0 rgba(0, 0, 0, 0.2)'
            }}>
              {currentUser.achievements?.length || 0}
            </span>
          </button>
        </div>
      </div>
      
      {/* Inspirational Quote */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '12px',
          borderTop: '1px solid #222222'
        }}
      >
        <div className="flex flex-col">
          <div style={{
            textAlign: 'left',
            padding: '10px',
            maxWidth: '100%'
          }}>
            {(() => {
              const quote = t(quotes[currentQuoteIndex]);
              const parts = quote.split(' - ');
              const quoteText = parts[0];
              const author = parts[1] || '';
              return (
                <>
                  <p style={{
                    fontSize: '11px',
                    fontWeight: 'normal',
                    color: '#222222',
                    margin: 0,
                    fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
                    lineHeight: '1.3',
                    textAlign: 'left'
                  }}>{quoteText}</p>
                  {author && (
                    <p style={{
                      fontSize: '10px',
                      fontWeight: 'normal',
                      color: '#222222',
                      margin: '4px 0 0 0',
                      fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
                      textAlign: 'right'
                    }}>- {author}</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Sidebar;
