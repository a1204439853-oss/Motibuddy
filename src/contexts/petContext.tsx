import { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Pet } from '@/types';
import { AuthContext } from './authContext';
import { useContext } from 'react';
import { loadPet, savePet, loadSettings, saveSettings } from '@/services/storage';

interface PetContextType {
  interactWithPet: () => void;
  feedPet: () => Promise<{ success: boolean; message: string }>;
  playWithPet: () => Promise<{ success: boolean; message: string }>;
  getPetDialogue: (mood?: string) => string;
  levelUpPet: () => void;
  savePet: (pet: Pet) => Promise<void>;
  interactionDataRef: React.MutableRefObject<InteractionData | null>;
}

export const PetContext = createContext<PetContextType>({
  interactWithPet: () => {},
  feedPet: async () => ({ success: false, message: '' }),
  playWithPet: async () => ({ success: false, message: '' }),
  getPetDialogue: () => '',
  levelUpPet: () => {},
  savePet: async () => {},
  interactionDataRef: { current: null },
});

interface PetProviderProps {
  children: ReactNode;
}

// 交互数据类型 - 修改为2小时窗口
interface InteractionData {
  feedCount2Hour: number;  // 2小时内feed次数
  playCount2Hour: number;  // 2小时内play次数
  feedWindowStart: string | null;  // 2小时窗口开始时间
  playWindowStart: string | null;  // 2小时窗口开始时间
}

export const PetProvider = ({ children }: PetProviderProps) => {
  const { currentUser, currentPet, setCurrentPet } = useContext(AuthContext);
  const currentPetRef = useRef(currentPet);
  const interactionDataRef = useRef<InteractionData | null>(null);

  useEffect(() => {
    currentPetRef.current = currentPet;
  }, [currentPet]);

  // 加载交互数据
  useEffect(() => {
    const loadInteractionData = async () => {
      if (!currentUser) return;
      const settings = await loadSettings<{ petInteractions?: InteractionData }>();
      const data = settings?.petInteractions || {
        feedCount2Hour: 0,
        playCount2Hour: 0,
        feedWindowStart: null,
        playWindowStart: null
      };
      interactionDataRef.current = data;
    };
    loadInteractionData();
  }, [currentUser]);

  // 保存交互数据
  const saveInteractionData = async (data: InteractionData) => {
    if (!currentUser) return;
    const settings = await loadSettings<{ petInteractions?: InteractionData }>() || {};
    settings.petInteractions = data;
    await saveSettings(settings);
    interactionDataRef.current = data;
    
    // Also sync to localStorage for widget access
    localStorage.setItem('interaction_data', JSON.stringify(data));
  };

  // 确保交互数据已加载
  const ensureInteractionData = async (): Promise<InteractionData> => {
    if (!interactionDataRef.current) {
      const settings = await loadSettings<{ petInteractions?: InteractionData }>();
      interactionDataRef.current = settings?.petInteractions || {
        feedCount2Hour: 0,
        playCount2Hour: 0,
        feedWindowStart: null,
        playWindowStart: null
      };
    }
    return interactionDataRef.current;
  };

  // 检查并重置2小时窗口
  const checkAndResetWindow = (data: InteractionData, now: Date): InteractionData => {
    const newData = { ...data };

    // 检查feed窗口
    if (newData.feedWindowStart) {
      const windowStart = new Date(newData.feedWindowStart);
      const hoursPassed = (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60);
      if (hoursPassed >= 2) {
        // 超过2小时，重置窗口
        newData.feedCount2Hour = 0;
        newData.feedWindowStart = null;
      }
    }

    // 检查play窗口
    if (newData.playWindowStart) {
      const windowStart = new Date(newData.playWindowStart);
      const hoursPassed = (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60);
      if (hoursPassed >= 2) {
        // 超过2小时，重置窗口
        newData.playCount2Hour = 0;
        newData.playWindowStart = null;
      }
    }

    return newData;
  };

  const dialogueOptions = {
    happy: [
      "I'm so happy! Thanks for taking care of me!",
      "You're the best buddy ever!",
      "Let's keep up the good work!",
      "I feel fantastic today!",
      "Yay! More tasks completed!"
    ],
    hungry: [
      "I'm getting a bit hungry...",
      "Could I have a snack, please?",
      "My tummy is growling!",
      "Food would make me so happy!",
      "I need some energy to keep going!"
    ],
    tired: [
      "I'm feeling a bit tired...",
      "Could we take a short break?",
      "I need some rest to recharge!",
      "Maybe a nap would help!",
      "Not as energetic as usual today..."
    ],
    sad: [
      "I'm feeling a bit down...",
      "Could we hang out a bit?",
      "Do you still care about me?",
      "Maybe we can play later?",
      "I miss our fun times..."
    ],
    sick: [
      "I'm not feeling well...",
      "Could you take care of me?",
      "I need some rest to get better!",
      "Feeling a bit under the weather...",
      "Not my best day today..."
    ],
    neutral: [
      "What's on our agenda today?",
      "Ready for some tasks!",
      "How's your day going?",
      "Let's make today productive!",
      "What's next?"
    ],
    interaction: [
      "Ooh, that feels nice!",
      "I love your attention!",
      "Thanks for petting me!",
      "You're so sweet!",
      "Best buddy ever!"
    ],
    fed: [
      "Yum! That was delicious!",
      "Thanks for the food!",
      "I feel energized now!",
      "My tummy is happy!",
      "What a tasty meal!"
    ],
    play: [
      "Woohoo! Let's play!",
      "This is so much fun!",
      "I love playing with you!",
      "You're great at this!",
      "Let's do this again!"
    ],
    levelUp: [
      "I leveled up! Thanks to you!",
      "Whoa! I'm getting stronger!",
      "Level up! I'm so excited!"
    ]
  };

  const getPetDialogue = (mood?: string): string => {
    if (!currentPet) return '';

    let currentMood = mood;

    if (!currentMood) {
      if (currentPet.health < 30) currentMood = 'sick';
      else if (currentPet.hunger > 80) currentMood = 'hungry';
      else if (currentPet.happiness > 70 && currentPet.energy > 70) currentMood = 'happy';
      else if (currentPet.happiness < 30) currentMood = 'sad';
      else if (currentPet.energy < 30) currentMood = 'tired';
      else currentMood = 'neutral';
    }

    const dialogues = dialogueOptions[currentMood as keyof typeof dialogueOptions] || dialogueOptions.neutral;
    return dialogues[Math.floor(Math.random() * dialogues.length)];
  };

  const interactWithPet = async () => {
    if (!currentPet || !currentUser) return;

    const today = new Date().toISOString().split('T')[0];
    const settings = await loadSettings<{ lastPetInteraction?: string }>() || {};
    const lastInteractionDate = settings.lastPetInteraction;

    let updatedPet = { ...currentPet, lastInteraction: new Date() };

    if (lastInteractionDate !== today) {
      updatedPet = {
        ...updatedPet,
        happiness: Math.min(100, currentPet.happiness + 5)
      };
      settings.lastPetInteraction = today;
      await saveSettings(settings);
    }

    setCurrentPet(updatedPet);
    await savePet(updatedPet);
  };

  // 同步数据到 widget
  const syncToWidget = async (petData: Pet) => {
    try {
      // @ts-ignore
      if (window.__TAURI__) {
        // @ts-ignore
        const { invoke } = await import('@tauri-apps/api/tauri');
        // @ts-ignore
        await invoke('save_widget_data', {
          userId: currentUser?.id || null,
          tasks: [],
          pet: {
            name: petData.name,
            pet_type: petData.type,
            level: petData.level,
            health: petData.health,
            happiness: petData.happiness,
            hunger: petData.hunger,
            energy: petData.energy
          }
        });
        console.log('Pet data synced to widget');
      }
    } catch (e) {
      console.log('Failed to sync to widget:', e);
    }
  };

  const feedPet = async (): Promise<{ success: boolean; message: string }> => {
    if (!currentPet || !currentUser) return { success: false, message: '' };

    const data = await ensureInteractionData();
    const now = new Date();

    // 检查并重置2小时窗口
    let newData = checkAndResetWindow({ ...data }, now);

    // 检查2小时内是否已达到2次限制
    if (newData.feedCount2Hour >= 2) {
      return { success: false, message: "I'm full now! Let me rest for a while~" };
    }

    // 更新宠物状态
    const updatedPet = {
      ...currentPet,
      hunger: Math.max(0, currentPet.hunger - 20),
      energy: Math.min(100, currentPet.energy + 20),
      lastInteraction: now
    };

    // 更新交互数据
    if (newData.feedCount2Hour === 0) {
      newData.feedWindowStart = now.toISOString();
    }
    newData.feedCount2Hour++;
    interactionDataRef.current = newData;

    setCurrentPet(updatedPet);
    await savePet(updatedPet);
    await saveInteractionData(newData);
    
    // 同步到 widget
    await syncToWidget(updatedPet);

    return { success: true, message: '' };
  };

  const playWithPet = async (): Promise<{ success: boolean; message: string }> => {
    if (!currentPet || !currentUser) return { success: false, message: '' };

    const data = await ensureInteractionData();
    const now = new Date();

    // 检查并重置2小时窗口
    let newData = checkAndResetWindow({ ...data }, now);

    // 检查2小时内是否已达到2次限制
    if (newData.playCount2Hour >= 2) {
      return { success: false, message: "I'm tired from playing! Let me rest for a while~" };
    }

    // 更新宠物状态
    const updatedPet = {
      ...currentPet,
      happiness: Math.min(100, currentPet.happiness + 15),
      energy: Math.max(0, currentPet.energy - 15),
      lastInteraction: now
    };

    // 更新交互数据
    if (newData.playCount2Hour === 0) {
      newData.playWindowStart = now.toISOString();
    }
    newData.playCount2Hour++;
    interactionDataRef.current = newData;

    setCurrentPet(updatedPet);
    await savePet(updatedPet);
    await saveInteractionData(newData);
    
    // 同步到 widget
    await syncToWidget(updatedPet);

    return { success: true, message: '' };
  };

  const levelUpPet = async () => {
    if (!currentPet || !currentUser) return;

    const updatedPet = {
      ...currentPet,
      level: currentPet.level + 1,
      experience: 0,
      health: 80,
      happiness: 70,
      energy: 90
    };

    setCurrentPet(updatedPet);
    await savePet(updatedPet);
  };

  // 自动更新宠物状态
  useEffect(() => {
    if (!currentPetRef.current || !currentUser) return;

    const autoUpdateStats = async () => {
      const pet = currentPetRef.current;
      if (!pet) return;

      const now = new Date();
      let lastUpdate = pet.lastInteraction;

      if (typeof lastUpdate === 'string') {
        lastUpdate = new Date(lastUpdate);
      }

      if (isNaN(lastUpdate.getTime())) {
        lastUpdate = now;
      }

      const hoursPassed = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      const cappedHoursPassed = Math.min(hoursPassed, 24);

      let updatedPet = { ...pet };

      // 饥饿度随时间增加 (1.5点/小时)
      updatedPet.hunger = Math.min(100, Math.floor(pet.hunger + (cappedHoursPassed * 1.5)));

      // 能量随时间恢复 (1.5点/小时)
      updatedPet.energy = Math.min(100, Math.floor(pet.energy + (cappedHoursPassed * 1.5)));

      // 健康受饥饿和能量影响
      if (updatedPet.hunger > 80 || updatedPet.energy < 20) {
        updatedPet.health = Math.max(0, Math.floor(pet.health - (cappedHoursPassed * 0.5)));
      }

      // 快乐度受健康、饥饿和能量影响
      if (updatedPet.health < 50 || updatedPet.hunger > 70 || updatedPet.energy < 30) {
        updatedPet.happiness = Math.max(0, Math.floor(pet.happiness - (cappedHoursPassed * 0.5)));
      }

      updatedPet.hunger = Math.floor(updatedPet.hunger);
      updatedPet.energy = Math.floor(updatedPet.energy);
      updatedPet.health = Math.floor(updatedPet.health);
      updatedPet.happiness = Math.floor(updatedPet.happiness);

      const expNeededForLevel = pet.level * 50;
      updatedPet.experience = Math.min(updatedPet.experience, expNeededForLevel);

      if (updatedPet.experience >= expNeededForLevel) {
        await levelUpPet();
        return;
      }

      if (
        updatedPet.hunger !== pet.hunger ||
        updatedPet.energy !== pet.energy ||
        updatedPet.health !== pet.health ||
        updatedPet.happiness !== pet.happiness ||
        updatedPet.experience !== pet.experience
      ) {
        updatedPet.lastInteraction = now;

        setCurrentPet(updatedPet);
        await savePet(updatedPet);
      }
    };

    autoUpdateStats();
    const interval = setInterval(autoUpdateStats, 300000);

    return () => clearInterval(interval);
  }, [currentUser, setCurrentPet]);

  return (
    <PetContext.Provider value={{
      interactWithPet,
      feedPet,
      playWithPet,
      getPetDialogue,
      levelUpPet,
      savePet,
      interactionDataRef
    }}>
      {children}
    </PetContext.Provider>
  );
};
