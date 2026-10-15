import { t, label } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { toast } from 'sonner';
import PublicHeader from '@/components/ui/PublicHeader';

interface RegisterProps {
  onSwitchToLogin?: () => void;
}

const RegisterPage: React.FC<RegisterProps> = ({ onSwitchToLogin }) => {
  useLocale();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if all fields are filled
    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      toast.error(t("Please fill in all fields"));
      return;
    }
    
    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      toast.error(t("Passwords do not match"));
      return;
    }
    
    // Check password length
    if (formData.password.length < 6) {
      toast.error(t("Password must be at least 6 characters long"));
      return;
    }
    
    // Check if password contains both letters and numbers
    const hasLetter = /[a-zA-Z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    
    if (!hasLetter || !hasNumber) {
      toast.error(t("Password must contain both letters and numbers"));
      return;
    }
    
    setIsLoading(true);
    
    try {
      const success = await register(formData.username, formData.email, formData.password);
      
      if (success) {
        toast.success(t("Registration successful! Please log in."));
        if (onSwitchToLogin) onSwitchToLogin();
        else navigate('/login');
      } else {
        toast.error(t("Username or email already exists"));
      }
    } catch (error) {
      toast.error(t("Registration failed. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <PublicHeader onLogin={onSwitchToLogin} />
      {/* Background Video */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        <video
          src="../../login_bg.mp4"
          title={t("Register Background")}
          autoPlay
          loop
          muted
          playsInline
          controls={false}
          style={{ 
            objectFit: 'cover', 
            width: '100%', 
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />
        {/* Overlay with 50% opacity */}
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
      
      {/* Content */}
      <div style={{ 
        position: 'relative', 
        zIndex: 3, 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '76px 20px 24px'
      }}>
        <div style={{ width: '100%', maxWidth: '320px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            marginBottom: '20px', 
            textAlign: 'center', 
            color: '#222222'
          }}>MotiBuddy</h1>
          
          <h2 style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            marginBottom: '20px', 
            textAlign: 'center', 
            color: '#222222'
          }}>{t("Create Account")}</h2>
          
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            {/* Username Input */}
            <div style={{ 
              padding: '12px', 
              border: '2px solid black', 
              marginBottom: '12px', 
              backgroundColor: 'rgba(255, 255, 255, 0.8)'
            }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: 'bold', 
                marginBottom: '8px', 
                color: 'black', 
                textAlign: 'center'
              }}>{t("Username")}</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '2px solid black',
                  padding: '8px 12px',
                  fontSize: '14px',
                  color: 'black',
                  width: '100%',
                  outline: 'none',
                  textAlign: 'center'
                }}
                placeholder={t("Enter your username")}
              />
            </div>
            
            {/* Email Input */}
            <div style={{ 
              padding: '12px', 
              border: '2px solid black', 
              marginBottom: '12px', 
              backgroundColor: 'rgba(255, 255, 255, 0.8)'
            }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: 'bold', 
                marginBottom: '8px', 
                color: 'black', 
                textAlign: 'center'
              }}>{t("Email")}</label>
              <input
                type="text"
                name="email"
                value={formData.email}
                onChange={handleChange}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '2px solid black',
                  padding: '8px 12px',
                  fontSize: '14px',
                  color: 'black',
                  width: '100%',
                  outline: 'none',
                  textAlign: 'center'
                }}
                placeholder={t("Enter your email")}
              />
            </div>
            
            {/* Password Input */}
            <div style={{ 
              padding: '12px', 
              border: '2px solid black', 
              marginBottom: '12px', 
              backgroundColor: 'rgba(255, 255, 255, 0.8)'
            }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: 'bold', 
                marginBottom: '8px', 
                color: 'black', 
                textAlign: 'center'
              }}>{t("Password")}</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '2px solid black',
                  padding: '8px 12px',
                  fontSize: '14px',
                  color: 'black',
                  width: '100%',
                  outline: 'none',
                  textAlign: 'center'
                }}
                placeholder={t("Enter your password")}
              />
            </div>
            
            {/* Confirm Password Input */}
            <div style={{ 
              padding: '12px', 
              border: '2px solid black', 
              marginBottom: '12px', 
              backgroundColor: 'rgba(255, 255, 255, 0.8)'
            }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: 'bold', 
                marginBottom: '8px', 
                color: 'black', 
                textAlign: 'center'
              }}>{t("Confirm Password")}</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '2px solid black',
                  padding: '8px 12px',
                  fontSize: '14px',
                  color: 'black',
                  width: '100%',
                  outline: 'none',
                  textAlign: 'center'
                }}
                placeholder={t("Confirm your password")}
              />
            </div>
            
            {/* Register Button */}
            <div style={{ marginTop: '16px', marginBottom: '20px' }}>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  backgroundColor: '#FF5E5B',
                  color: 'black',
                  border: '2px solid #222222',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '3px 3px 0 #222222',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s ease',
                  width: '100%',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translate(2px, 2px)';
                  e.currentTarget.style.boxShadow = '1px 1px 0 #222222';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translate(0, 0)';
                  e.currentTarget.style.boxShadow = '3px 3px 0 #222222';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translate(3px, 3px)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translate(2px, 2px)';
                  e.currentTarget.style.boxShadow = '1px 1px 0 #222222';
                }}
              >
                {t(isLoading ? 'Creating account...' : 'REGISTER')}
              </button>
            </div>
          </form>
          
          {/* Login Link */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p style={{ color: '#222222', fontWeight: 'bold', fontSize: '14px' }}>{t("Already have an account?")}</p>
            {onSwitchToLogin ? (
              <button
                onClick={onSwitchToLogin}
                style={{
                  color: '#FF5E5B',
                  fontWeight: 'bold',
                  textDecoration: 'underline',
                  marginTop: '8px',
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >{t("Login")}</button>
            ) : (
              <Link to="/login">
                <button
                  style={{
                    color: '#FF5E5B',
                    fontWeight: 'bold',
                    textDecoration: 'underline',
                    marginTop: '8px',
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >{t("Login")}</button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
