import { t, getLocale } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { AchievementType, Achievement } from '@/types';
import { motion } from 'framer-motion';
import { progressAchievements } from '@/services/progressAchievements';
import { TaskContext } from '@/contexts/taskContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

const AchievementsPage = () => {
  const {locale}=useLocale();
  const {tasks}=useContext(TaskContext);
  const store=useBusinessSettings();
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const data={tasks,pet:null,achievements:currentUser?.achievements??[],settings:store.settings};
  const ALL_ACHIEVEMENTS=progressAchievements.map(item=>({...item,name:locale==='zh-CN'?item.zh:item.en,description:item.description[locale==='zh-CN'?0:1],isHidden:false,count:store.loading||store.error?null:item.count(data)}));

  const fontFamily = 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif';

  // Check if user has unlocked an achievement
  const isAchievementUnlocked = (achievementId: string): boolean => {
    return currentUser?.achievements?.some(a => a.id === achievementId) || false;
  };

  // Get unlocked achievement details
  const getUnlockedAchievement = (achievementId: string): Achievement | undefined => {
    return currentUser?.achievements?.find(a => a.id === achievementId);
  };

  // Redirect to login if no user
  if (!currentUser) {
    navigate('/login');
    return null;
  }

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Background Image */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        <img
          src="/pet_selection_bg.png"
          alt={t("MotiBuddy Background")}
          style={{ 
            objectFit: 'cover', 
            width: '100%', 
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />
        {/* White overlay with 50% opacity */}
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(255, 255, 255, 0.5)', 
          zIndex: 2 
        }}></div>
      </div>
      
      <div className="w-full min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ 
            position: 'relative', 
            zIndex: 3, 
            backgroundColor: 'rgba(255, 255, 255, 0.9)', 
            borderRadius: '12px',
            boxShadow: '4px 4px 0 #222222',
            border: '2px solid #222222',
            padding: '20px',
            width: '100%',
            maxWidth: '800px'
          }}
        >
        <div className="flex items-center justify-between mb-4">
          <h1 style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            color: '#222222',
            fontFamily: fontFamily
          }}>{t("Achievements")}</h1>
          <motion.button
            onClick={() => navigate('/')}
            style={{
              backgroundColor: '#00CECB',
              color: 'black',
              border: '2px solid #222222',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '2px 2px 0 #222222',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: fontFamily
            }}
            whileHover={{ scale: 1, x: 2, y: 2, boxShadow: '1px 1px 0 #222222' }}
            whileTap={{ scale: 1, x: 3, y: 3, boxShadow: 'none' }}
          >
            <i className="fa-solid fa-arrow-left text-sm"></i>
          </motion.button>
        </div>

        <div className="space-y-4">
          {/* Achievement count */}
          <div style={{
            backgroundColor: '#FFD700',
            padding: '10px',
            borderRadius: '8px',
            boxShadow: '3px 3px 0 #222222',
            border: '2px solid #222222'
          }}>
            <p style={{ 
              color: '#222222', 
              fontSize: '12px', 
              fontWeight: 'bold',
              fontFamily: fontFamily
            }}>{t("You've unlocked")}{' '}<span style={{ color: '#222222', fontWeight: 'bold' }}>{ALL_ACHIEVEMENTS.filter(item=>isAchievementUnlocked(item.id)).length}</span>{' '}{t("out of")}{' '}<span style={{ fontWeight: 'bold' }}>{ALL_ACHIEVEMENTS.length}</span>{' '}{t("achievements")}</p><p style={{fontSize:11,marginTop:8}}>{locale==='zh-CN'?'每枚徽章奖励一次宠物经验，累计经验会提升等级。记录来自真实任务与专注数据。':'Each badge grants pet experience once. Experience raises your pet level. Goals use recorded activity.'}</p>
          </div>

          {/* All achievements grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ALL_ACHIEVEMENTS.map((achievement) => {
              const isUnlocked = isAchievementUnlocked(achievement.id);
              const unlockedAchievement = getUnlockedAchievement(achievement.id);
              const isHidden = achievement.isHidden && !isUnlocked;

              return (
                <div
                  key={achievement.id}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    boxShadow: '3px 3px 0 #222222',
                    border: '2px solid #222222',
                    backgroundColor: isUnlocked ? '#00CECB' : '#f0f0f0',
                    transition: 'all 0.2s ease',
                    width: '100%'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isUnlocked ? 'white' : '#cccccc',
                      color: isUnlocked ? '#222222' : '#999999',
                      border: '1px solid #222222',
                      fontSize: '12px'
                    }}>
                      {isHidden ? (
                        <i className="fa-solid fa-question text-xs"></i>
                      ) : (
                        <i className={achievement.icon || 'fa-solid fa-star'}></i>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 style={{ 
                        fontWeight: 'bold', 
                        color: isUnlocked ? '#222222' : '#999999', 
                        marginBottom: '2px', 
                        fontSize: '11px',
                        fontFamily: fontFamily
                      }}>
                        {isHidden ? '?' : t(achievement.name)}
                      </h3>
                      <p style={{ 
                        fontSize: '9px', 
                        color: isUnlocked ? '#222222' : '#999999',
                        fontFamily: fontFamily
                      }}>
                        {isHidden ? '???' : t(achievement.description)}<br/>{`+${achievement.xp} XP · `}{isUnlocked?(locale==='zh-CN'?'已解锁':'Unlocked'):achievement.count===null?'—':`${Math.min(achievement.count,achievement.goal)} / ${achievement.goal}`}
                      </p>
                      {isUnlocked && unlockedAchievement && (
                        <p style={{ 
                          fontSize: '8px', 
                          color: '#222222', 
                          marginTop: '2px',
                          fontFamily: fontFamily
                        }}>
                          {new Date(unlockedAchievement.unlockedAt).toLocaleDateString(getLocale())}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Back to home button */}
          <motion.button
            onClick={() => navigate('/')}
            style={{
              backgroundColor: '#FF5E5B',
              color: 'black',
              border: '2px solid #222222',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '3px 3px 0 #222222',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.2s ease',
              width: '100%',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              borderRadius: '6px',
              fontFamily: fontFamily
            }}
            whileHover={{ scale: 1, x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
            whileTap={{ scale: 1, x: 4, y: 4, boxShadow: 'none' }}
          >{t("Back to Home")}</motion.button>
        </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AchievementsPage;
