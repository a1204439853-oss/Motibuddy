import React from 'react';

interface WelcomePageProps {
  onStart: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          src="../../../welcome_bg.mp4"
          title="MotiBuddy Background" 
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
            zIndex: -1,
            pointerEvents: 'none'
          }}
        />

      </div>
      
      {/* Content */}
      <div className="absolute inset-0 z-10">
        {/* Navigation Bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '7vh',
          backgroundColor: 'rgba(255, 255, 255, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          zIndex: 100
        }}>
          {/* Logo */}
          <div style={{
            display: 'flex',
            alignItems: 'center'
          }}>
            <img
              src="../../../logo.png"
              alt="MotiBuddy Logo"
              style={{
                height: '80%',
                maxHeight: '5.6vh',
                width: 'auto'
              }}
            />
          </div>
          
          {/* Login Button */}
          <button
            onClick={onStart}
            style={{
              color: 'black',
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'Arial Rounded MT Bold, Helvetica, sans-serif',
              textDecoration: 'underline'
            }}>
            LOGIN
          </button>
        </div>
        
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
          }}>Let <span style={{ color: '#FF5E5B' }}>Moti</span>vation Be Your <span style={{ color: '#00CECB' }}>Buddy</span></h1>
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
        >
          ADOPT A PET NOW
        </button>
      </div>
    </div>
  );
};