import { t } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useContext, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { AuthContext } from '@/contexts/authContext';
import { PetContext } from '@/contexts/petContext';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {useBusinessSettings} from '@/hooks/useBusinessSettings';
import {personalityBubble} from '@/services/petPersonality';
import { thinkingLine } from '@/services/agentConversation';

// Video type definitions
const VIDEOS = {
  IDLE: 'idle',
  FEEDING: 'feeding',
  PLAYING: 'playing',
  SICK: 'sick',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
  RANDOM: 'random'
} as const;

type VideoType = typeof VIDEOS[keyof typeof VIDEOS];

// Priority for video switching (higher = more important)
const PRIORITY: Record<VideoType, number> = {
  [VIDEOS.IDLE]: 1,
  [VIDEOS.SICK]: 2,
  [VIDEOS.RANDOM]: 3,
  [VIDEOS.FEEDING]: 4,
  [VIDEOS.PLAYING]: 4,
  [VIDEOS.COMPLETED]: 5,
  [VIDEOS.OVERDUE]: 5
};

const PetDisplay = ({ agentMessageId = 0 }: { agentMessageId?: number }) => {
  const {locale}=useLocale();
  const personalityStore=useBusinessSettings();
  const { currentPet } = useContext(AuthContext);
  const { interactWithPet, feedPet, playWithPet, getPetDialogue } = useContext(PetContext);

  // UI states
  const [petDialogue, setRawDialogue] = useState('');
  const speechStyle=useRef({personality:personalityStore.settings.petPersonality,locale});speechStyle.current={personality:personalityStore.settings.petPersonality,locale};
  const setPetDialogue=(text:string,mood?:string)=>setRawDialogue(personalityBubble(speechStyle.current.personality,mood??(/think|脑|思考|小精灵|答案|问题/.test(text)?'thinking':/full|饱/.test(text)?'fed':/tired|累/.test(text)?'tired':getPetMood()),speechStyle.current.locale));
  const [showDialogue, setShowDialogue] = useState(false);

  // Video state
  const [activeVideo, setActiveVideo] = useState<VideoType>(VIDEOS.IDLE);
  const [randomVideoVariant, setRandomVideoVariant] = useState(1);

  // Refs for video elements - use a single ref object
  const videoRefs = useRef<Record<VideoType, HTMLVideoElement | null>>({
    [VIDEOS.IDLE]: null,
    [VIDEOS.FEEDING]: null,
    [VIDEOS.PLAYING]: null,
    [VIDEOS.SICK]: null,
    [VIDEOS.COMPLETED]: null,
    [VIDEOS.OVERDUE]: null,
    [VIDEOS.RANDOM]: null
  });

  // Flag to track if interaction video is playing
  const isInteractionPlayingRef = useRef(false);
  const isProcessingActionRef = useRef(false);
  const agentMessageRef = useRef(agentMessageId);
  const agentThinkingUntil = useRef(0);
  const dialogueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideDialogueAfter = useCallback((milliseconds: number) => {
    if (dialogueTimer.current) clearTimeout(dialogueTimer.current);
    dialogueTimer.current = setTimeout(() => setShowDialogue(false), milliseconds);
  }, []);
  useEffect(() => () => { if (dialogueTimer.current) clearTimeout(dialogueTimer.current); }, []);

  // Get font family from CSS variable - use handwritten font
  const fontFamily = 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif';

  // Get pet mood
  const getPetMood = useCallback(() => {
    if (!currentPet) return 'neutral';
    if (currentPet.health < 30) return 'sick';
    if (currentPet.hunger > 80) return 'hungry';
    if (currentPet.happiness > 70 && currentPet.energy > 70) return 'happy';
    if (currentPet.happiness < 30) return 'sad';
    if (currentPet.energy < 30) return 'tired';
    return 'neutral';
  }, [currentPet]);

  // Check if pet is in negative mood
  const isNegativeMood = useCallback(() => {
    const mood = getPetMood();
    return ['sick', 'hungry', 'sad', 'tired'].includes(mood);
  }, [getPetMood]);

  // Get video URL - 使用相对路径，在Tauri和浏览器中都适用
  const getVideoSrc = useCallback((type: VideoType) => {
    if (!currentPet) return '';
    const petType = currentPet.type;

    let videoFileName = '';
    switch (type) {
      case VIDEOS.IDLE: videoFileName = `${petType}_idle.mp4`; break;
      case VIDEOS.FEEDING: videoFileName = `${petType}_feed.mp4`; break;
      case VIDEOS.PLAYING: videoFileName = `${petType}_play.mp4`; break;
      case VIDEOS.SICK: videoFileName = `${petType}_sick.mp4`; break;
      case VIDEOS.COMPLETED: videoFileName = `task_complete_${petType}.mp4`; break;
      case VIDEOS.OVERDUE: videoFileName = `task_overdue_${petType}.mp4`; break;
      case VIDEOS.RANDOM:
        videoFileName = `${petType}_random${randomVideoVariant}.mp4`;
        break;
      default: return '';
    }

    // 使用相对路径，在Tauri和浏览器中都适用
    const videoPath = `./${videoFileName}`;
    return videoPath;
  }, [currentPet, randomVideoVariant]);

  // Check if can switch to new video
  const canSwitchTo = useCallback((newVideo: VideoType) => {
    // 如果正在播放交互视频，不允许切换
    if (isInteractionPlayingRef.current) {
      return false;
    }

    const currentPriority = PRIORITY[activeVideo];
    const newPriority = PRIORITY[newVideo];

    return newPriority > currentPriority;
  }, [activeVideo]);

  // Get busy message
  const getBusyMessage = useCallback(() => {
    const messages: Record<VideoType, string> = {
      [VIDEOS.IDLE]: "Give me a moment...",
      [VIDEOS.SICK]: "I'm not feeling well...",
      [VIDEOS.FEEDING]: "I'm eating right now!",
      [VIDEOS.PLAYING]: "I'm playing right now!",
      [VIDEOS.COMPLETED]: "Celebrating!",
      [VIDEOS.OVERDUE]: "Oh no!",
      [VIDEOS.RANDOM]: "Just a moment..."
    };
    return messages[activeVideo] || "I'm busy right now!";
  }, [activeVideo]);

  // Play a specific video
  const playVideo = useCallback((videoType: VideoType) => {
    const video = videoRefs.current[videoType];
    if (video) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {});
      }
    }
  }, []);

  // Switch video immediately without transition
  const switchVideo = useCallback((newVideo: VideoType) => {
    if (newVideo === VIDEOS.RANDOM) setRandomVideoVariant(Math.random() < 0.5 ? 1 : 2);
    // 先停止当前正在播放的视频
    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    });

    // 更新交互播放标志
    const interactionVideos: readonly VideoType[] = [VIDEOS.FEEDING, VIDEOS.PLAYING, VIDEOS.RANDOM, VIDEOS.COMPLETED, VIDEOS.OVERDUE];
    const isInteraction = interactionVideos.includes(newVideo);
    isInteractionPlayingRef.current = isInteraction;

    // 切换视频
    setActiveVideo(newVideo);

    // 延迟一点时间确保状态更新后再播放视频
    setTimeout(() => {
      const video = videoRefs.current[newVideo];
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    }, 100);
  }, []);

  // Handle video ended
  const handleVideoEnded = useCallback((videoType: VideoType) => {
    // Only handle non-looping videos
    if (videoType === VIDEOS.IDLE || videoType === VIDEOS.SICK) return;

    // Only process if this is the currently active video
    if (videoType !== activeVideo) return;

    // Clear interaction flag
    isInteractionPlayingRef.current = false;

    // Return to appropriate loop video
    const nextVideo = isNegativeMood() ? VIDEOS.SICK : VIDEOS.IDLE;
    switchVideo(nextVideo);
  }, [activeVideo, isNegativeMood, switchVideo]);

  // Handle feed
  const handleFeed = useCallback(async () => {
    // First check video priority
    if (!canSwitchTo(VIDEOS.FEEDING)) {
      setPetDialogue(getBusyMessage(),'busy');
      setShowDialogue(true);
      hideDialogueAfter(3000);
      return;
    }

    // Set processing flag to prevent mood effect from interfering
    isProcessingActionRef.current = true;

    try {
      // Try to feed
      const result = await feedPet();

      if (!result.success) {
        setPetDialogue(result.message);
        setShowDialogue(true);
        hideDialogueAfter(4000);
        return;
      }

      // Success - play video and show dialogue
      switchVideo(VIDEOS.FEEDING);
      setPetDialogue(getPetDialogue('fed'),'fed');
      setShowDialogue(true);
      hideDialogueAfter(4000);
    } catch (error) {
      toast.error(error instanceof Error ? t(error.message) : t("Pet changes were not saved. Please retry."));
    } finally {
      // Clear processing flag after a short delay to allow state updates to settle
      setTimeout(() => {
        isProcessingActionRef.current = false;
      }, 500);
    }
  }, [canSwitchTo, getBusyMessage, feedPet, getPetDialogue, switchVideo]);

  // Handle play
  const handlePlay = useCallback(async () => {
    // First check video priority
    if (!canSwitchTo(VIDEOS.PLAYING)) {
      setPetDialogue(getBusyMessage(),'busy');
      setShowDialogue(true);
      hideDialogueAfter(3000);
      return;
    }

    // Set processing flag to prevent mood effect from interfering
    isProcessingActionRef.current = true;

    try {
      // Try to play
      const result = await playWithPet();

      if (!result.success) {
        setPetDialogue(result.message);
        setShowDialogue(true);
        hideDialogueAfter(4000);
        return;
      }

      // Success - play video and show dialogue
      switchVideo(VIDEOS.PLAYING);
      setPetDialogue(getPetDialogue('play'),'play');
      setShowDialogue(true);
      hideDialogueAfter(4000);
    } catch (error) {
      toast.error(error instanceof Error ? t(error.message) : t("Pet changes were not saved. Please retry."));
    } finally {
      // Clear processing flag after a short delay to allow state updates to settle
      setTimeout(() => {
        isProcessingActionRef.current = false;
      }, 500);
    }
  }, [canSwitchTo, getBusyMessage, playWithPet, getPetDialogue, switchVideo]);

  // Handle pet click
  const handlePetClick = useCallback(async () => {
    if (!canSwitchTo(VIDEOS.RANDOM)) {
      setPetDialogue(getBusyMessage(),'busy');
      setShowDialogue(true);
      hideDialogueAfter(3000);
      return;
    }

    try { await interactWithPet(); }
    catch { toast.error(t("Pet changes were not saved. Please retry.")); return; }
    setPetDialogue(getPetDialogue('interaction'),'interaction');
    switchVideo(VIDEOS.RANDOM);
    setShowDialogue(true);
    hideDialogueAfter(4000);
  }, [canSwitchTo, getBusyMessage, interactWithPet, getPetDialogue, switchVideo]);

  useEffect(() => {
    if (!currentPet || agentMessageId === agentMessageRef.current) return;
    agentMessageRef.current = agentMessageId;
    agentThinkingUntil.current = Date.now() + 6000;
    setPetDialogue(thinkingLine(),'thinking');
    setShowDialogue(true);
    hideDialogueAfter(6000);
    if (canSwitchTo(VIDEOS.RANDOM)) switchVideo(VIDEOS.RANDOM);
    // Same daily interaction rule as clicking the pet; no task-completion rewards are granted.
    void interactWithPet().catch(() => toast.error(t('Pet changes were not saved. Please retry.')));
  }, [agentMessageId, currentPet, canSwitchTo, switchVideo, hideDialogueAfter, interactWithPet]);

  // Check for completed/overdue tasks and show appropriate videos
  useEffect(() => {
    if (!currentPet || isProcessingActionRef.current) return;

    const checkFlags = () => {
      // Check if there's a completed task flag
      const completedFlag = localStorage.getItem('pet_show_completed');
      if (completedFlag) {
        localStorage.removeItem('pet_show_completed');
        if (canSwitchTo(VIDEOS.COMPLETED)) {
          switchVideo(VIDEOS.COMPLETED);
          setPetDialogue(getPetDialogue('happy'),'happy');
          setShowDialogue(true);
          hideDialogueAfter(4000);
        }
        return;
      }

      // Check if there's an overdue task flag
      const overdueFlag = localStorage.getItem('pet_show_overdue');
      if (overdueFlag) {
        localStorage.removeItem('pet_show_overdue');
        if (canSwitchTo(VIDEOS.OVERDUE)) {
          switchVideo(VIDEOS.OVERDUE);
          setPetDialogue(getPetDialogue('sad'),'sad');
          setShowDialogue(true);
          hideDialogueAfter(4000);
        }
        return;
      }
    };

    checkFlags();
    const interval = setInterval(checkFlags, 1000);
    return () => clearInterval(interval);
  }, [switchVideo, canSwitchTo, getPetDialogue, currentPet]);

  // Play video when activeVideo changes - useLayoutEffect ensures DOM is updated
  useLayoutEffect(() => {
    const tryPlayVideo = (attempts = 0) => {
      const video = videoRefs.current[activeVideo];

      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else if (attempts < 15) {
        setTimeout(() => tryPlayVideo(attempts + 1), 100);
      }
    };

    // 只有当视频类型不是IDLE或SICK时才强制播放
    if (activeVideo !== VIDEOS.IDLE && activeVideo !== VIDEOS.SICK) {
      tryPlayVideo();
    }
  }, [activeVideo]);

  useEffect(()=>{if(showDialogue)setPetDialogue('', 'interaction');},[personalityStore.settings.petPersonality,locale]);
  // Random dialogue
  useEffect(() => {
    if (!currentPet) return;
    const interval = setInterval(() => {
      if (Date.now() >= agentThinkingUntil.current && Math.random() < 0.3) {
        setPetDialogue(getPetDialogue());
        setShowDialogue(true);
        hideDialogueAfter(4000);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentPet, getPetDialogue]);



  if (!currentPet) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p style={{ fontFamily }}>{t("Loading your pet...")}</p>
      </div>
    );
  }

  const petMood = getPetMood();

  const statusConfig: Record<string, { icon: string; text: string; bg: string }> = {
    happy: { icon: 'fa-smile', text: t("is feeling happy!"), bg: '#00CECB' },
    hungry: { icon: 'fa-utensils', text: t("is hungry! Feed them."), bg: '#FFD700' },
    tired: { icon: 'fa-bed', text: t("is tired. Let them rest."), bg: '#FF5E5B' },
    sad: { icon: 'fa-frown', text: t("is feeling down. Interact with them."), bg: '#FF5E5B' },
    sick: { icon: 'fa-heartbeat', text: t("is not feeling well! Take care of them."), bg: '#FF5E5B' },
    neutral: { icon: 'fa-face-meh', text: t("is doing fine."), bg: '#00CECB' }
  };
  const status = statusConfig[petMood] || statusConfig.neutral;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Pet name and level */}
      <div className="text-center mb-4">
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#222222', marginBottom: '8px', fontFamily }}>
          {currentPet.name}
        </h2>
        <p style={{ fontSize: '11px', color: '#222222', fontWeight: 'bold', marginTop: '4px', fontFamily }}>{t("Level")}{' '}{currentPet.level} • {currentPet.experience}/{currentPet.level * 50}{' '}{t("EXP")}</p>
      </div>

      {/* Experience bar */}
      <div style={{ width: '100%', maxWidth: '200px', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', marginBottom: '16px', border: '2px solid #222222' }}>
        <div style={{ height: '100%', backgroundColor: '#FFD700', borderRadius: '4px', width: `${(currentPet.experience / (currentPet.level * 50)) * 100}%`, borderRight: '2px solid #222222' }}></div>
      </div>

      {/* Pet video container */}
      <div className="relative mb-4 w-full flex justify-center">
        <div
          onClick={handlePetClick}
          data-testid="pet-interaction"
          data-active-video={activeVideo}
          style={{
            width: '260px',
            height: '260px',
            overflow: 'hidden',
            cursor: 'pointer',
            position: 'relative',
            backgroundColor: '#ffffff' // White background
          }}
        >
          {Object.values(VIDEOS).map((videoType) => (
            <video
              key={videoType} // Stable key - no re-rendering
              ref={(el) => { videoRefs.current[videoType] = el; }}
              src={getVideoSrc(videoType)}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: activeVideo === videoType ? 1 : 0,
                zIndex: activeVideo === videoType ? 1 : 0,
                pointerEvents: 'none'
              }}
              autoPlay
              muted
              playsInline
              controls={false}
              preload="metadata"
              loop={videoType === VIDEOS.IDLE || videoType === VIDEOS.SICK}
              onEnded={() => handleVideoEnded(videoType)}
            />
          ))}
        </div>

        {/* Dialogue bubble */}
        {showDialogue && (
          <motion.div
            data-testid="pet-dialogue"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: 'absolute',
              bottom: '-12px',
              left: '50%',
              x: '-50%',
              backgroundColor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(3px)',
              borderRadius: '10px',
              padding: '8px 14px',
              boxShadow: '2px 2px 0 #222222',
              border: '2px solid #222222',
              maxWidth: 'calc(100% - 16px)',
              width: '220px',

              zIndex: 10
            }}
          >
            <p style={{ color: '#222222', fontSize: '12px', lineHeight: 1.6, fontWeight: 'bold', fontFamily, margin: 0 }}>
              {t(petDialogue)}
            </p>
          </motion.div>
        )}
      </div>

      {/* Stats bars - 原始样式 */}
      <div className="w-full space-y-2 mb-4">
        {([{ key: 'health', title: 'Health' }, { key: 'happiness', title: 'Happiness' }, { key: 'hunger', title: 'Fullness' }, { key: 'energy', title: 'Energy' }] as const).map((stat) => {
          const value = stat.key === 'hunger' ? 100 - currentPet.hunger : currentPet[stat.key];
          const color = value > 70 ? '#00CECB' : value > 30 ? '#FFD700' : '#FF5E5B';
          return (
            <div key={stat.key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span style={{ fontWeight: 'bold', color: '#222222', fontFamily }}>{t(stat.title)}</span>
                <span style={{ color: '#222222', fontWeight: 'bold', fontFamily }}>{value}/100</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', border: '2px solid #222222' }}>
                <div style={{ height: '100%', backgroundColor: color, borderRadius: '4px', width: `${value}%`, borderRight: '2px solid #222222' }}></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pet status - 卡片样式 */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: '10px',
        padding: '12px 16px',
        boxShadow: '2px 2px 0 #222222',
        border: '2px solid #222222',
        marginBottom: '16px',
        width: '100%'
      }}>
        <p style={{ fontSize: '13px', color: '#222222', fontWeight: 'bold', fontFamily, textAlign: 'center', margin: 0 }}>
          <i className={`fas ${status.icon}`} style={{ marginRight: '8px', color: status.bg }}></i>
          {currentPet.name} {t(status.text)}
        </p>
      </div>

      {/* Action buttons - 更长的按钮 */}
      <div className="flex gap-4 w-full">
        <button
          onClick={handleFeed}
          disabled={isInteractionPlayingRef.current}
          style={{
            flex: 1,
            padding: '12px 24px',
            backgroundColor: isInteractionPlayingRef.current ? '#cccccc' : '#FF5E5B',
            color: 'white',
            border: '2px solid #222222',
            borderRadius: '10px',
            fontWeight: 'bold',
            fontSize: '13px',
            cursor: isInteractionPlayingRef.current ? 'not-allowed' : 'pointer',
            boxShadow: isInteractionPlayingRef.current ? 'none' : '3px 3px 0 #222222',
            fontFamily,
            transition: 'all 0.2s',
            opacity: isInteractionPlayingRef.current ? 0.6 : 1
          }}
        >
          <i className="fas fa-utensils" style={{ marginRight: '8px' }}></i>{t("Feed")}</button>
        <button
          onClick={handlePlay}
          disabled={isInteractionPlayingRef.current}
          style={{
            flex: 1,
            padding: '12px 24px',
            backgroundColor: isInteractionPlayingRef.current ? '#cccccc' : '#00CECB',
            color: 'white',
            border: '2px solid #222222',
            borderRadius: '10px',
            fontWeight: 'bold',
            fontSize: '13px',
            cursor: isInteractionPlayingRef.current ? 'not-allowed' : 'pointer',
            boxShadow: isInteractionPlayingRef.current ? 'none' : '3px 3px 0 #222222',
            fontFamily,
            transition: 'all 0.2s',
            opacity: isInteractionPlayingRef.current ? 0.6 : 1
          }}
        >
          <i className="fas fa-gamepad" style={{ marginRight: '8px' }}></i>{t("Play")}</button>
      </div>
    </div>
  );
};

export default PetDisplay;
