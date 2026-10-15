import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { t, getLocale } from '../i18n/core';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format date to readable string
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Format date for input fields
export const formatDateForInput = (date: Date): string => {
  return date.toISOString().slice(0, 16);
};

// Calculate time remaining until deadline
export const getTimeRemaining = (deadline: Date): string => {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  
  if (diff <= 0) return t('Overdue');
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return t(days > 1 ? '{count} days left' : '{count} day left', { count: days });
  if (hours > 0) return t(hours > 1 ? '{count} hours left' : '{count} hour left', { count: hours });
  return t(minutes > 1 ? '{count} minutes left' : '{count} minute left', { count: minutes });
};

// Generate unique ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};
