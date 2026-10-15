import { t } from '@/i18n/core';
import { createContext, useEffect, ReactNode, useRef, useMemo, useContext } from 'react';
import { Pet } from '@/types';
import { AuthContext } from './authContext';
import { businessRepository } from '@/services/storage';
import { toast } from 'sonner';
import { interactBusinessPet } from '@/services/businessActions';
import { WidgetPetDispatcher } from '@/services/widgetPetCommands';
import { readSessionStamp } from '@/services/runtimeSession';
import { isTauri } from '@/services/tauriCommands';

interface PetContextType {
  interactWithPet: () => Promise<void>;
  feedPet: () => Promise<{ success: boolean; message: string }>;
  playWithPet: () => Promise<{ success: boolean; message: string }>;
  getPetDialogue: (mood?: string) => string;
  levelUpPet: () => Promise<void>;
}
export const PetContext = createContext<PetContextType>({
  interactWithPet: async () => {},
  feedPet: async () => ({ success: false, message: '' }),
  playWithPet: async () => ({ success: false, message: '' }),
  getPetDialogue: () => '', levelUpPet: async () => {},
});

export const PetProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser, currentPet, updatePet, sessionVersion } = useContext(AuthContext);
  const scope = useMemo(() => ({ owner: currentUser?.id, stamp: readSessionStamp(localStorage), tail: Promise.resolve() as Promise<unknown> }), [currentUser?.id, sessionVersion]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const assertActive = () => {
    if (!isActive()) throw new Error('The account session has changed.');
  };
  const isActive = () => !!scope.owner && scopeRef.current === scope && !!scope.stamp && readSessionStamp(localStorage)?.token === scope.stamp.token;
  const serial = <T,>(action: () => Promise<T>): Promise<T> => {
    const operation = scope.tail.catch(() => undefined).then(async () => { assertActive(); return action(); });
    scope.tail = operation;
    return operation;
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

  const interactWithPet = () => serial(async () => {
    const today = new Date().toISOString().split('T')[0];
    await businessRepository.transact(scope.owner!, data => {
      if (!data.pet) throw new Error('Pet data is unavailable.');
      const reward = data.settings.lastPetInteraction !== today;
      return { ...data,
        pet: { ...data.pet, lastInteraction: new Date(), happiness: Math.min(100, data.pet.happiness + (reward ? 5 : 0)) },
        settings: { ...data.settings, lastPetInteraction: today } };
    }, isActive);
  });

  const petAction = (action: 'feed' | 'play', operationId?: string) => serial(async () => {
    const now = new Date();
    await businessRepository.transact(scope.owner!, data => interactBusinessPet(data, action, now), isActive, operationId);
    return { success: true, message: '' };
  });
  const feedPet = () => petAction('feed');
  const playWithPet = () => petAction('play');
  useEffect(() => {
    if (!scope.owner || !isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const dispatcher = new WidgetPetDispatcher(
      scope.owner,
      () => scopeRef.current === scope ? readSessionStamp(localStorage) : null,
      (action, requestId) => petAction(action, requestId),
    );
    void import('@tauri-apps/api/event').then(async ({ listen, emit }) => {
      const dispose = await listen('widget-pet-action', async event => {
        if (cancelled) return;
        const result = await dispatcher.handle(event.payload);
        if (result && !cancelled) {
          try { await emit('widget-pet-result', result); }
          catch { /* The widget reports an unconfirmed result and refreshes its view. */ }
        }
      });
      if (cancelled) dispose();
      else unlisten = dispose;
    }).catch(() => {
      if (!cancelled) toast.error(t("Widget interactions are unavailable. Please reopen the application."));
    });
    return () => { cancelled = true; unlisten?.(); };
  }, [scope, updatePet]);
  const levelUpPet = () => serial(async () => {
    await updatePet(pet => ({ ...pet, level: pet.level + 1, experience: 0, health: 80, happiness: 70, energy: 90 }));
  });

  useEffect(() => {
    if (!scope.owner || !currentPet) return;
    const updateStats = () => {
      void serial(async () => {
        await updatePet(pet => {
          const now = new Date();
          const hours = Math.max(0, Math.min(24, (now.getTime() - pet.lastInteraction.getTime()) / 3600000));
          const next: Pet = { ...pet,
            hunger: Math.min(100, Math.floor(pet.hunger + hours * 1.5)),
            energy: Math.min(100, Math.floor(pet.energy + hours * 1.5)),
          };
          if (next.hunger > 80 || next.energy < 20) next.health = Math.max(0, Math.floor(pet.health - hours * 0.5));
          if (next.health < 50 || next.hunger > 70 || next.energy < 30) next.happiness = Math.max(0, Math.floor(pet.happiness - hours * 0.5));
          if (next.experience >= next.level * 50) return { ...next, level: next.level + 1, experience: 0, health: 80, happiness: 70, energy: 90, lastInteraction: now };
          if (next.hunger !== pet.hunger || next.energy !== pet.energy || next.health !== pet.health || next.happiness !== pet.happiness) next.lastInteraction = now;
          return next;
        });
      }).catch(() => {
        if (scopeRef.current === scope) toast.error(t("Pet progress could not be saved. Existing saved data has been kept."));
      });
    };
    updateStats();
    const timer = setInterval(updateStats, 300000);
    return () => clearInterval(timer);
  }, [scope, Boolean(currentPet), updatePet]);

  return <PetContext.Provider value={{ interactWithPet, feedPet, playWithPet, getPetDialogue, levelUpPet }}>{children}</PetContext.Provider>;
};
