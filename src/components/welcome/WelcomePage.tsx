import { t, getLocale } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import React from 'react';
import PublicHeader from '@/components/ui/PublicHeader';

interface WelcomePageProps {
  onStart: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onStart }) => {
  useLocale();
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          src="../../../welcome_bg.mp4"
          title={t("MotiBuddy Background")}
          className="w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          controls={false}
          style={{ 
            objectFit: 'cover', 
            width: '100vw', 
            height: '100vh',
            position: 'absolute',
            top: '0',
            left: '0',
            zIndex: 0,
            pointerEvents: 'none'
          }}
        />

      </div>
      
      {/* Content */}
      <div className="absolute inset-0 z-10">
        <PublicHeader onLogin={onStart} />
        
        {/* Centered Text */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
          textAlign: 'center'
        }}>
          <h1 style={{
            color: 'white',
            fontSize: '48px',
            fontWeight: 'bold',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
            fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif'
          }}>{getLocale() === 'zh-CN' ? <>让每一天，都有<span style={{ color: '#FF5E5B' }}>陪伴</span>与<span style={{ color: '#00CECB' }}>动力</span>。</> : <>Let <span style={{ color: '#FF5E5B' }}>Moti</span>vation Be Your <span style={{ color: '#00CECB' }}>Buddy</span></>}</h1>
        </div>
        
        {/* Button */}
        <button
          onClick={onStart}
          style={{
            backgroundColor: '#FF5E5B',
            color: 'white',
            border: '2px solid #222222',
            padding: '10px 28px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.2s ease',
            zIndex: 100,
            boxShadow: '4px 4px 0 #222222',
            position: 'absolute',
            bottom: '60px',
            left: '50%',
            transform: 'translateX(-50%)'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate(calc(-50% + 2px), 2px)';
              e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(-50%)';
              e.currentTarget.style.boxShadow = '4px 4px 0 #222222';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translate(calc(-50% + 4px), 4px)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translate(calc(-50% + 2px), 2px)';
              e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
            }}
        >{t("ADOPT A PET NOW")}</button>
      </div>
    </div>
  );
};
