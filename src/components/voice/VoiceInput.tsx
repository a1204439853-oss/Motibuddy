import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getVoiceRecognitionService, SpeechRecognitionResultType } from '@/services/voiceRecognition';
import { parseTaskFromText, validateParsedTask, formatParsedTaskForDisplay, ParsedTaskInfo } from '@/services/nlpParser';
import { TaskPriority } from '@/types';

interface VoiceInputProps {
  onTaskCreated?: (task: {
    title: string;
    description?: string;
    dueDate?: Date;
    priority?: TaskPriority;
  }) => void | Promise<void>;
}

const VoiceInput = ({ onTaskCreated }: VoiceInputProps) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [parsedTask, setParsedTask] = useState<ParsedTaskInfo | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState(false);
  const recognitionService = useRef(getVoiceRecognitionService());

  // Check browser support
  useEffect(() => {
    setIsSupported(recognitionService.current.isSupported());
  }, []);

  // Check if running in Tauri
  const isTauri = () => {
    return typeof window !== 'undefined' && !!(window as any).__TAURI__;
  };

  // Request microphone permission
  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // In Tauri, this might be a WebView2 limitation
        if (isTauri()) {
          toast.error(
            'Microphone access is blocked by WebView2.\n\n' +
            'Please try these solutions:\n' +
            '1. Close MotiBuddy completely\n' +
            '2. Open Windows Settings > Privacy > Microphone\n' +
            '3. Turn OFF "Allow apps to access microphone"\n' +
            '4. Turn it back ON\n' +
            '5. Restart MotiBuddy\n\n' +
            'If still not working, you may need to use the browser version.',
            { duration: 15000 }
          );
        } else {
          toast.error('Your browser does not support microphone access. Please use a modern browser.');
        }
        return false;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('Microphone permission granted');
      return true;
    } catch (error: any) {
      console.error('Microphone permission error:', error);
      
      // Provide specific error messages
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        if (isTauri()) {
          toast.error(
            'Microphone access denied by WebView2.\n\n' +
            'Solutions:\n' +
            '1. Windows Settings > Privacy > Microphone > Allow apps to access microphone: ON\n' +
            '2. Restart MotiBuddy\n' +
            '3. If still not working, use browser version at localhost:3000',
            { duration: 12000 }
          );
        } else {
          toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
        }
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError') {
        toast.error('Microphone is already in use by another application.');
      } else {
        toast.error(`Microphone error: ${error.message || 'Unknown error'}`);
      }
      
      return false;
    }
  };

  // Start voice recognition
  const startVoiceRecognition = useCallback(async () => {
    if (!isSupported) {
      toast.error('Your browser does not support voice recognition');
      return;
    }

    // Request microphone permission first
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      return;
    }

    setIsRecording(true);
    setRecognizedText('');
    setInterimText('');
    setParsedTask(null);
    setShowConfirmation(false);

    toast.info('Listening... Please speak your task');

    const success = recognitionService.current.start(
      // Recognition result callback
      (result: SpeechRecognitionResultType) => {
        if (result.isFinal) {
          setRecognizedText(prev => {
            const newText = prev ? `${prev} ${result.transcript}` : result.transcript;
            // Parse task information
            const parsed = parseTaskFromText(newText);
            setParsedTask(parsed);
            return newText;
          });
          setInterimText('');
        } else {
          setInterimText(result.transcript);
        }
      },
      // Error callback
      (error: string) => {
        console.error('Voice recognition error:', error);
        let errorMessage = 'Voice recognition error';
        
        switch (error) {
          case 'no-speech':
            errorMessage = 'No speech detected, please try again';
            break;
          case 'audio-capture':
            errorMessage = 'Cannot access microphone';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone permission denied';
            break;
          case 'network':
            errorMessage = 'Network error, please check your connection';
            break;
          case 'aborted':
            errorMessage = 'Recognition cancelled';
            break;
          default:
            errorMessage = `Error: ${error}`;
        }
        
        toast.error(errorMessage);
        setIsRecording(false);
      },
      // End callback
      () => {
        setIsRecording(false);
        
        // If there is recognition result, show confirmation dialog
        // Use a small delay to ensure state is updated
        setTimeout(() => {
          setInterimText('');
          setRecognizedText(prev => {
            const finalText = prev || interimText;
            if (finalText) {
              const parsed = parseTaskFromText(finalText);
              setParsedTask(parsed);
              setShowConfirmation(true);
            }
            return prev;
          });
        }, 100);
      }
    );

    if (!success) {
      toast.error('Cannot start voice recognition');
      setIsRecording(false);
    }
  }, [isSupported, recognizedText, interimText]);

  // Stop voice recognition
  const stopVoiceRecognition = useCallback(() => {
    recognitionService.current.stop();
    setIsRecording(false);
    setInterimText('');
  }, []);

  // Confirm create task
  const confirmCreateTask = useCallback(async () => {
    if (!parsedTask || isCreating) return;

    const validation = validateParsedTask(parsedTask);
    if (!validation.isValid) {
      toast.error(validation.errors.join('\n'));
      return;
    }

    // Convert priority
    let priority: TaskPriority | undefined;
    if (parsedTask.priority) {
      const priorityMap: { [key: string]: TaskPriority } = {
        'urgent': TaskPriority.URGENT,
        'high': TaskPriority.HIGH,
        'medium': TaskPriority.MEDIUM,
        'low': TaskPriority.LOW
      };
      priority = priorityMap[parsedTask.priority];
    }

    // Create task
    setIsCreating(true);
    try {
      if (!onTaskCreated) throw new Error('Task creation is unavailable');
      await onTaskCreated({
        title: parsedTask.title,
        description: parsedTask.description,
        dueDate: parsedTask.dueDate,
        priority
      });
      toast.success('Task created successfully!');

      // Reset only after the task has been saved.
      setRecognizedText('');
      setParsedTask(null);
      setShowConfirmation(false);
    } catch {
      toast.error('Task was not saved. Your recognized text has been kept. Please retry.');
    } finally { setIsCreating(false); }
  }, [parsedTask, onTaskCreated, isCreating]);

  // Cancel creation
  const cancelCreateTask = useCallback(() => {
    setRecognizedText('');
    setParsedTask(null);
    setShowConfirmation(false);
    toast.info('Task creation cancelled');
  }, []);

  // Retry recognition
  const retryRecognition = useCallback(() => {
    setRecognizedText('');
    setParsedTask(null);
    setShowConfirmation(false);
    startVoiceRecognition();
  }, [startVoiceRecognition]);

  // Stop recognition when component unmounts
  useEffect(() => {
    return () => {
      if (isRecording) {
        recognitionService.current.abort();
      }
    };
  }, [isRecording]);

  return (
    <div className="relative">
      {/* Voice input button - 统一风格 */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={isRecording ? stopVoiceRecognition : startVoiceRecognition}
        disabled={!isSupported}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isRecording ? '#FF5E5B' : 'white',
          color: isRecording ? 'white' : '#222222',
          border: '1px solid #222222',
          boxShadow: '2px 2px 0 #222222',
          cursor: isSupported ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease'
        }}
        title={isSupported ? "Add task using voice" : "Your browser does not support voice recognition"}
      >
        <i 
          className={`fa-solid ${isRecording ? 'fa-microphone-lines' : 'fa-microphone'}`}
          style={{ fontSize: '13px' }}
        ></i>
      </motion.button>

      {/* Recording status indicator - 统一风格 */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 50
            }}
          >
            <div style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              padding: '12px 16px',
              minWidth: '280px',
              border: '2px solid #222222',
              boxShadow: '3px 3px 0 #222222'
            }}>
              {/* Waveform animation */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                marginBottom: '12px'
              }}>
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    style={{
                      width: '4px',
                      backgroundColor: '#FF5E5B',
                      borderRadius: '2px'
                    }}
                    animate={{
                      height: [10, 30, 10],
                    }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
              
              {/* Recognition text display */}
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  color: '#222222',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  minHeight: '1.5em',
                  fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif'
                }}>
                  {recognizedText}
                  <span style={{ color: '#888888' }}>{interimText}</span>
                  {!recognizedText && !interimText && 'Listening...'}
                </p>
                <p style={{
                  fontSize: '10px',
                  color: '#666666',
                  marginTop: '8px',
                  fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif'
                }}>
                  Click microphone button to stop recording
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task confirmation dialog - 统一风格 */}
      <AnimatePresence>
        {showConfirmation && parsedTask && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 50
            }}
          >
            <div style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              padding: '16px',
              width: '320px',
              border: '2px solid #222222',
              boxShadow: '3px 3px 0 #222222'
            }}>
              <h4 style={{
                fontWeight: 'bold',
                color: '#222222',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif'
              }}>
                <i className="fa-solid fa-check-circle" style={{ color: '#00CECB', marginRight: '8px' }}></i>
                Confirm Create Task
              </h4>
              
              {/* Parse result display */}
              <div style={{
                backgroundColor: '#f9f9f9',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px',
                fontSize: '12px',
                whiteSpace: 'pre-line',
                border: '1px solid #e0e0e0',
                fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
                color: '#222222'
              }}>
                {formatParsedTaskForDisplay(parsedTask)}
              </div>

              {/* Confidence warning */}
              {parsedTask.confidence < 0.7 && (
                <div style={{
                  backgroundColor: '#FFF9E6',
                  borderLeft: '3px solid #FFD700',
                  padding: '8px',
                  marginBottom: '12px',
                  fontSize: '11px',
                  color: '#222222',
                  fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif'
                }}>
                  <i className="fa-solid fa-exclamation-triangle" style={{ marginRight: '4px', color: '#FFD700' }}></i>
                  Low confidence parsing, please check if the information is correct
                </div>
              )}

              {/* Action buttons - 统一风格 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={confirmCreateTask}
                  disabled={isCreating}
                  style={{
                    flex: 1,
                    backgroundColor: '#00CECB',
                    color: '#222222',
                    border: '1px solid #222222',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0 #222222',
                    fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translate(1px, 1px)';
                    e.currentTarget.style.boxShadow = '1px 1px 0 #222222';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translate(0, 0)';
                    e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
                  }}
                >
                  <i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i>
                  Confirm
                </button>
                <button
                  onClick={retryRecognition}
                  style={{
                    flex: 1,
                    backgroundColor: '#FFD700',
                    color: '#222222',
                    border: '1px solid #222222',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0 #222222',
                    fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translate(1px, 1px)';
                    e.currentTarget.style.boxShadow = '1px 1px 0 #222222';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translate(0, 0)';
                    e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
                  }}
                >
                  <i className="fa-solid fa-rotate-right" style={{ marginRight: '4px' }}></i>
                  Retry
                </button>
                <button
                  onClick={cancelCreateTask}
                  style={{
                    flex: 1,
                    backgroundColor: '#FF5E5B',
                    color: '#222222',
                    border: '1px solid #222222',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0 #222222',
                    fontFamily: 'Comic Sans MS, Arial Rounded MT Bold, Helvetica, sans-serif',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translate(1px, 1px)';
                    e.currentTarget.style.boxShadow = '1px 1px 0 #222222';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translate(0, 0)';
                    e.currentTarget.style.boxShadow = '2px 2px 0 #222222';
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceInput;
