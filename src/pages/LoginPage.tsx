import { t, label } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { SECURITY_QUESTIONS } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import PublicHeader from '@/components/ui/PublicHeader';

// Mock bcrypt functions
const mockHash = async (password: string): Promise<string> => {
  return `hashed_${password}`;
};

const mockCompare = async (password: string, hash: string): Promise<boolean> => {
  return hash === `hashed_${password}`;
};

const LoginPage = () => {
  useLocale();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showRegister, setShowRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [securityStep, setSecurityStep] = useState<'email' | 'questions' | 'reset'>('email');
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const { login, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  const fontFamily = 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast.error(t("Please fill in all fields"));
      return;
    }
    
    setIsLoading(true);
    
    try {
      const success = await login(formData.email, formData.password);
      
      if (success) {
        toast.success(t("Login successful!"));
        navigate('/');
      } else {
        toast.error(t("Invalid email or password"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? t(error.message) : t("Login failed. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle forgot password - step 1: find user by email
  const handleFindUser = () => {
    if (!forgotEmail) {
      toast.error(t("Please enter your email"));
      return;
    }
    
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find((u: any) => u.email === forgotEmail);
    
    if (!user) {
      toast.error(t("No account found with this email"));
      return;
    }
    
    if (!user.securityInfo || !user.securityInfo.question1 || !user.securityInfo.question2) {
      toast.error(t("This account has no security questions set up. Please contact support."));
      return;
    }
    
    setFoundUser(user);
    setSecurityStep('questions');
  };

  // Handle verify security answers
  const handleVerifyAnswers = () => {
    if (!foundUser) return;
    
    const q1Correct = foundUser.securityInfo.question1.answer.toLowerCase() === answer1.toLowerCase();
    const q2Correct = foundUser.securityInfo.question2.answer.toLowerCase() === answer2.toLowerCase();
    
    if (!q1Correct || !q2Correct) {
      toast.error(t("Incorrect answers. Please try again."));
      return;
    }
    
    setSecurityStep('reset');
  };

  // Handle reset password
  const handleResetPassword = async () => {
    if (!foundUser) return;
    
    if (newPassword.length < 6) {
      toast.error(t("Password must be at least 6 characters"));
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error(t("Passwords do not match"));
      return;
    }
    
    try {
      const hashedPassword = await mockHash(newPassword);
      
      // Update user password
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const userIndex = users.findIndex((u: any) => u.id === foundUser.id);
      
      if (userIndex !== -1) {
        users[userIndex].password = hashedPassword;
        localStorage.setItem('users', JSON.stringify(users));
        
        toast.success(t("Password reset successfully! Please login with your new password."));
        
        // Close modal and reset
        setShowForgotPassword(false);
        setSecurityStep('email');
        setForgotEmail('');
        setFoundUser(null);
        setAnswer1('');
        setAnswer2('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      toast.error(t("Failed to reset password. Please try again."));
    }
  };

  // Get question text by ID
  const getQuestionText = (questionId: string) => {
    const question = SECURITY_QUESTIONS.find(q => q.id === questionId);
    return question ? t(question.text) : '';
  };

  if (showRegister) {
    return <RegisterPage onSwitchToLogin={() => setShowRegister(false)} />;
  }

  return (
    <div className="neo-auth" style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <PublicHeader onLogin={() => document.querySelector<HTMLInputElement>('input[name="email"]')?.focus()} />
      {/* Background Video */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        <video
          src="../../login_bg.mp4"
          title={t("Login Background")}
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
        <div className="neo-auth-panel" style={{ width: '100%', maxWidth: '320px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            marginBottom: '20px', 
            textAlign: 'center', 
            color: '#222222',
            fontFamily
          }}>MotiBuddy</h1>
          
          <h2 style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            marginBottom: '20px', 
            textAlign: 'center', 
            color: '#222222',
            fontFamily
          }}>{t("Login")}</h2>
          
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
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
                textAlign: 'center',
                fontFamily
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
                  textAlign: 'center',
                  fontFamily
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
                textAlign: 'center',
                fontFamily
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
                  textAlign: 'center',
                  fontFamily
                }}
                placeholder={t("Enter your password")}
              />
              {/* Forgot Password Link - inside password box */}
              <div style={{ textAlign: 'right', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  style={{
                    color: '#00CECB',
                    fontWeight: 'bold',
                    textDecoration: 'underline',
                    background: 'none',
                    border: 'none',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontFamily
                  }}
                >{t("Forgot Password?")}</button>
              </div>
            </div>
            
            {/* Login Button */}
            <div style={{ marginTop: '16px', marginBottom: '20px' }}>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  backgroundColor: '#00CECB',
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
                  textAlign: 'center',
                  fontFamily
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
                {isLoading ? t("Logging in...") : t("LOGIN")}
              </button>
            </div>
          </form>
          
          {/* Register Link */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p style={{ color: '#222222', fontWeight: 'bold', fontSize: '14px', fontFamily }}>{t("Don't have an account?")}</p>
            <Link to="/register">
              <button
                style={{
                  color: '#00CECB',
                  fontWeight: 'bold',
                  textDecoration: 'underline',
                  marginTop: '8px',
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily
                }}
              >{t("Create Account")}</button>
            </Link>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}
            onClick={() => setShowForgotPassword(false)}
          >
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              style={{
                backgroundColor: 'white', borderRadius: '12px', padding: '24px',
                maxWidth: '400px', width: '100%', border: '3px solid #222222', boxShadow: '6px 6px 0 #222222'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Step 1: Enter Email */}
              {securityStep === 'email' && (
                <>
                  <div className="text-center mb-4">
                    <i className="fa-solid fa-lock-open text-4xl text-yellow-500 mb-3"></i>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>{t("Forgot Password?")}</h2>
                    <p style={{ fontSize: '13px', color: '#666', marginTop: '8px', fontFamily }}>{t("Enter your email to verify your identity")}</p>
                  </div>
                  <div className="space-y-3 mb-4">
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder={t("Enter your email")}
                      style={{
                        width: '100%', padding: '10px 14px', border: '2px solid #222222', borderRadius: '6px',
                        fontSize: '14px', color: 'black', outline: 'none', textAlign: 'center',
                        boxShadow: '3px 3px 0 #222222', fontFamily
                      }}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowForgotPassword(false)}
                      style={{
                        backgroundColor: '#f0f0f0', color: '#222222', border: '2px solid #222222',
                        padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                        boxShadow: '3px 3px 0 #222222', width: '50%', borderRadius: '6px', fontFamily
                      }}
                    >{t("Cancel")}</button>
                    <button
                      onClick={handleFindUser}
                      style={{
                        backgroundColor: '#00CECB', color: 'black', border: '2px solid #222222',
                        padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                        boxShadow: '3px 3px 0 #222222', width: '50%', borderRadius: '6px', fontFamily
                      }}
                    >{t("Continue")}</button>
                  </div>
                </>
              )}

              {/* Step 2: Answer Security Questions */}
              {securityStep === 'questions' && foundUser && (
                <>
                  <div className="text-center mb-4">
                    <i className="fa-solid fa-shield-halved text-4xl text-green-500 mb-3"></i>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>{t("Security Questions")}</h2>
                    <p style={{ fontSize: '13px', color: '#666', marginTop: '8px', fontFamily }}>{t("Answer your security questions to reset your password")}</p>
                  </div>
                  <div className="space-y-3 mb-4">
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', fontFamily, display: 'block', marginBottom: '4px' }}>
                        {getQuestionText(foundUser.securityInfo.question1.questionId)}
                      </label>
                      <input
                        type="text"
                        value={answer1}
                        onChange={(e) => setAnswer1(e.target.value)}
                        placeholder={t("Your answer")}
                        style={{
                          width: '100%', padding: '8px 12px', border: '2px solid #222222', borderRadius: '6px',
                          fontSize: '12px', color: 'black', outline: 'none', fontFamily
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', fontFamily, display: 'block', marginBottom: '4px' }}>
                        {getQuestionText(foundUser.securityInfo.question2.questionId)}
                      </label>
                      <input
                        type="text"
                        value={answer2}
                        onChange={(e) => setAnswer2(e.target.value)}
                        placeholder={t("Your answer")}
                        style={{
                          width: '100%', padding: '8px 12px', border: '2px solid #222222', borderRadius: '6px',
                          fontSize: '12px', color: 'black', outline: 'none', fontFamily
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setSecurityStep('email'); setFoundUser(null); }}
                      style={{
                        backgroundColor: '#f0f0f0', color: '#222222', border: '2px solid #222222',
                        padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                        boxShadow: '3px 3px 0 #222222', width: '50%', borderRadius: '6px', fontFamily
                      }}
                    >{t("Back")}</button>
                    <button
                      onClick={handleVerifyAnswers}
                      style={{
                        backgroundColor: '#00CECB', color: 'black', border: '2px solid #222222',
                        padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                        boxShadow: '3px 3px 0 #222222', width: '50%', borderRadius: '6px', fontFamily
                      }}
                    >{t("Verify")}</button>
                  </div>
                </>
              )}

              {/* Step 3: Reset Password */}
              {securityStep === 'reset' && (
                <>
                  <div className="text-center mb-4">
                    <i className="fa-solid fa-key text-4xl text-blue-500 mb-3"></i>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>{t("Reset Password")}</h2>
                    <p style={{ fontSize: '13px', color: '#666', marginTop: '8px', fontFamily }}>{t("Enter your new password")}</p>
                  </div>
                  <div className="space-y-3 mb-4">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t("New password (min 6 chars)")}
                      style={{
                        width: '100%', padding: '10px 14px', border: '2px solid #222222', borderRadius: '6px',
                        fontSize: '14px', color: 'black', outline: 'none', textAlign: 'center',
                        boxShadow: '3px 3px 0 #222222', fontFamily
                      }}
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t("Confirm new password")}
                      style={{
                        width: '100%', padding: '10px 14px', border: '2px solid #222222', borderRadius: '6px',
                        fontSize: '14px', color: 'black', outline: 'none', textAlign: 'center',
                        boxShadow: '3px 3px 0 #222222', fontFamily
                      }}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setSecurityStep('questions'); }}
                      style={{
                        backgroundColor: '#f0f0f0', color: '#222222', border: '2px solid #222222',
                        padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                        boxShadow: '3px 3px 0 #222222', width: '50%', borderRadius: '6px', fontFamily
                      }}
                    >{t("Back")}</button>
                    <button
                      onClick={handleResetPassword}
                      style={{
                        backgroundColor: '#00CECB', color: 'black', border: '2px solid #222222',
                        padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                        boxShadow: '3px 3px 0 #222222', width: '50%', borderRadius: '6px', fontFamily
                      }}
                    >{t("Reset Password")}</button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// RegisterPage component is imported separately
import RegisterPage from './RegisterPage';

export default LoginPage;
