// Security question options
export const SECURITY_QUESTIONS = [
  { id: 'birthplace', text: 'What is your birthplace?' },
  { id: 'primary_teacher', text: 'What is your primary school teacher\'s name?' },
  { id: 'parents_meet', text: 'In which city did your parents meet?' },
  { id: 'pet_name', text: 'What was the name of your first pet?' },
  { id: 'middle_school', text: 'What is your middle school name?' }
] as const;

export type SecurityQuestionId = typeof SECURITY_QUESTIONS[number]['id'];

export interface SecurityInfo {
  question1: { questionId: SecurityQuestionId; answer: string } | null;
  question2: { questionId: SecurityQuestionId; answer: string } | null;
}

// User types
export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  avatar: string;
  createdAt: string;
  achievements?: Achievement[];
  securityInfo?: SecurityInfo;
}

// Task types
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue'
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: Date;
  completedAt?: Date;
  estimatedDuration?: number; // in minutes
  reminders?: {
    time: Date;
    sent: boolean;
  }[];
}

// Pet types
export enum PetType {
  CAT = 'cat',
  DOG = 'dog',
  PANDA = 'panda',
  BIRD = 'bird'
}

export interface Pet {
  id: string;
  userId: string;
  name: string;
  type: PetType;
  level: number;
  experience: number;
  health: number;
  happiness: number;
  hunger: number;
  energy: number;
  lastInteraction: Date;
  lastFed: Date;
  createdAt: Date;
}

// Achievement types
export enum AchievementType {
  EARLY_BIRD = 'early_bird',
  PRODUCTIVITY_MASTER = 'productivity_master',
  PUNCTUALITY_PRO = 'punctuality_pro',
  PET_FRIEND = 'pet_friend',
  MIDNIGHT_WARRIOR = 'midnight_warrior',
  SPEEDSTER = 'speedster',
  PERFECTIONIST = 'perfectionist',
  FIRST_TASK = 'first_task',
  THREE_DAY_STREAK = 'three_day_streak',
  SEVEN_DAY_STREAK = 'seven_day_streak',
  THIRTY_DAY_STREAK = 'thirty_day_streak',
  TEN_TASKS_DAY = 'ten_tasks_day'
}

export interface Achievement {
  id: string;
  type: AchievementType;
  name: string;
  description: string;
  unlockedAt: Date;
  icon: string;
}

// Statistics types
export interface Statistics {
  userId: string;
  totalTasks: number;
  completedTasks: number;
  averageCompletionTime: number; // in minutes
  streakDays: number;
  taskCompletionRate: number; // percentage
  performanceOverTime: {
    date: string;
    completedTasks: number;
  }[];
  categoryDistribution: {
    category: string;
    count: number;
  }[];
}