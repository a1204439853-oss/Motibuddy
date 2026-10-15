import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@/contexts/authContext';
import { TaskContext } from '@/contexts/taskContext';
import TaskList from '@/components/tasks/TaskList';
import TaskForm from '@/components/tasks/TaskForm';
import PetDisplay from '@/components/pet/PetDisplay';
import StatisticsPanel from '@/components/statistics/StatisticsPanel';
import Navbar from '@/components/ui/Navbar';
import Sidebar from '@/components/ui/Sidebar';
import VoiceInput from '@/components/voice/VoiceInput';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { TaskPriority } from '@/types';

const MainApp = () => {
  const { currentUser, currentPet, logout, isAuthenticated } = useContext(AuthContext);
  const { addTask } = useContext(TaskContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'tasks' | 'statistics'>('tasks');
  const [isTaskFormOpen, setIsTaskFormOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  const navigate = useNavigate();

  // Handle voice task creation
  const handleVoiceTaskCreated = async (task: {
    title: string;
    description?: string;
    dueDate?: Date;
    priority?: TaskPriority;
  }) => {
    try {
      await addTask({
        title: task.title,
        description: task.description || '',
        dueDate: task.dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000),
        priority: task.priority || TaskPriority.MEDIUM
      });
    } catch (error) {
      toast.error('Failed to create task: ' + (error as Error).message);
      throw error;
    }
  };

  // Check if user is authenticated and has a pet
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else if (!currentPet) {
      navigate('/create-pet');
    }
  }, [currentUser, currentPet, navigate]);

  // If no user or pet, show loading
  if (!currentUser || !currentPet) {
    return (
      <div style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        backgroundColor: 'white',
        backgroundImage: `url('main_bg.webp')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* White overlay with 88% opacity */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'white',
          opacity: 0.88,
          zIndex: 0
        }}></div>

        <div className="text-center" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: '#FF5E5B',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 8px',
            boxShadow: '2px 2px 0 #222222',
            border: '2px solid #222222',
            animation: 'pulse 1.5s infinite'
          }}>
            <i className="fa-solid fa-paw text-white text-lg"></i>
          </div>
          <h2 style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#222222',
            fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)'
          }}>Loading your MotiBuddy...</h2>
        </div>

        {/* Animation styles are now inline */}
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    toast.success('You have been logged out');
    navigate('/login');
  };

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      overflow: 'hidden',
      backgroundColor: 'white',
      backgroundImage: `url('main_bg.webp')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      {/* White overlay with 80% opacity */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
        opacity: 0.88,
        zIndex: 0
      }}></div>
      {/* Content */}
      <div style={{
        minHeight: '100vh',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Navbar */}
        <Navbar
          currentUser={currentUser}
          currentPet={currentPet}
          onLogout={handleLogout}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 48px)' }}>
          {/* Sidebar */}
          <motion.div
            initial={false}
            animate={{ width: isSidebarOpen ? '22%' : '0px' }}
            className="bg-white shadow-lg overflow-hidden transition-all duration-300 flex flex-col h-full"
            style={{
              boxShadow: '3px 0 0 rgba(0, 0, 0, 0.1)',
              minHeight: '100%',
              maxWidth: '280px',
              minWidth: isSidebarOpen ? '240px' : '0px'
            }}
          >
            {isSidebarOpen && (
              <Sidebar
                activeView={activeView}
                setActiveView={setActiveView}
                currentUser={currentUser}
                currentPet={currentPet}
                isAuthenticated={isAuthenticated}
              />
            )}
          </motion.div>

          {/* Main content */}
          <div className="flex-1 overflow-hidden p-2 lg:p-3" style={{ height: '100%' }}>
            <div className="h-full flex flex-col">
              <div className="flex flex-col lg:flex-row gap-2 lg:gap-3 flex-1" style={{ minHeight: 0 }}>
                {/* Task management section */}
                <div className="flex-1 min-w-0" style={{ minHeight: 0 }}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-1">
                    <h1 style={{
                      fontSize: 'clamp(16px, 2.2vw, 22px)',
                      fontWeight: 'bold',
                      color: '#222222',
                      fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
                      textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)'
                    }}>
                      {activeView === 'tasks' ? 'Your Tasks' : 'Your Statistics'}
                    </h1>

                    {activeView === 'tasks' && (
                      <div className="flex gap-2" style={{ marginTop: '24px' }}>
                        <VoiceInput onTaskCreated={handleVoiceTaskCreated} />
                        <button
                          onClick={() => setIsTaskFormOpen(!isTaskFormOpen)}
                          style={{
                            backgroundColor: '#00CECB',
                            color: 'black',
                            border: '1px solid #222222',
                            padding: '4px 14px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            boxShadow: '2px 2px 0 #222222',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap',
                            height: '28px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translate(1px, 1px)';
                            e.currentTarget.style.boxShadow = '1px 1px 0 #222222';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translate(0, 0)';
                            e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
                          }}
                          onMouseDown={(e) => {
                            e.currentTarget.style.transform = 'translate(2px, 2px)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                          onMouseUp={(e) => {
                            e.currentTarget.style.transform = 'translate(1px, 1px)';
                            e.currentTarget.style.boxShadow = '1px 1px 0 #222222';
                          }}
                        >
                          <i className="fa-solid fa-plus text-xs"></i>
                          <span>Add Task</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Task form */}
                  {isTaskFormOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="mb-2 bg-white p-2 rounded border-2 border-black"
                      style={{
                        boxShadow: '2px 2px 0 #222222'
                      }}
                    >
                      <TaskForm
                        onClose={() => {
                          setIsTaskFormOpen(false);
                          setEditingTask(null);
                        }}
                        task={editingTask}
                      />
                    </motion.div>
                  )}

                  {/* Content based on active view */}
                  <div style={{
                    boxShadow: 'none',
                    borderRadius: '6px',
                    overflow: 'visible',
                    height: isTaskFormOpen ? 'calc(100% - 70px)' : 'calc(100% - 28px)',
                    minHeight: '160px',
                    padding: '1px'
                  }}>
                    {activeView === 'tasks' ? (
                      <TaskList
                        onEditTask={(task) => {
                          setEditingTask(task);
                          setIsTaskFormOpen(true);
                        }}
                      />
                    ) : (
                      <StatisticsPanel />
                    )}
                  </div>
                </div>

                {/* Pet section */}
                <div className="w-full lg:w-[32%] xl:w-[30%]" style={{ minWidth: '280px', maxWidth: '380px' }}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white p-2 lg:p-3 rounded border-2 border-black h-full"
                    style={{
                      boxShadow: '2px 2px 0 #222222',
                      minHeight: '220px',
                      maxHeight: 'calc(100vh - 140px)',
                      overflow: 'auto'
                    }}
                  >
                    <PetDisplay />
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainApp;
