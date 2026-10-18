import { t, label } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { SECURITY_QUESTIONS, SecurityQuestionId } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import LanguageSwitch from '@/components/ui/LanguageSwitch';
import NotificationTest from '@/components/ui/NotificationTest';
import ProfileSurvey from '@/components/agent/ProfileSurvey';
import PersonalitySetting from '@/components/ui/PersonalitySetting';
import SoundSettings from '@/components/ui/SoundSettings';
import {prepareAgentImage} from '@/services/agentClient';
import { invoke } from '@tauri-apps/api/tauri';
import { isTauri } from '@/services/tauriCommands';

// Mock bcrypt functions
const mockHash = async (password: string): Promise<string> => {
  return `hashed_${password}`;
};

const mockCompare = async (password: string, hash: string): Promise<boolean> => {
  return hash === `hashed_${password}`;
};

const ProfilePage = () => {
  const [surveyOpen,setSurveyOpen]=useState(false);
  useLocale();
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [avatar, setAvatar] = useState<string>('');
  const [avatarBusy,setAvatarBusy]=useState(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Delete account states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>('');
  
  // Change password states
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  
  // Security info states
  const [showSecurityInfo, setShowSecurityInfo] = useState<boolean>(false);
  const [question1Id, setQuestion1Id] = useState<SecurityQuestionId | ''>('');
  const [answer1, setAnswer1] = useState<string>('');
  const [question2Id, setQuestion2Id] = useState<SecurityQuestionId | ''>('');
  const [answer2, setAnswer2] = useState<string>('');
  
  const { currentUser, updateUserProfile, currentPet, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const fontFamily = 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif';
  
  // Initialize form with current user data
  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username);
      setEmail(currentUser.email);
      setAvatar(currentUser.avatar || '');
      
      // Load existing security info if available
      if (currentUser.securityInfo) {
        if (currentUser.securityInfo.question1) {
          setQuestion1Id(currentUser.securityInfo.question1.questionId);
          setAnswer1(currentUser.securityInfo.question1.answer);
        }
        if (currentUser.securityInfo.question2) {
          setQuestion2Id(currentUser.securityInfo.question2.questionId);
          setAnswer2(currentUser.securityInfo.question2.answer);
        }
      }
    }
  }, [currentUser]);
  
  // Redirect if no user is authenticated
  useEffect(() => { if (!currentUser) navigate('/login', { replace: true }); }, [currentUser, navigate]);
  if (!currentUser) return null;
  
  // Handle avatar file upload
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error(t("Image size should be less than 2MB"));
        return;
      }
      
      setAvatarBusy(true);try{setAvatar(await prepareAgentImage(file,400));}catch{toast.error(t('Please choose an image file'));}finally{setAvatarBusy(false);}
    }
  };

  const handleSaveProfile = async () => {
    if (!username || !email) {
      toast.error(t("Please fill in all required fields"));
      return;
    }
    
    setIsLoading(true);
    
    try {
      const success = await updateUserProfile({
        username,
        email,
        avatar
      });
      
      if (success) {
        toast.success(t("Profile updated successfully"));
        setIsEditing(false);
      } else {
        toast.error(t("Failed to update profile"));
      }
    } catch (error) {
      toast.error(t("An error occurred. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle delete account - requires password verification
  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    
    // Verify password
    const isPasswordCorrect = await mockCompare(deletePassword, currentUser.password);
    if (!isPasswordCorrect) {
      toast.error(t("Incorrect password. Please try again."));
      return;
    }
    // The former localStorage-only deletion orphaned authoritative files and erased
    // other accounts' caches. Keep the operation fail-closed until A02 is complete.
    toast.error(t("Account deletion is temporarily unavailable. Your account and saved progress have been preserved."));
  };
  
  // Handle change password
  const handleChangePassword = async () => {
    if (!currentUser) return;
    
    // Verify current password
    const isPasswordCorrect = await mockCompare(currentPassword, currentUser.password);
    if (!isPasswordCorrect) {
      toast.error(t("Current password is incorrect"));
      return;
    }
    
    // Validate new password
    if (newPassword.length < 6) {
      toast.error(t("New password must be at least 6 characters"));
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      toast.error(t("New passwords do not match"));
      return;
    }
    
    try {
      // Hash new password
      const hashedNewPassword = await mockHash(newPassword);
      
      // Update user password
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const userIndex = users.findIndex((u: any) => u.id === currentUser.id);
      
      if (userIndex !== -1) {
        users[userIndex].password = hashedNewPassword;
        localStorage.setItem('users', JSON.stringify(users));
        
        // Update current user
        await updateUserProfile({ password: hashedNewPassword });
        
        toast.success(t("Password changed successfully"));
        setShowChangePassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (error) {
      toast.error(t("Failed to change password. Please try again."));
    }
  };
  
  // Handle save security info
  const handleSaveSecurityInfo = async () => {
    if (!currentUser) return;
    
    // Validate selections
    if (!question1Id || !answer1.trim() || !question2Id || !answer2.trim()) {
      toast.error(t("Please fill in both security questions and answers"));
      return;
    }
    
    if (question1Id === question2Id) {
      toast.error(t("Please select two different security questions"));
      return;
    }
    
    try {
      const securityInfo = {
        question1: { questionId: question1Id, answer: answer1.trim() },
        question2: { questionId: question2Id, answer: answer2.trim() }
      };
      
      // Update user security info
      const success = await updateUserProfile({ securityInfo });
      
      if (success) {
        toast.success(t("Security information saved successfully"));
        setShowSecurityInfo(false);
      } else {
        toast.error(t("Failed to save security information"));
      }
    } catch (error) {
      toast.error(t("An error occurred. Please try again."));
    }
  };
  
  // Get available questions for second dropdown (exclude first selection)
  const getAvailableQuestions2 = () => {
    return SECURITY_QUESTIONS.filter(q => q.id !== question1Id);
  };
  
  return (
    <div className="profile-page" style={{ position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Background Image */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        <img
          src="/pet_selection_bg.png"
          alt={t("MotiBuddy Background")}
          style={{ objectFit: 'cover', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.5)', zIndex: 2 }}></div>
      </div>
      
      <div className="w-full min-h-screen flex items-center justify-center p-4">
        <motion.div className="profile-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          style={{ 
            position: 'relative', zIndex: 3, backgroundColor: 'rgba(255, 255, 255, 0.9)', 
            borderRadius: '12px', boxShadow: '4px 4px 0 #222222', border: '2px solid #222222',
            padding: '20px', width: '100%', maxWidth: '760px', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto'
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>{t('Profile & Settings')}</h1>
            <motion.button
              onClick={() => navigate('/')}
              aria-label={t('Back to Home')}
              style={{
                backgroundColor: '#00CECB', color: 'black', border: '2px solid #222222',
                padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '2px 2px 0 #222222', fontFamily
              }}
              whileHover={{ x: 2, y: 2, boxShadow: '1px 1px 0 #222222' }}
              whileTap={{ x: 3, y: 3, boxShadow: 'none' }}
            >
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </motion.button>
          </div>
          
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div 
                className="neo-profile-avatar w-20 h-20 rounded-full overflow-hidden border-2 mb-3 relative"
                style={{ position: 'relative' }}
              >
                <img 
                  src={avatar || (currentPet ? `/${currentPet.type}.jpg` : '/cat.jpg')} 
                  alt={t("User avatar")}
                  className="w-full h-full object-cover"
                />
                {/* Edit overlay */}
                {isEditing && (
                  <label 
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <i className="fa-solid fa-camera text-white text-xl"></i>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleAvatarChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
              {isEditing && (
                <p style={{ fontSize: '10px', color: '#666', fontFamily }}>{t("Click avatar to change")}</p>
              )}
            </div>
            
            {/* Profile form */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'black', textAlign: 'center', fontFamily }}>{t("Username")}</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={!isEditing}
                  style={{
                    width: '100%', padding: '8px 12px', border: '2px solid #222222', borderRadius: '6px',
                    fontSize: '12px', color: 'black', outline: 'none', textAlign: 'center',
                    backgroundColor: isEditing ? 'white' : '#f0f0f0', boxShadow: isEditing ? '2px 2px 0 #222222' : 'none', fontFamily
                  }}
                />
              </div>
              
              <div className="space-y-1">
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'black', textAlign: 'center', fontFamily }}>{t("Email Address")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isEditing}
                  style={{
                    width: '100%', padding: '8px 12px', border: '2px solid #222222', borderRadius: '6px',
                    fontSize: '12px', color: 'black', outline: 'none', textAlign: 'center',
                    backgroundColor: isEditing ? 'white' : '#f0f0f0', boxShadow: isEditing ? '2px 2px 0 #222222' : 'none', fontFamily
                  }}
                />
              </div>
              
              <section className="settings-group"><h2>{t("Pet assistant")}</h2><PersonalitySetting /></section><SoundSettings/>
              <NotificationTest/>
              <button className="personality-setting" onClick={()=>setSurveyOpen(true)}>{t('Display language')==='显示语言'?'我的兴趣与目标 · 编辑画像':'Interests & goals · Edit preferences'}</button>
              {surveyOpen&&<ProfileSurvey force onClose={()=>setSurveyOpen(false)}/>}
              <div className="profile-language-row">
                <span>{t('Display language')}</span>
                <LanguageSwitch />
              </div>

              {/* Action buttons */}
              {isEditing ? (
                <div className="flex gap-2">
                  <motion.button
                    onClick={handleSaveProfile}
                    disabled={isLoading||avatarBusy}
                    style={{
                      backgroundColor: '#00CECB', color: 'black', border: '2px solid #222222',
                      padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                      boxShadow: '3px 3px 0 #222222', width: '50%', fontFamily
                    }}
                    whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                    whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
                  >
                    {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : t("Save")}
                  </motion.button>
                  <motion.button
                    onClick={() => { setIsEditing(false); setUsername(currentUser.username); setEmail(currentUser.email); }}
                    style={{
                      backgroundColor: '#f0f0f0', color: '#222222', border: '2px solid #222222',
                      padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                      boxShadow: '3px 3px 0 #222222', width: '50%', fontFamily
                    }}
                    whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                    whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
                  >{t("Cancel")}</motion.button>
                </div>
              ) : (
                <motion.button
                  onClick={() => setIsEditing(true)}
                  style={{
                    backgroundColor: '#00CECB', color: 'black', border: '2px solid #222222',
                    padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                    boxShadow: '3px 3px 0 #222222', width: '100%', fontFamily
                  }}
                  whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                  whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
                >
                  <i className="fa-solid fa-pen-to-square text-sm"></i>{' '}{t("Edit Profile")}</motion.button>
              )}
              
              {/* Change Password Button */}
              <motion.button
                onClick={() => setShowChangePassword(true)}
                style={{
                  backgroundColor: '#FFD700', color: 'black', border: '2px solid #222222',
                  padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                  boxShadow: '3px 3px 0 #222222', width: '100%', fontFamily, marginTop: '8px'
                }}
                whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
              >
                <i className="fa-solid fa-lock text-sm"></i>{' '}{t("Change Password")}</motion.button>
              
              {/* Security Info Button */}
              <motion.button
                onClick={() => setShowSecurityInfo(true)}
                style={{
                  backgroundColor: currentUser.securityInfo ? '#00CECB' : '#f0f0f0', 
                  color: 'black', border: '2px solid #222222',
                  padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                  boxShadow: '3px 3px 0 #222222', width: '100%', fontFamily, marginTop: '8px'
                }}
                whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
              >
                <i className="fa-solid fa-shield-halved text-sm"></i>
                {' '}{t(currentUser.securityInfo ? 'Update Security Info' : 'Set Up Security Info')}
              </motion.button>
              
              {/* Delete Account Button */}
              <div className="pt-4 border-t border-gray-300 mt-4 flex gap-3">
                <button type="button" className="profile-logout" onClick={() => {
                  logout();
                  if (isTauri()) void invoke('hide_widget_window').catch(() => {
                    toast.error(t('The desktop widget could not be hidden. Please close it manually.'));
                  });
                  toast.success(t('You have been logged out'));
                  navigate('/login');
                }}><i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i> {t('Logout')}</button>
                <motion.button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    backgroundColor: '#FF5E5B', color: 'black', border: '2px solid #222222',
                    padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                    boxShadow: '3px 3px 0 #222222', width: '50%', fontFamily
                  }}
                  whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                  whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
                >
                  <i className="fa-solid fa-trash text-sm"></i>{' '}{t("Delete Account")}</motion.button>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Delete Account Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <Modal onClose={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}>
              <div className="text-center mb-4">
                <i className="fa-solid fa-triangle-exclamation text-4xl text-red-500 mb-3"></i>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>{t("Delete Account?")}</h2>
                <p style={{ fontSize: '13px', color: '#666', marginTop: '8px', fontFamily }}>{t("This action cannot be undone. Enter your password to confirm.")}</p>
              </div>
              <div className="space-y-3 mb-4">
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder={t("Enter your password")}
                  style={{
                    width: '100%', padding: '10px 14px', border: '2px solid #222222', borderRadius: '6px',
                    fontSize: '14px', color: 'black', outline: 'none', textAlign: 'center',
                    boxShadow: '3px 3px 0 #222222', fontFamily
                  }}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }} variant="secondary">{t("Cancel")}</Button>
                <Button onClick={handleDeleteAccount} variant="danger">{t("Delete Account")}</Button>
              </div>
            </Modal>
          )}
        </AnimatePresence>
        
        {/* Change Password Modal */}
        <AnimatePresence>
          {showChangePassword && (
            <Modal onClose={() => { 
              setShowChangePassword(false); 
              setCurrentPassword(''); 
              setNewPassword(''); 
              setConfirmNewPassword(''); 
            }}>
              <div className="text-center mb-4">
                <i className="fa-solid fa-lock text-4xl text-yellow-500 mb-3"></i>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>{t("Change Password")}</h2>
              </div>
              <div className="space-y-3 mb-4">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t("Current password")}
                  style={{
                    width: '100%', padding: '10px 14px', border: '2px solid #222222', borderRadius: '6px',
                    fontSize: '14px', color: 'black', outline: 'none', textAlign: 'center',
                    boxShadow: '3px 3px 0 #222222', fontFamily
                  }}
                />
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
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder={t("Confirm new password")}
                  style={{
                    width: '100%', padding: '10px 14px', border: '2px solid #222222', borderRadius: '6px',
                    fontSize: '14px', color: 'black', outline: 'none', textAlign: 'center',
                    boxShadow: '3px 3px 0 #222222', fontFamily
                  }}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={() => { 
                  setShowChangePassword(false); 
                  setCurrentPassword(''); 
                  setNewPassword(''); 
                  setConfirmNewPassword(''); 
                }} variant="secondary">{t("Cancel")}</Button>
                <Button onClick={handleChangePassword} variant="primary">{t("Change Password")}</Button>
              </div>
            </Modal>
          )}
        </AnimatePresence>
        
        {/* Security Info Modal */}
        <AnimatePresence>
          {showSecurityInfo && (
            <Modal onClose={() => setShowSecurityInfo(false)}>
              <div className="text-center mb-4">
                <i className="fa-solid fa-shield-halved text-4xl text-green-500 mb-3"></i>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>
                  {currentUser.securityInfo ? t("Update Security Info") : t("Set Up Security Info")}
                </h2>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontFamily }}>{t("These questions help you recover your password if you forget it.")}</p>
              </div>
              <div className="space-y-3 mb-4">
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', fontFamily, display: 'block', marginBottom: '4px' }}>{t("Question 1")}</label>
                  <select
                    value={question1Id}
                    onChange={(e) => setQuestion1Id(e.target.value as SecurityQuestionId)}
                    style={{
                      width: '100%', padding: '8px 12px', border: '2px solid #222222', borderRadius: '6px',
                      fontSize: '12px', color: 'black', outline: 'none', marginBottom: '4px', fontFamily
                    }}
                  >
                    <option value="">{t("Select a question...")}</option>
                    {SECURITY_QUESTIONS.map(q => (
                      <option key={q.id} value={q.id}>{t(q.text)}</option>
                    ))}
                  </select>
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
                  <label style={{ fontSize: '12px', fontWeight: 'bold', fontFamily, display: 'block', marginBottom: '4px' }}>{t("Question 2")}</label>
                  <select
                    value={question2Id}
                    onChange={(e) => setQuestion2Id(e.target.value as SecurityQuestionId)}
                    style={{
                      width: '100%', padding: '8px 12px', border: '2px solid #222222', borderRadius: '6px',
                      fontSize: '12px', color: 'black', outline: 'none', marginBottom: '4px', fontFamily
                    }}
                  >
                    <option value="">{t("Select a question...")}</option>
                    {getAvailableQuestions2().map(q => (
                      <option key={q.id} value={q.id}>{t(q.text)}</option>
                    ))}
                  </select>
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
                <Button onClick={() => setShowSecurityInfo(false)} variant="secondary">{t("Cancel")}</Button>
                <Button onClick={handleSaveSecurityInfo} variant="primary">{t("Save")}</Button>
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Helper components
const Modal = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}
    onClick={onClose}
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
      {children}
    </motion.div>
  </motion.div>
);

const Button = ({ 
  onClick, 
  children, 
  variant = 'primary' 
}: { 
  onClick: () => void; 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'danger' 
}) => {
  useLocale();
  const colors = {
    primary: '#00CECB',
    secondary: '#f0f0f0',
    danger: '#FF5E5B'
  };
  
  return (
    <motion.button
      onClick={onClick}
      style={{
        backgroundColor: colors[variant], color: 'black', border: '2px solid #222222',
        padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
        boxShadow: '3px 3px 0 #222222', width: '50%', borderRadius: '6px',
        fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif'
      }}
      whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
      whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
    >
      {children}
    </motion.button>
  );
};

export default ProfilePage;
