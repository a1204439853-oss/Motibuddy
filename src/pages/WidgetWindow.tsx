import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
}

/**
 * Desktop Widget Window
 * Uses localStorage for communication with main app
 */
const WidgetWindow = () => {
  const [mode, setMode] = useState<'compact' | 'full'>('compact');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pet, setPet] = useState<Pet | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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

  // Interaction data for feed/play limits
  const [interactionData, setInteractionData] = useState({
    feedCount2Hour: 0,
    playCount2Hour: 0,
    feedWindowStart: null as string | null,
    playWindowStart: null as string | null
  });

  // Track if data was updated locally (to prevent override)
  const [lastLocalUpdate, setLastLocalUpdate] = useState<number>(0);

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
  
  // Load data from Tauri backend or localStorage
  useEffect(() => {
    const loadData = async (force: boolean = false) => {
      try {
        // Skip loading if we just made a local update (within last 2 seconds)
        if (!force && Date.now() - lastLocalUpdate < 2000) {
          console.log('Widget: Skipping load due to recent local update');
          return;
        }
        
        console.log('Widget: Loading data...');
        
        let data: WidgetData | null = null;
        
        // If userId is null, try to get it from localStorage first
        let effectiveUserId = userId;
        if (!effectiveUserId) {
          const widgetDataStr = localStorage.getItem('widget_data');
          if (widgetDataStr) {
            try {
              const cachedData = JSON.parse(widgetDataStr);
              if (cachedData.user_id) {
                effectiveUserId = cachedData.user_id;
                console.log('Widget: Got userId from localStorage:', effectiveUserId);
              }
            } catch (e) {
              console.log('Widget: Failed to parse cached data');
            }
          }
        }
        
        // Try to load from Tauri backend first (most up-to-date) - pass effective user_id
        if (effectiveUserId) {
          try {
            // @ts-ignore
            if (window.__TAURI__) {
              // @ts-ignore
              const { invoke } = await import('@tauri-apps/api/tauri');
              // @ts-ignore
              data = await invoke('load_widget_data', { userId: effectiveUserId });
              console.log('Widget: Data loaded from Tauri backend for user:', effectiveUserId, data);
            }
          } catch (e) {
            console.log('Widget: Failed to load from Tauri, falling back to localStorage');
          }
        } else {
          console.log('Widget: No userId available, skipping Tauri load');
        }
        
        // Fallback to localStorage if Tauri load failed or no userId
        if (!data) {
          const widgetDataStr = localStorage.getItem('widget_data');
          if (widgetDataStr) {
            data = JSON.parse(widgetDataStr);
            console.log('Widget: Data loaded from localStorage:', data);
          }
        }
        
        if (data) {
          // Validate user ID - only update if user ID matches or is new
          const currentUserId = userId;
          const newUserId = data.user_id;
          
          if (currentUserId && newUserId && currentUserId !== newUserId) {
            console.log('Widget: User ID mismatch detected!', { current: currentUserId, new: newUserId });
            // User switched, clear all data first then set new data
            setUserId(newUserId);
            setTasks([]);
            setPet(null);
            // Small delay to ensure clear happens before setting new data
            setTimeout(() => {
              setTasks(data.tasks || []);
              setPet(data.pet);
            }, 0);
            setLastLocalUpdate(0);
          } else {
            // Same user or first load, update normally
            setUserId(newUserId);
            // Only update tasks if they actually changed to prevent flashing
            setTasks(prevTasks => {
              const newTasks = data?.tasks || [];
              if (JSON.stringify(prevTasks) !== JSON.stringify(newTasks)) {
                console.log('Widget: Tasks updated');
                return newTasks;
              }
              return prevTasks;
            });
            
            // Only update pet from external source if no recent local update
            if (Date.now() - lastLocalUpdate > 3000) {
              setPet(data.pet);
              console.log('Widget: Updated pet from external source');
            } else {
              console.log('Widget: Skipping pet update due to recent local activity');
            }
          }
        }
        
        // Load interaction data from main app (sync via localStorage)
        const interactionStr = localStorage.getItem('interaction_data');
        if (interactionStr) {
          try {
            const parsed = JSON.parse(interactionStr);
            // Ensure all required fields exist
            setInteractionData({
              feedCount2Hour: parsed.feedCount2Hour ?? 0,
              playCount2Hour: parsed.playCount2Hour ?? 0,
              feedWindowStart: parsed.feedWindowStart ?? null,
              playWindowStart: parsed.playWindowStart ?? null
            });
            console.log('Widget: Loaded interaction data from main app');
          } catch (e) {
            console.log('Widget: Failed to parse interaction data, using defaults');
            // Reset to defaults on parse error
            setInteractionData({
              feedCount2Hour: 0,
              playCount2Hour: 0,
              feedWindowStart: null,
              playWindowStart: null
            });
          }
        } else {
          // No interaction data found, ensure defaults are set
          console.log('Widget: No interaction data found, using defaults');
          setInteractionData({
            feedCount2Hour: 0,
            playCount2Hour: 0,
            feedWindowStart: null,
            playWindowStart: null
          });
        }
        
        // Only set loading to false on first load
        if (isLoading) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Widget: Error loading data:', error);
        if (isLoading) {
          setIsLoading(false);
        }
      }
    };

    // Load immediately
    loadData(true);
    
    // Listen for storage changes (from main app)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'widget_data') {
        console.log('Widget: Data updated from main app (storage event)');
        loadData(true);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically for updates (every 1.5 seconds for more responsive sync)
    const intervalId = setInterval(() => loadData(false), 1500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, [lastLocalUpdate, isLoading]);

  // Check and reset 2-hour window
  const checkAndResetWindow = (data: typeof interactionData, now: Date): typeof interactionData => {
    const newData = { ...data };

    // Check feed window
    if (newData.feedWindowStart) {
      const windowStart = new Date(newData.feedWindowStart);
      const hoursPassed = (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60);
      if (hoursPassed >= 2) {
        newData.feedCount2Hour = 0;
        newData.feedWindowStart = null;
      }
    }

    // Check play window
    if (newData.playWindowStart) {
      const windowStart = new Date(newData.playWindowStart);
      const hoursPassed = (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60);
      if (hoursPassed >= 2) {
        newData.playCount2Hour = 0;
        newData.playWindowStart = null;
      }
    }

    return newData;
  };

  // Save interaction data (sync with main app via localStorage)
  const saveInteractionData = (data: typeof interactionData) => {
    setInteractionData(data);
    localStorage.setItem('interaction_data', JSON.stringify(data));
    console.log('Widget: Saved interaction data');
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
    return date.toLocaleDateString('en-US', options);
  };

  // Close widget - use Tauri event
  const closeWidget = async () => {
    console.log('Widget: Closing...');
    try {
      // @ts-ignore
      if (window.__TAURI__) {
        // @ts-ignore
        const { emit } = await import('@tauri-apps/api/event');
        // @ts-ignore
        await emit('widget-action', { action: 'close' });
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
      if (window.__TAURI__) {
        // @ts-ignore
        const { emit } = await import('@tauri-apps/api/event');
        // @ts-ignore
        await emit('widget-action', { action: 'open-main' });
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
      if (window.__TAURI__) {
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
          if (window.__TAURI__) {
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
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl"
        style={{
          width: 360,
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
        {/* Header - Draggable */}
        <div 
          className="px-3 py-1.5 flex items-center justify-between"
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
              title={mode === 'compact' ? 'Expand' : 'Compact'}
            >
              <i className={`fa-solid ${mode === 'compact' ? 'fa-expand' : 'fa-compress'} text-xs`}></i>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                openMainApp();
              }}
              className="text-white/90 hover:text-white p-1 rounded transition-all hover:bg-white/20"
              title="Open Main App"
            >
              <i className="fa-solid fa-home text-xs"></i>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                closeWidget();
              }}
              className="text-white/90 hover:text-white p-1 rounded transition-all hover:bg-white/20 hover:bg-red-400/50"
              title="Close"
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
              <span className="text-gray-700 font-bold text-xs uppercase tracking-wide">Tasks</span>
              <div className="flex items-center gap-2">
                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority' | 'created')}
                  className="text-xs px-2 py-1 rounded border-2 border-gray-200 bg-white/80 focus:border-[#FF5E5B] focus:outline-none cursor-pointer"
                  style={{ fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif' }}
                >
                  <option value="dueDate">Due Date</option>
                  <option value="priority">Priority</option>
                  <option value="created">Created</option>
                </select>
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {totalPendingTasks}
                </span>
              </div>
            </div>
            
            {isLoading ? (
              <p className="text-gray-400 text-xs italic">Loading...</p>
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
                      {new Date(task.due_date).toLocaleDateString('en-US')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-xs italic">No pending tasks</p>
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
                  <span className="text-gray-700 font-bold text-xs uppercase tracking-wide">Pet Status</span>
                  <span className="text-gray-600 text-xs font-bold">{pet.name} Lv.{pet.level}</span>
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
                        {petDialogue}
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Pet Stats */}
                <div className="space-y-2 mb-4">
                  {[
                    { label: 'Health', value: pet.health, color: '#00CECB' },
                    { label: 'Happy', value: pet.happiness, color: '#FFD700' },
                    { label: 'Hunger', value: pet.hunger, color: '#FF5E5B' },
                    { label: 'Energy', value: pet.energy, color: '#8A2BE2' }
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
                    onClick={async (e) => {
                      e.stopPropagation();
                      
                      // Check feed limit (2 times per 2 hours)
                      const now = new Date();
                      let newInteractionData = checkAndResetWindow({ ...interactionData }, now);
                      
                      if (newInteractionData.feedCount2Hour >= 2) {
                        showPetDialogue("I'm full now! Let me rest for a while~");
                        return;
                      }
                      
                      // Update interaction data
                      if (newInteractionData.feedCount2Hour === 0) {
                        newInteractionData.feedWindowStart = now.toISOString();
                      }
                      newInteractionData.feedCount2Hour++;
                      saveInteractionData(newInteractionData);
                      
                      // Update pet data locally
                      if (pet) {
                        const updatedPet = {
                          ...pet,
                          hunger: Math.max(0, pet.hunger - 20),
                          energy: Math.min(100, pet.energy + 20)
                        };
                        setPet(updatedPet);
                        setLastLocalUpdate(Date.now());
                        
                        // Save to localStorage for persistence
                        localStorage.setItem('widget_pet_data', JSON.stringify(updatedPet));
                        
                        // Sync to main app via Tauri event
                        try {
                          // @ts-ignore
                          if (window.__TAURI__) {
                            // @ts-ignore
                            const { emit } = await import('@tauri-apps/api/event');
                            // @ts-ignore
                            await emit('widget-pet-action', { 
                              action: 'feed', 
                              pet: updatedPet,
                              interactionData: newInteractionData
                            });
                          }
                        } catch (err) {
                          console.log('Failed to sync feed action:', err);
                        }
                      }
                      
                      // Show dialogue
                      showPetDialogue("Yum yum! That was delicious!");
                      
                      // Play feed video
                      const video = document.querySelector('video') as HTMLVideoElement;
                      if (video) {
                        video.loop = false;
                        video.src = `/${pet.pet_type}_feed.mp4`;
                        video.play();
                        
                        const handleEnded = () => {
                          video.loop = true;
                          video.src = `/${pet.pet_type}_idle.mp4`;
                          video.play();
                          video.removeEventListener('ended', handleEnded);
                        };
                        
                        video.addEventListener('ended', handleEnded);
                      }
                    }}
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
                    <i className="fa-solid fa-utensils mr-1"></i>
                    Feed
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      
                      // Check play limit (2 times per 2 hours)
                      const now = new Date();
                      let newInteractionData = checkAndResetWindow({ ...interactionData }, now);
                      
                      if (newInteractionData.playCount2Hour >= 2) {
                        showPetDialogue("I'm tired from playing! Let me rest for a while~");
                        return;
                      }
                      
                      // Update interaction data
                      if (newInteractionData.playCount2Hour === 0) {
                        newInteractionData.playWindowStart = now.toISOString();
                      }
                      newInteractionData.playCount2Hour++;
                      saveInteractionData(newInteractionData);
                      
                      // Update pet data locally
                      if (pet) {
                        const updatedPet = {
                          ...pet,
                          happiness: Math.min(100, pet.happiness + 15),
                          energy: Math.max(0, pet.energy - 15)
                        };
                        setPet(updatedPet);
                        setLastLocalUpdate(Date.now());
                        
                        // Save to localStorage for persistence
                        localStorage.setItem('widget_pet_data', JSON.stringify(updatedPet));
                        
                        // Sync to main app via Tauri event
                        try {
                          // @ts-ignore
                          if (window.__TAURI__) {
                            // @ts-ignore
                            const { emit } = await import('@tauri-apps/api/event');
                            // @ts-ignore
                            await emit('widget-pet-action', { 
                              action: 'play', 
                              pet: updatedPet,
                              interactionData: newInteractionData
                            });
                          }
                        } catch (err) {
                          console.log('Failed to sync play action:', err);
                        }
                      }
                      
                      // Show dialogue
                      showPetDialogue("That was fun! Let's play again soon!");
                      
                      // Play play video
                      const video = document.querySelector('video') as HTMLVideoElement;
                      if (video) {
                        video.loop = false;
                        video.src = `/${pet.pet_type}_play.mp4`;
                        video.play();
                        
                        const handleEnded = () => {
                          video.loop = true;
                          video.src = `/${pet.pet_type}_idle.mp4`;
                          video.play();
                          video.removeEventListener('ended', handleEnded);
                        };
                        
                        video.addEventListener('ended', handleEnded);
                      }
                    }}
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
                    <i className="fa-solid fa-gamepad mr-1"></i>
                    Play
                  </button>
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
