import { t, label } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { PetType, SECURITY_QUESTIONS, SecurityQuestionId } from '@/types';
import { generateId } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const PetCreationPage = () => {
  useLocale();
  const [petName, setPetName] = useState<string>('');
  const [selectedPetType, setSelectedPetType] = useState<PetType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Security info modal states
  const [showSecurityPrompt, setShowSecurityPrompt] = useState<boolean>(false);
  const [showSecuritySetup, setShowSecuritySetup] = useState<boolean>(false);
  const [question1Id, setQuestion1Id] = useState<SecurityQuestionId | ''>('');
  const [answer1, setAnswer1] = useState<string>('');
  const [question2Id, setQuestion2Id] = useState<SecurityQuestionId | ''>('');
  const [answer2, setAnswer2] = useState<string>('');
  
  const { currentUser, createPet, updateUserProfile } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // Pet type options
  const petTypes = [
    {
      type: PetType.CAT,
      name: t("Cat"),
      video: '/cat_jump.mp4',
      description: t("Friendly and independent")
    },
    {
      type: PetType.DOG,
      name: t("Dog"),
      video: '/dog_spin.mp4',
      description: t("Energetic and loyal")
    },
    {
      type: PetType.PANDA,
      name: t("Panda"),
      video: '/panda_greet.mp4',
      description: t("Calm and playful")
    },
    {
      type: PetType.BIRD,
      name: t("Bird"),
      video: '/bird_fly.mp4',
      description: t("Cheerful and active")
    }
  ];
  
  const handleCreatePet = async () => {
    if (isLoading) return;
    if (!currentUser) {
      toast.error(t("User not authenticated"));
      navigate('/login');
      return;
    }
    
    if (!petName.trim()) {
      toast.error(t("Please enter a name for your pet"));
      return;
    }
    
    if (!selectedPetType) {
      toast.error(t("Please select a pet type"));
      return;
    }
    
    setIsLoading(true);
    
    // Create new pet
    const newPet = {
      id: generateId(),
      userId: currentUser.id,
      name: petName.trim(),
      type: selectedPetType,
      level: 1,
      experience: 0,
      health: 70,
      happiness: 70,
      // Legacy storage measures hunger; display fullness = 100 - hunger.
      hunger: 30,
      energy: 70,
      lastInteraction: new Date(),
      lastFed: new Date(),
      createdAt: new Date()
    };
    
    try {
      await createPet(newPet);
    } catch (error) {
      toast.error(error instanceof Error ? t(error.message) : t("Your pet could not be saved. Please retry."));
      return;
    } finally { setIsLoading(false); }
    
    toast.success(t("Welcome to MotiBuddy, {name}!", { name: newPet.name }));
    
    // Show security info prompt instead of redirecting immediately
    setShowSecurityPrompt(true);
  };
  
  // Handle setup security info now
  const handleSetupNow = () => {
    setShowSecurityPrompt(false);
    setShowSecuritySetup(true);
  };
  
  // Handle skip security info setup
  const handleSkipSetup = () => {
    setShowSecurityPrompt(false);
    navigate('/');
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
        setShowSecuritySetup(false);
        navigate('/');
      } else {
        toast.error(t("Failed to save security information"));
      }
    } catch (error) {
      toast.error(t("An error occurred. Please try again."));
    }
  };
  
  // Get available questions for second dropdown
  const getAvailableQuestions2 = () => {
    return SECURITY_QUESTIONS.filter(q => q.id !== question1Id);
  };
  
  // Go back to login if no user is authenticated
  if (!currentUser) {
    navigate('/login');
    return null;
  }
  
  const fontFamily = 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif';
  
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'relative', 
            zIndex: 3, 
            backgroundColor: 'rgba(255, 255, 255, 0.9)', 
            borderRadius: '12px',
            boxShadow: '6px 6px 0 #222222',
            border: '3px solid #222222',
            padding: '24px',
            width: '100%',
            maxWidth: '800px'
          }}
        >
          <div className="text-center mb-4">
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#222222', marginBottom: '6px', fontFamily }}>{t("Create Your MotiBuddy")}</h1>
            <p style={{ color: '#222222', fontWeight: 'bold', fontSize: '13px', fontFamily }}>{t("Choose a pet and give it a name to start your journey")}</p>
          </div>
          
          <div className="space-y-5">
            {/* Pet selection */}
            <div className="space-y-3">
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#222222', fontFamily }}>{t("Choose Your Pet")}</h2>
              <div className="flex gap-4 overflow-x-auto py-3 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {petTypes.map((pet) => (
                  <motion.div
                    key={pet.type}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedPetType(pet.type)}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      boxShadow: selectedPetType === pet.type ? '4px 4px 0 #222222' : '2px 2px 0 #222222',
                      border: '2px solid #222222',
                      backgroundColor: selectedPetType === pet.type ? '#00CECB' : '#f0f0f0',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: '160px',
                      flex: '0 0 auto'
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <div style={{
                        width: '130px',
                        height: '130px',
                        borderRadius: '50%',
                        marginBottom: '10px',
                        overflow: 'hidden',
                        border: selectedPetType === pet.type ? '3px solid #222222' : '2px solid #cccccc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'black'
                      }}>
                        <video 
                          src={pet.video} 
                          title={t(pet.name)}
                          className="w-full h-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                          controls={false}
                          controlsList="nodownload nofullscreen noremoteplayback"
                          disablePictureInPicture
                          style={{ pointerEvents: 'none' }}
                        />
                      </div>
                      <h3 style={{ fontWeight: 'bold', color: '#222222', fontSize: '15px', fontFamily }}>{t(pet.name)}</h3>
                      <p style={{ fontSize: '11px', color: '#222222', textAlign: 'center', marginTop: '4px', fontFamily }}>{t(pet.description)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Pet name */}
            <div className="space-y-2">
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#222222', fontFamily }}>{t("Name Your Pet")}</h2>
              <input
                type="text"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '2px solid #222222',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: 'black',
                  outline: 'none',
                  textAlign: 'center',
                  boxShadow: '3px 3px 0 #222222',
                  backgroundColor: 'white',
                  fontFamily
                }}
                placeholder={t("Enter a name for your pet")}
                maxLength={8}
              />
              <p style={{ fontSize: '11px', color: '#222222', textAlign: 'right', fontWeight: 'bold', fontFamily }}>
                {petName.length}{t("/8 characters")}</p>
            </div>
            
            {/* Create button */}
            <motion.button
              onClick={handleCreatePet}
              disabled={isLoading}
              style={{
                backgroundColor: '#FF5E5B',
                color: 'black',
                border: '2px solid #222222',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '4px 4px 0 #222222',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'all 0.2s ease',
                width: '100%',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderRadius: '6px',
                fontFamily
              }}
              whileHover={{ scale: 1, x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
              whileTap={{ scale: 1, x: 4, y: 4, boxShadow: 'none' }}
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin mr-1"></i>{t("Creating your MotiBuddy...")}</>
              ) : (
                t("Create My MotiBuddy")
              )}
            </motion.button>
          </div>
          
          <div className="mt-6 text-center">
            <p style={{ color: '#222222', fontStyle: 'italic', fontWeight: 'bold', fontSize: '12px', fontFamily }}>{t("\"A journey of a thousand tasks begins with a single pet...\"")}</p>
          </div>
        </motion.div>
        
        {/* Security Info Prompt Modal */}
        <AnimatePresence>
          {showSecurityPrompt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                style={{
                  backgroundColor: 'white', borderRadius: '12px', padding: '24px',
                  maxWidth: '400px', width: '100%', border: '3px solid #222222', boxShadow: '6px 6px 0 #222222'
                }}
              >
                <div className="text-center mb-4">
                  <i className="fa-solid fa-shield-halved text-4xl text-green-500 mb-3"></i>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>{t("Set Up Security Info?")}</h2>
                  <p style={{ fontSize: '13px', color: '#666', marginTop: '8px', fontFamily }}>{t("Adding security questions helps you recover your password if you forget it. This step is optional but recommended.")}</p>
                </div>
                <div className="flex gap-3">
                  <motion.button
                    onClick={handleSkipSetup}
                    style={{
                      backgroundColor: '#f0f0f0', color: '#222222', border: '2px solid #222222',
                      padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                      boxShadow: '3px 3px 0 #222222', width: '50%', borderRadius: '6px', fontFamily
                    }}
                    whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                    whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
                  >{t("Later")}</motion.button>
                  <motion.button
                    onClick={handleSetupNow}
                    style={{
                      backgroundColor: '#00CECB', color: 'black', border: '2px solid #222222',
                      padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                      boxShadow: '3px 3px 0 #222222', width: '50%', borderRadius: '6px', fontFamily
                    }}
                    whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                    whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
                  >{t("Set Up Now")}</motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Security Info Setup Modal */}
        <AnimatePresence>
          {showSecuritySetup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 100,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                style={{
                  backgroundColor: 'white', borderRadius: '12px', padding: '24px',
                  maxWidth: '400px', width: '100%', border: '3px solid #222222', boxShadow: '6px 6px 0 #222222'
                }}
              >
                <div className="text-center mb-4">
                  <i className="fa-solid fa-shield-halved text-4xl text-green-500 mb-3"></i>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#222222', fontFamily }}>{t("Security Questions")}</h2>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', fontFamily }}>{t("Choose two questions and provide answers. These will help you recover your account.")}</p>
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
                  <motion.button
                    onClick={() => { setShowSecuritySetup(false); setShowSecurityPrompt(true); }}
                    style={{
                      backgroundColor: '#f0f0f0', color: '#222222', border: '2px solid #222222',
                      padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                      boxShadow: '3px 3px 0 #222222', width: '50%', borderRadius: '6px', fontFamily
                    }}
                    whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                    whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
                  >{t("Back")}</motion.button>
                  <motion.button
                    onClick={handleSaveSecurityInfo}
                    style={{
                      backgroundColor: '#00CECB', color: 'black', border: '2px solid #222222',
                      padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                      boxShadow: '3px 3px 0 #222222', width: '50%', borderRadius: '6px', fontFamily
                    }}
                    whileHover={{ x: 2, y: 2, boxShadow: '2px 2px 0 #222222' }}
                    whileTap={{ x: 4, y: 4, boxShadow: 'none' }}
                  >{t("Save")}</motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PetCreationPage;
