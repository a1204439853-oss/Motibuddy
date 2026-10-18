import { t, label, getLocale } from '@/i18n/core';
import { useLocale } from '@/i18n/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { readSessionStamp } from '@/services/runtimeSession';
import { requestWidgetPetAction } from '@/services/widgetPetCommands';
import { isTauri } from '@/services/tauriCommands';

interface Task {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  status: string;
}

interface Pet {
  name: string;
  pet_type: string;
  level: number;
  health: number;
  happiness: number;
  hunger: number;
  energy: number;
}

interface WidgetData {
  user_id: string | null;
  tasks: Task[];
  pet: Pet | null;
  timestamp: number;
  revision: number;
}

/**
 * Desktop Widget Window
 * Reads committed backend snapshots; localStorage only identifies the active session.
 */
const WidgetWindow = () => {
  useLocale();
  const [mode, setMode] = useState<'compact' | 'full'>('compact');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pet, setPet] = useState<Pet | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const displayedSession = useRef<string | null>(null);
  const displayedRevision = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  // Pet dialogue state
  const [petDialogue, setPetDialogue] = useState('');
  const [showDialogue, setShowDialogue] = useState(false);

  // Update current date every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const [isPetActionPending, setPetActionPending] = useState(false);
  const petActionPending = useRef(false);
  const reloadData = useRef<() => Promise<void>>(async () => {});

  // Task sorting state
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'created'>('dueDate');

  // Show dialogue helper
  const showPetDialogue = (message: string) => {
    setPetDialogue(message);
    setShowDialogue(true);
    setTimeout(() => setShowDialogue(false), 4000);
  };

  // Sort tasks based on selected criteria
  const getSortedTasks = useCallback((taskList: Task[]) => {
    const sorted = [...taskList];
    switch (sortBy) {
      case 'dueDate':
        return sorted.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      case 'priority':
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return sorted.sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]);
      case 'created':
        return sorted.sort((a, b) => a.id.localeCompare(b.id));
      default:
        return sorted;
    }
  }, [sortBy]);
  
  // Read one committed revision for both tasks and pet. Never fall back to stale caches.
  useEffect(() => {
    let disposed = false;
    const loadData = async (force: boolean = false) => {
      const stamp = readSessionStamp(localStorage);
      try {
        if (disposed) return;
        if (!stamp) {
          displayedSession.current = null;
          displayedRevision.current = 0;
          setUserId(null);
          setTasks([]);
          setPet(null);
          setIsLoading(false);
          setLoadError(null);
          return;
        }
        const changedSession = displayedSession.current !== stamp.token;
        if (changedSession) {
          displayedSession.current = stamp.token;
          displayedRevision.current = 0;
          setTasks([]);
          setPet(null);
          setUserId(null);
        }
        if (!isTauri()) throw new Error('Desktop data is unavailable.');
        const { invoke } = await import('@tauri-apps/api/tauri');
        const data = await invoke<WidgetData>('load_widget_data', { userId: stamp.userId });
        
        if (disposed || readSessionStamp(localStorage)?.token !== stamp.token) return;
        if (data.user_id !== stamp.userId || !Number.isSafeInteger(data.revision) || data.revision < 1) throw new Error('Invalid saved widget data.');
        if (data.revision < displayedRevision.current) return;
        if (data) {
          displayedRevision.current = data.revision;
          setLoadError(null);
          setUserId(stamp.userId);
          setTasks(previous => JSON.stringify(previous) === JSON.stringify(data.tasks ?? []) ? previous : data.tasks ?? []);
          setPet(data.pet);
        }

        // Only set loading to false on first load
        if (isLoading) {
          setIsLoading(false);
        }
      } catch (error) {
        if (disposed || readSessionStamp(localStorage)?.token !== stamp?.token) return;
        console.error('Widget: Error loading data:', error);
        setLoadError("Saved progress could not be refreshed. Please check the main window.");
        if (isLoading) {
          setIsLoading(false);
        }
      }
    };

    reloadData.current = () => loadData(true);
    // Load immediately
    loadData(true);
    
    // Listen for storage changes (from main app)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'widget_data' || e.key === 'activeSession' || e.key === 'currentUserId') {
        console.log('Widget: Data updated from main app (storage event)');
        loadData(true);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically for updates (every 1.5 seconds for more responsive sync)
    const intervalId = setInterval(() => loadData(false), 1500);
    
    return () => {
      disposed = true;
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, [isLoading]);

  const requestPetAction = async (action: 'feed' | 'play') => {
    const stamp = readSessionStamp(localStorage);
    if (petActionPending.current || !pet || !stamp || stamp.userId !== userId || stamp.token !== displayedSession.current) return;
    petActionPending.current = true;
    setPetActionPending(true);
    const isActive = () => readSessionStamp(localStorage)?.token === stamp.token;
    try {
      if (!isTauri()) throw new Error('Desktop interactions are unavailable.');
      const { listen, emit } = await import('@tauri-apps/api/event');
      const result = await requestWidgetPetAction({
        listen: handler => listen('widget-pet-result', event => handler(event.payload)),
        emit: request => emit('widget-pet-action', request),
      }, { requestId: crypto.randomUUID(), userId: stamp.userId, sessionToken: stamp.token, action }, isActive);
      if (!isActive()) return;
      await reloadData.current();
      if (!result.success) { showPetDialogue(result.message); return; }
      showPetDialogue(action === 'feed' ? "Yum yum! That was delicious!" : "That was fun! Let's play again soon!");
      const video = document.querySelector('video');
      if (video) {
        video.loop = false;
        video.src = '/' + pet.pet_type + '_' + action + '.mp4';
        void video.play().catch(() => {});
        video.addEventListener('ended', () => {
          video.loop = true;
          video.src = '/' + pet.pet_type + '_idle.mp4';
          void video.play().catch(() => {});
        }, { once: true });
      }
    } catch (error) {
      if (isActive()) {
        showPetDialogue(error instanceof Error ? error.message : "The interaction result could not be confirmed.");
        await reloadData.current();
      }
    } finally {
      petActionPending.current = false;
      setPetActionPending(false);
    }
  };

  // Get all sorted tasks
  const sortedTasks = getSortedTasks(tasks);
  const totalPendingTasks = tasks.length;

  // Format date in English
  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(getLocale(), options);
  };

  // Close widget - use Tauri event
  const closeWidget = async () => {
    console.log('Widget: Closing...');
    try {
      // @ts-ignore
      if (isTauri()) {
        // @ts-ignore
        const { invoke } = await import('@tauri-apps/api/tauri');
        await invoke('hide_widget_window');
        console.log('Widget: Close event emitted');
      }
    } catch (e) {
      console.log('Widget: Close failed:', e);
    }
  };

  // Open main app - use Tauri event
  const openMainApp = async () => {
    console.log('Widget: Opening main app...');
    try {
      // @ts-ignore
      if (isTauri()) {
        // @ts-ignore
        const { invoke } = await import('@tauri-apps/api/tauri');
        await invoke('show_main_window');
        console.log('Widget: Open main event emitted');
      }
    } catch (e) {
      console.log('Widget: Open main app failed:', e);
    }
  };

  // Toggle mode
  const toggleMode = () => {
    console.log('Widget: Toggling mode from', mode, 'to', mode === 'compact' ? 'full' : 'compact');
    setMode(prev => prev === 'compact' ? 'full' : 'compact');
  };

  // Start dragging - use Tauri native dragging for smooth performance
  const startDragging = useCallback(async (e: React.MouseEvent) => {
    // Don't start drag if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    
    e.preventDefault();
    console.log('Widget: Starting native drag...');
    
    try {
      // @ts-ignore
      if (isTauri()) {
        // @ts-ignore
        const { invoke } = await import('@tauri-apps/api/tauri');
        // Use Tauri's native window dragging - much smoother than manual implementation
        // @ts-ignore
        await invoke('start_dragging');
        console.log('Widget: Native drag started');
      }
    } catch (err) {
      console.log('Widget: Native drag failed, falling back to manual', err);
      // Fallback to manual dragging if native fails
      fallbackDragging(e);
    }
  }, []);
  
  // Fallback manual dragging implementation
  const fallbackDragging = (e: React.MouseEvent) => {
    let lastX = e.screenX;
    let lastY = e.screenY;
    
    const handleMouseMove = async (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.screenX - lastX;
      const deltaY = moveEvent.screenY - lastY;
      
      lastX = moveEvent.screenX;
      lastY = moveEvent.screenY;
      
      if (deltaX !== 0 || deltaY !== 0) {
        try {
          // @ts-ignore
          if (isTauri()) {
            // @ts-ignore
            const { invoke } = await import('@tauri-apps/api/tauri');
            // @ts-ignore
            await invoke('move_widget_window', { deltaX, deltaY });
          }
        } catch (err) {
          console.log('Widget: Move failed', err);
        }
      }
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      console.log('Widget: Drag ended');
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: '20px',
        background: 'transparent',
        pointerEvents: 'none',
        overflow: 'hidden'
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="neo-widget"
        style={{
          width: 'min(360px, 100%)',
          maxHeight: 'calc(100vh - 40px)',
          overflow: 'hidden',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.15)',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {loadError && <p role="alert" className="p-3 text-sm text-red-700 bg-red-50">{t(loadError)}</p>}
        {/* Header - Draggable */}
        <div className="neo-widget-header px-3 py-1.5 flex items-center justify-between"
          style={{ 
            backgroundColor: 'rgba(255, 94, 91, 0.95)',
            borderBottom: '1px solid rgba(34, 34, 34, 0.1)',
            userSelect: 'none',
            cursor: 'default'
          }}
          onMouseDown={(e) => {
            // Only start dragging if not clicking on a button
            if (!(e.target as HTMLElement).closest('button')) {
              startDragging(e);
            }
          }}
        >
          {/* Left: Title */}
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">MotiBuddy</span>
          </div>
          
          {/* Right: Control buttons */}
          <div className="flex items-center gap-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleMode();
              }}
              className="text-white/90 hover:text-white p-1 rounded transition-all hover:bg-white/20"
              title={t(mode === 'compact' ? 'Expand' : 'Compact')}
            >
              <i className={`fa-solid ${mode === 'compact' ? 'fa-expand' : 'fa-compress'} text-xs`}></i>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                openMainApp();
              }}
              className="text-white/90 hover:text-white p-1 rounded transition-all hover:bg-white/20"
              title={t("Open Main App")}
            >
              <i className="fa-solid fa-home text-xs"></i>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                closeWidget();
              }}
              className="text-white/90 hover:text-white p-1 rounded transition-all hover:bg-white/20 hover:bg-red-400/50"
              title={t("Close")}
            >
              <i className="fa-solid fa-times text-xs"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-hidden">
          {/* Date */}
          <div className="mb-4">
            <p className="text-gray-800 font-bold text-sm">{formatDate(currentDate)}</p>
          </div>

          {/* Tasks Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-bold text-xs uppercase tracking-wide">{t("Tasks")}</span>
              <div className="flex items-center gap-2">
                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority' | 'created')}
                  className="text-xs px-2 py-1 rounded border-2 border-gray-200 bg-white/80 focus:border-[#FF5E5B] focus:outline-none cursor-pointer"
                  style={{ fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}
                >
                  <option value="dueDate">{t("Due Date")}</option>
                  <option value="priority">{t("Priority")}</option>
                  <option value="created">{t("Created")}</option>
                </select>
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {totalPendingTasks}
                </span>
              </div>
            </div>
            
            {isLoading ? (
              <p className="text-gray-400 text-xs italic">{t("Loading...")}</p>
            ) : sortedTasks.length > 0 ? (
              <div 
                className="space-y-2 overflow-y-auto"
                style={{ 
                  maxHeight: mode === 'compact' ? '160px' : '100px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(0,0,0,0.2) transparent'
                }}
              >
                {sortedTasks.map((task, index) => (
                  <div 
                    key={task.id}
                    className="p-2 rounded-lg text-xs"
                    style={{
                      backgroundColor: task.priority === 'high' ? 'rgba(255, 94, 91, 0.12)' : 
                                      task.priority === 'medium' ? 'rgba(255, 215, 0, 0.12)' : 
                                      'rgba(0, 206, 203, 0.12)',
                      borderLeft: `3px solid ${task.priority === 'high' ? '#FF5E5B' : 
                                              task.priority === 'medium' ? '#FFD700' : 
                                              '#00CECB'}`
                    }}
                  >
                    <p className="font-bold text-gray-800 truncate">{task.title}</p>
                    <p className="text-gray-500 mt-0.5">
                      {new Date(task.due_date).toLocaleDateString(getLocale())}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-xs italic">{t("No pending tasks")}</p>
            )}
          </div>

          {/* Full Mode: Pet Section */}
          <AnimatePresence>
            {mode === 'full' && pet && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-gray-200/50 pt-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 font-bold text-xs uppercase tracking-wide">{t("Pet Status")}</span>
                  <span className="text-gray-600 text-xs font-bold">{pet.name}{' '}{t("Lv.")}{pet.level}</span>
                </div>
                
                {/* Pet Video with click interaction and dialogue */}
                <div className="mb-3 flex justify-center relative">
                  <div 
                    className="w-32 h-32 rounded-full overflow-hidden border-2 border-white/50 cursor-pointer"
                    style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)', backgroundColor: '#f0f0f0' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Play random action video (only random1 or random2)
                      const video = e.currentTarget.querySelector('video') as HTMLVideoElement;
                      if (video && pet) {
                        const randomActions = ['random1', 'random2'];
                        const randomAction = randomActions[Math.floor(Math.random() * randomActions.length)];
                        
                        // Store current src for error recovery
                        const currentSrc = video.src;
                        
                        // Remove loop attribute for action video
                        video.loop = false;
                        
                        // Set new src with error handling
                        const newSrc = `/${pet.pet_type}_${randomAction}.mp4`;
                        
                        // Handle video load error
                        const handleError = () => {
                          console.log('Widget: Video load error, recovering to idle');
                          video.src = `/${pet.pet_type}_idle.mp4`;
                          video.loop = true;
                          video.play().catch(() => {});
                          video.removeEventListener('error', handleError);
                        };
                        
                        video.addEventListener('error', handleError, { once: true });
                        
                        try {
                          video.src = newSrc;
                          video.play().catch(err => {
                            console.log('Widget: Video play error:', err);
                            // Recover to idle
                            video.src = `/${pet.pet_type}_idle.mp4`;
                            video.loop = true;
                            video.play().catch(() => {});
                          });
                        } catch (err) {
                          console.log('Widget: Video src error:', err);
                          video.src = `/${pet.pet_type}_idle.mp4`;
                          video.loop = true;
                          video.play().catch(() => {});
                        }
                        
                        // Listen for video end event
                        const handleEnded = () => {
                          video.loop = true;
                          video.src = `/${pet.pet_type}_idle.mp4`;
                          video.play().catch(() => {});
                          video.removeEventListener('ended', handleEnded);
                        };
                        
                        video.addEventListener('ended', handleEnded, { once: true });
                      }
                    }}
                  >
                    <video
                      key={pet?.pet_type || 'default'}
                      src={pet ? `/${pet.pet_type}_idle.mp4` : ''}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover pointer-events-none"
                      onError={(e) => {
                        console.log('Widget: Video error, attempting recovery');
                        const video = e.target as HTMLVideoElement;
                        if (pet) {
                          video.src = `/${pet.pet_type}_idle.mp4`;
                          video.play().catch(() => {});
                        }
                      }}
                    />
                  </div>
                  
                  {/* Pet Dialogue Bubble */}
                  {showDialogue && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      style={{
                        position: 'absolute',
                        bottom: '-5px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(255, 255, 255, 0.55)',
                        borderRadius: '10px',
                        padding: '6px 10px',
                        boxShadow: '1px 1px 0 #222222',
                        border: '2px solid #222222',
                        maxWidth: '160px',
                        width: 'max-content',
                        zIndex: 10,
                        backdropFilter: 'blur(8px)'
                      }}
                    >
                      <p style={{ 
                        color: '#222222', 
                        fontSize: '10px', 
                        fontWeight: 'normal', 
                        fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif', 
                        margin: 0,
                        textAlign: 'center'
                      }}>
                        {t(petDialogue)}
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Pet Stats */}
                <div className="space-y-2 mb-4">
                  {[
                    { label: t("Health"), value: pet.health, color: '#00CECB' },
                    { label: t("Happiness"), value: pet.happiness, color: '#FFD700' },
                    { label: t("Fullness"), value: 100 - pet.hunger, color: '#00CECB' },
                    { label: t("Energy"), value: pet.energy, color: '#8A2BE2' }
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-12">{stat.label}</span>
                      <div className="flex-1 h-2 bg-gray-200/70 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ 
                            width: `${stat.value}%`,
                            backgroundColor: stat.color
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-8 text-right">{stat.value}</span>
                    </div>
                  ))}
                </div>

                {/* Interaction Buttons */}
                <div className="flex gap-2">
                  <button
                    disabled={isPetActionPending || !!loadError}
                    onClick={e => { e.stopPropagation(); void requestPetAction('feed'); }}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all"
                    style={{
                      backgroundColor: '#FF5E5B',
                      color: 'white',
                      border: '2px solid #222222',
                      boxShadow: '2px 2px 0 #222222'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translate(-1px, -1px)';
                      e.currentTarget.style.boxShadow = '3px 3px 0 #222222';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translate(0, 0)';
                      e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
                    }}
                  >
                    <i className="fa-solid fa-utensils mr-1"></i>{t("Feed")}</button>
                  <button
                    disabled={isPetActionPending || !!loadError}
                    onClick={e => { e.stopPropagation(); void requestPetAction('play'); }}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all"
                    style={{
                      backgroundColor: '#00CECB',
                      color: 'white',
                      border: '2px solid #222222',
                      boxShadow: '2px 2px 0 #222222'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translate(-1px, -1px)';
                      e.currentTarget.style.boxShadow = '3px 3px 0 #222222';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translate(0, 0)';
                      e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
                    }}
                  >
                    <i className="fa-solid fa-gamepad mr-1"></i>{t("Play")}</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default WidgetWindow;
