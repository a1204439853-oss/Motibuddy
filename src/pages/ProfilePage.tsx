import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { SECURITY_QUESTIONS, SecurityQuestionId } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// Mock bcrypt functions
const mockHash = async (password: string): Promise<string> => {
  return `hashed_${password}`;
};

const mockCompare = async (password: string, hash: string): Promise<boolean> => {
  return hash === `hashed_${password}`;
};

const ProfilePage = () => {
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [avatar, setAvatar] = useState<string>('');
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
  if (!currentUser) {
    navigate('/login');
    return null;
  }
  
  // Handle avatar file upload
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size should be less than 2MB');
        return;
      }
      
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!username || !email) {
      toast.error('Please fill in all required fields');
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
        toast.success('Profile updated successfully');
        setIsEditing(false);
      } else {
        toast.error('Failed to update profile');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
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
      toast.error('Incorrect password. Please try again.');
      return;
    }
    // The former localStorage-only deletion orphaned authoritative files and erased
    // other accounts' caches. Keep the operation fail-closed until A02 is complete.
    toast.error('Account deletion is temporarily unavailable. Your account and saved progress have been preserved.');
  };
  
  // Handle change password
  const handleChangePassword = async () => {
    if (!currentUser) return;
    
    // Verify current password
    const isPasswordCorrect = await mockCompare(currentPassword, currentUser.password);
    if (!isPasswordCorrect) {
      toast.error('Current password is incorrect');
      return;
    }
    
    // Validate new password
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match');
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
        
        toast.success('Password changed successfully');
        setShowChangePassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (error) {
      toast.error('Failed to change password. Please try again.');
    }
  };
  
  // Handle save security info
  const handleSaveSecurityInfo = async () => {
    if (!currentUser) return;
    
    // Validate selections
    if (!question1Id || !answer1.trim() || !question2Id || !answer2.trim()) {
      toast.error('Please fill in both security questions and answers');
      return;
    }
    
    if (question1Id === question2Id) {
      toast.error('Please select two different security questions');
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
        toast.success('Security information saved successfully');
        setShowSecurityInfo(false);
      } else {
        toast.error('Failed to save security information');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    }
  };
  
  // Get available questions for second dropdown (exclude first selection)
  const getAvailableQuestions2 = () => {
    return SECURITY_QUESTIONS.filter(q => q.id !== question1Id);
  };
  
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden' }}>
      {/* Background Image */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        <img
          src="/pet_selection_bg.png"
          alt="MotiBuddy Background"
          style={{ objectFit: 'cover', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.5)', zIndex: 2 }}></div>
      </div>
      
      <div className="w-full min-h-screen flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ 
            position: 'relative', zIndex: 3, backgroundColor: 'rgba(255, 255, 255, 0.9)', 
            borderRadius: '12px', boxShadow: '4px 4px 0 #222222', border: '2px solid #222222',
            padding: '20px', width: '100%', maxWidth: '450px'
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>Your Profile</h1>
            <motion.button
              onClick={() => navigate('/')}
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
                className="w-20 h-20 rounded-full overflow-hidden border-2 border-orange-100 shadow-md mb-3 relative"
                style={{ position: 'relative' }}
              >
                <img 
                  src={avatar || (currentPet ? `/${currentPet.type}.jpg` : '/cat.jpg')} 
                  alt="User avatar" 
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
                      accept="image/*"
                      onChange={handleAvatarChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
              {isEditing && (
                <p style={{ fontSize: '10px', color: '#666', fontFamily }}>
                  Click avatar to change
                </p>
              )}
            </div>
            
            {/* Profile form */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'black', textAlign: 'center', fontFamily }}>
                  Username
                </label>
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'black', textAlign: 'center', fontFamily }}>
                  Email Address
                </label>
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
              
              {/* Action buttons */}
              {isEditing ? (
                <div className="flex gap-2">
                  <motion.button
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                    style={{
                      backgroundColor: '#00CECB', color: 'black', border: '2px solid #222222',
                      padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                      boxShadow: '3px 3px 0 #222222', width: '50%', fontFamily
                    }}
                    whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                    whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
                  >
                    {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Save'}
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
                  >
                    Cancel
                  </motion.button>
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
                  <i className="fa-solid fa-pen-to-square text-sm"></i> Edit Profile
                </motion.button>
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
                <i className="fa-solid fa-lock text-sm"></i> Change Password
              </motion.button>
              
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
                {currentUser.securityInfo ? ' Update Security Info' : ' Set Up Security Info'}
              </motion.button>
              
              {/* Delete Account Button */}
              <div className="pt-4 border-t border-gray-300 mt-4">
                <motion.button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    backgroundColor: '#FF5E5B', color: 'black', border: '2px solid #222222',
                    padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                    boxShadow: '3px 3px 0 #222222', width: '100%', fontFamily
                  }}
                  whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                  whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
                >
                  <i className="fa-solid fa-trash text-sm"></i> Delete Account
                </motion.button>
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
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>Delete Account?</h2>
                <p style={{ fontSize: '13px', color: '#666', marginTop: '8px', fontFamily }}>
                  This action cannot be undone. Enter your password to confirm.
                </p>
              </div>
              <div className="space-y-3 mb-4">
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{
                    width: '100%', padding: '10px 14px', border: '2px solid #222222', borderRadius: '6px',
                    fontSize: '14px', color: 'black', outline: 'none', textAlign: 'center',
                    boxShadow: '3px 3px 0 #222222', fontFamily
                  }}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }} variant="secondary">Cancel</Button>
                <Button onClick={handleDeleteAccount} variant="danger">Delete Account</Button>
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
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>Change Password</h2>
              </div>
              <div className="space-y-3 mb-4">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
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
                  placeholder="New password (min 6 chars)"
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
                  placeholder="Confirm new password"
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
                }} variant="secondary">Cancel</Button>
                <Button onClick={handleChangePassword} variant="primary">Change Password</Button>
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
                  {currentUser.securityInfo ? 'Update Security Info' : 'Set Up Security Info'}
                </h2>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontFamily }}>
                  These questions help you recover your password if you forget it.
                </p>
              </div>
              <div className="space-y-3 mb-4">
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', fontFamily, display: 'block', marginBottom: '4px' }}>Question 1</label>
                  <select
                    value={question1Id}
                    onChange={(e) => setQuestion1Id(e.target.value as SecurityQuestionId)}
                    style={{
                      width: '100%', padding: '8px 12px', border: '2px solid #222222', borderRadius: '6px',
                      fontSize: '12px', color: 'black', outline: 'none', marginBottom: '4px', fontFamily
                    }}
                  >
                    <option value="">Select a question...</option>
                    {SECURITY_QUESTIONS.map(q => (
                      <option key={q.id} value={q.id}>{q.text}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={answer1}
                    onChange={(e) => setAnswer1(e.target.value)}
                    placeholder="Your answer"
                    style={{
                      width: '100%', padding: '8px 12px', border: '2px solid #222222', borderRadius: '6px',
                      fontSize: '12px', color: 'black', outline: 'none', fontFamily
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', fontFamily, display: 'block', marginBottom: '4px' }}>Question 2</label>
                  <select
                    value={question2Id}
                    onChange={(e) => setQuestion2Id(e.target.value as SecurityQuestionId)}
                    style={{
                      width: '100%', padding: '8px 12px', border: '2px solid #222222', borderRadius: '6px',
                      fontSize: '12px', color: 'black', outline: 'none', marginBottom: '4px', fontFamily
                    }}
                  >
                    <option value="">Select a question...</option>
                    {getAvailableQuestions2().map(q => (
                      <option key={q.id} value={q.id}>{q.text}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={answer2}
                    onChange={(e) => setAnswer2(e.target.value)}
                    placeholder="Your answer"
                    style={{
                      width: '100%', padding: '8px 12px', border: '2px solid #222222', borderRadius: '6px',
                      fontSize: '12px', color: 'black', outline: 'none', fontFamily
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setShowSecurityInfo(false)} variant="secondary">Cancel</Button>
                <Button onClick={handleSaveSecurityInfo} variant="primary">Save</Button>
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
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
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
