/**
 * NLP Task Information Parser Service
 * Extract task information from speech recognition text
 */

import nlp from 'compromise';
import { t, getLocale } from '../i18n/core';
import { parse, addDays, addWeeks, addMonths, setHours, setMinutes, startOfDay, isValid } from 'date-fns';

export interface ParsedTaskInfo {
  title: string;
  description?: string;
  dueDate?: Date;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  confidence: number; // Parsing confidence 0-1
}

/**
 * Parse task information
 * @param text Speech recognition text
 * @returns Parsed task information
 */
export function parseTaskFromText(text: string): ParsedTaskInfo {
  const result: ParsedTaskInfo = {
    title: text.trim(),
    confidence: 0.5
  };

  // 1. Extract due date
  const dateInfo = extractDate(text);
  if (dateInfo.date) {
    result.dueDate = dateInfo.date;
    result.confidence += 0.2;
  }

  // 2. Extract priority
  const priority = extractPriority(text);
  if (priority) {
    result.priority = priority;
    result.confidence += 0.1;
  }

  // 3. Extract task title (remove time, priority modifiers)
  result.title = extractTitle(text, dateInfo.matchedText);

  // 4. Extract tags
  result.tags = extractTags(text);
  if (result.tags.length > 0) {
    result.confidence += 0.1;
  }

  // 5. Generate description
  result.description = generateDescription(text, result);

  // Ensure confidence does not exceed 1
  result.confidence = Math.min(result.confidence, 1);

  return result;
}

/**
 * Extract date time from text
 */
function extractDate(text: string): { date?: Date; matchedText: string } {
  const now = new Date();
  let matchedText = '';
  let targetDate: Date | undefined;

  // English date patterns
  const patterns = [
    // Today/Tomorrow/Day after tomorrow + time
    { regex: /(today|tomorrow|day after tomorrow)\s*(morning|afternoon|evening|night)?\s*(at\s*)?(\d{1,2})(:\d{1,2})?\s*(am|pm)?/i, handler: (match: RegExpMatchArray) => {
      const dayMap: { [key: string]: number } = { 'today': 0, 'tomorrow': 1, 'day after tomorrow': 2 };
      const dayOffset = dayMap[match[1].toLowerCase()] || 0;
      let hour: number;
      const minute = parseInt(match[5]?.replace(':', '') || '0');
      const ampm = match[6]?.toLowerCase();
      
      // If specific time is provided (match[4]), use it
      if (match[4]) {
        hour = parseInt(match[4]);
        // Handle AM/PM
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
      } else if (match[2]) {
        // Use morning/afternoon/evening/night default times
        const timeMap: { [key: string]: number } = { 'morning': 9, 'afternoon': 14, 'evening': 18, 'night': 20 };
        hour = timeMap[match[2].toLowerCase()] || 9;
      } else {
        // Default to 9 AM
        hour = 9;
      }
      
      let date = addDays(startOfDay(now), dayOffset);
      date = setHours(date, hour);
      date = setMinutes(date, minute);
      return date;
    }},
    
    // Today/Tomorrow/Day after tomorrow
    { regex: /\b(today|tomorrow|day after tomorrow)\b/i, handler: (match: RegExpMatchArray) => {
      const dayMap: { [key: string]: number } = { 'today': 0, 'tomorrow': 1, 'day after tomorrow': 2 };
      const dayOffset = dayMap[match[1].toLowerCase()] || 0;
      let date = addDays(startOfDay(now), dayOffset);
      date = setHours(date, 9); // Default 9 AM
      return date;
    }},
    
    // Next week X with optional time (supports "11 AM", "11:00 AM", "11" with am/pm)
    { regex: /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*,?\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i, handler: (match: RegExpMatchArray) => {
      const dayMap: { [key: string]: number } = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
      const targetDay = dayMap[match[1].toLowerCase()];
      const currentDay = now.getDay();
      const daysUntilTarget = (targetDay + 7 - currentDay) % 7 + 7;
      let date = addDays(startOfDay(now), daysUntilTarget);
      
      // Extract time if provided
      let hour = 9; // Default 9 AM
      let minute = 0;
      
      if (match[2]) {
        hour = parseInt(match[2]);
        minute = match[3] ? parseInt(match[3]) : 0;
        const ampm = match[4]?.toLowerCase();
        
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
      }
      
      date = setHours(date, hour);
      date = setMinutes(date, minute);
      return date;
    }},
    
    // This week X with optional time (supports "11 AM", "11:00 AM", "11" with am/pm)
    { regex: /this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*,?\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i, handler: (match: RegExpMatchArray) => {
      const dayMap: { [key: string]: number } = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0 };
      const targetDay = dayMap[match[1].toLowerCase()];
      const currentDay = now.getDay();
      const daysUntilTarget = (targetDay + 7 - currentDay) % 7;
      let date = addDays(startOfDay(now), daysUntilTarget);
      
      // Extract time if provided
      let hour = 9; // Default 9 AM
      let minute = 0;
      
      if (match[2]) {
        hour = parseInt(match[2]);
        minute = match[3] ? parseInt(match[3]) : 0;
        const ampm = match[4]?.toLowerCase();
        
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
      }
      
      date = setHours(date, hour);
      date = setMinutes(date, minute);
      return date;
    }},
    
    // In X days
    { regex: /in\s+(\d+)\s+days?/i, handler: (match: RegExpMatchArray) => {
      const days = parseInt(match[1]);
      let date = addDays(startOfDay(now), days);
      date = setHours(date, 9);
      return date;
    }},
    
    // In X weeks
    { regex: /in\s+(\d+)\s+weeks?/i, handler: (match: RegExpMatchArray) => {
      const weeks = parseInt(match[1]);
      let date = addWeeks(startOfDay(now), weeks);
      date = setHours(date, 9);
      return date;
    }},
    
    // In X months
    { regex: /in\s+(\d+)\s+months?/i, handler: (match: RegExpMatchArray) => {
      const months = parseInt(match[1]);
      let date = addMonths(startOfDay(now), months);
      date = setHours(date, 9);
      return date;
    }},
    
    // Specific date MM/DD or MM-DD
    { regex: /(\d{1,2})[\/-](\d{1,2})/, handler: (match: RegExpMatchArray) => {
      const month = parseInt(match[1]) - 1;
      const day = parseInt(match[2]);
      let date = new Date(now.getFullYear(), month, day, 9, 0, 0);
      // If date has passed, set to next year
      if (date < now) {
        date = new Date(now.getFullYear() + 1, month, day, 9, 0, 0);
      }
      return date;
    }},
    
    // Full date with month name and optional time: February 28, 2026 at 2:00 PM
    { regex: /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:,)?\s*(\d{4})?\s*(?:at\s*)?(\d{1,2}):(\d{2})?\s*(am|pm)?/i, handler: (match: RegExpMatchArray) => {
      const monthMap: { [key: string]: number } = {
        'january': 0, 'jan': 0,
        'february': 1, 'feb': 1,
        'march': 2, 'mar': 2,
        'april': 3, 'apr': 3,
        'may': 4,
        'june': 5, 'jun': 5,
        'july': 6, 'jul': 6,
        'august': 7, 'aug': 7,
        'september': 8, 'sept': 8, 'sep': 8,
        'october': 9, 'oct': 9,
        'november': 10, 'nov': 10,
        'december': 11, 'dec': 11
      };
      const month = monthMap[match[1].toLowerCase()];
      const day = parseInt(match[2]);
      const year = match[3] ? parseInt(match[3]) : now.getFullYear();
      
      // Extract time if provided
      let hour = 9; // Default 9 AM
      let minute = 0;
      
      if (match[4] && match[5]) {
        hour = parseInt(match[4]);
        minute = parseInt(match[5]);
        const ampm = match[6]?.toLowerCase();
        
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
      }
      
      let date = new Date(year, month, day, hour, minute, 0);
      return date;
    }},
    
    // Full date with month name (without time): February 28, 2026
    { regex: /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:,)?\s*(\d{4})?/i, handler: (match: RegExpMatchArray) => {
      const monthMap: { [key: string]: number } = {
        'january': 0, 'jan': 0,
        'february': 1, 'feb': 1,
        'march': 2, 'mar': 2,
        'april': 3, 'apr': 3,
        'may': 4,
        'june': 5, 'jun': 5,
        'july': 6, 'jul': 6,
        'august': 7, 'aug': 7,
        'september': 8, 'sept': 8, 'sep': 8,
        'october': 9, 'oct': 9,
        'november': 10, 'nov': 10,
        'december': 11, 'dec': 11
      };
      const month = monthMap[match[1].toLowerCase()];
      const day = parseInt(match[2]);
      const year = match[3] ? parseInt(match[3]) : now.getFullYear();
      let date = new Date(year, month, day, 9, 0, 0);
      return date;
    }},
    
    // Time with AM/PM: 2:00 PM, 2 PM
    { regex: /(\d{1,2}):(\d{2})\s*(am|pm)/i, handler: (match: RegExpMatchArray) => {
      let hour = parseInt(match[1]);
      const minute = parseInt(match[2]);
      const ampm = match[3].toLowerCase();
      
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      
      let date = startOfDay(now);
      date = setHours(date, hour);
      date = setMinutes(date, minute);
      
      // If time has passed, set to tomorrow
      if (date <= now) {
        date = addDays(date, 1);
      }
      return date;
    }},
    
    // Evening/Afternoon/Morning + time
    { regex: /(morning|afternoon|evening|night)\s*(at\s*)?(\d{1,2})(:\d{1,2})?/i, handler: (match: RegExpMatchArray) => {
      let hour = parseInt(match[3]);
      const minute = parseInt(match[4]?.replace(':', '') || '0');
      
      const timeMap: { [key: string]: number } = { 'morning': 9, 'afternoon': 14, 'evening': 18, 'night': 20 };
      hour = timeMap[match[1].toLowerCase()] || hour;
      
      let date = startOfDay(now);
      // If specified time has passed, set to tomorrow
      const targetTime = setMinutes(setHours(date, hour), minute);
      if (targetTime <= now) {
        date = addDays(date, 1);
      }
      date = setHours(date, hour);
      date = setMinutes(date, minute);
      return date;
    }},
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      matchedText = match[0];
      targetDate = pattern.handler(match);
      if (isValid(targetDate)) {
        break;
      }
    }
  }

  return { date: targetDate, matchedText };
}

/**
 * Extract priority from text
 */
function extractPriority(text: string): 'low' | 'medium' | 'high' | 'urgent' | undefined {
  const lowerText = text.toLowerCase();
  
  // Urgent
  if (/\b(urgent|asap|critical|immediately|right away)\b/i.test(lowerText)) {
    return 'urgent';
  }
  
  // High priority
  if (/\b(high priority|important|crucial|essential)\b/i.test(lowerText)) {
    return 'high';
  }
  
  // Low priority
  if (/\b(low priority|whenever|someday|not urgent)\b/i.test(lowerText)) {
    return 'low';
  }
  
  // Default medium
  return undefined;
}

/**
 * Extract task title - keep only the core subject (verb + object)
 * Example: "I have a meeting next Friday" -> "have a meeting"
 */
function extractTitle(text: string, dateText: string): string {
  let title = text;
  
  // Remove date time part
  if (dateText) {
    title = title.replace(dateText, '');
  }
  
  // Remove common prefix words and phrases (including pronouns)
  const prefixes = [
    'remember to', 'need to', 'have to', 'should', 'please', 'help me', 
    'add', 'create', 'make', 'set up', 'i', 'we', 'you', 'they', 'he', 'she',
    'i\'m', 'we\'re', 'you\'re', 'they\'re', 'he\'s', 'she\'s',
    'i am', 'we are', 'you are', 'they are', 'he is', 'she is',
    'let\'s', 'lets', 'want to', 'would like to', 'plan to', 'going to',
    'gonna', 'wanna', 'need', 'want'
  ];
  
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\s+`, 'i');
    title = title.replace(regex, '');
  }
  
  // Remove priority words
  const priorityWords = [
    'urgent', 'important', 'high priority', 'low priority', 'critical', 'asap'
  ];
  
  for (const word of priorityWords) {
    const regex = new RegExp(`\\s*${word}\\s*`, 'gi');
    title = title.replace(regex, ' ');
  }
  
  // Clean up extra spaces
  title = title.trim().replace(/\s+/g, ' ');
  
  // If title is empty, use original text
  if (!title) {
    title = text.trim();
  }
  
  // Limit title length
  if (title.length > 50) {
    title = title.substring(0, 50) + '...';
  }
  
  return title;
}

/**
 * Extract tags
 */
function extractTags(text: string): string[] {
  const tags: string[] = [];
  
  // Match #tag format
  const hashTags = text.match(/#([^\s#]+)/g);
  if (hashTags) {
    tags.push(...hashTags.map(tag => tag.substring(1)));
  }
  
  // Match common category words
  const categories = [
    { keywords: ['work', 'office', 'project', 'meeting', 'report', 'job', 'business'], tag: 'work' },
    { keywords: ['study', 'exam', 'course', 'homework', 'learn', 'class', 'education'], tag: 'study' },
    { keywords: ['life', 'shopping', 'housework', 'cooking', 'cleaning', 'daily'], tag: 'life' },
    { keywords: ['health', 'exercise', 'doctor', 'medicine', 'fitness', 'gym'], tag: 'health' },
    { keywords: ['entertainment', 'movie', 'game', 'travel', 'fun', 'relax'], tag: 'entertainment' },
    { keywords: ['finance', 'bill', 'payment', 'money', 'bank', 'budget'], tag: 'finance' },
  ];
  
  const lowerText = text.toLowerCase();
  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        if (!tags.includes(category.tag)) {
          tags.push(category.tag);
        }
        break;
      }
    }
  }
  
  return tags;
}

/**
 * Generate task description
 */
function generateDescription(text: string, parsedInfo: ParsedTaskInfo): string | undefined {
  const parts: string[] = [];
  
  // Add original voice text
  parts.push(`🎤 Voice input: "${text}"`);
  
  // Add parsed information
  if (parsedInfo.dueDate) {
    parts.push(`📅 Due date: ${parsedInfo.dueDate.toLocaleString('en-US')}`);
  }
  
  if (parsedInfo.priority) {
    const priorityMap: { [key: string]: string } = {
      'urgent': '🔴 Urgent',
      'high': '🟠 High',
      'medium': '🟡 Medium',
      'low': '🟢 Low'
    };
    parts.push(`⚡ Priority: ${priorityMap[parsedInfo.priority]}`);
  }
  
  if (parsedInfo.tags && parsedInfo.tags.length > 0) {
    parts.push(`🏷️ Tags: ${parsedInfo.tags.join(', ')}`);
  }
  
  return parts.join('\n');
}

/**
 * Validate parsing result
 */
export function validateParsedTask(info: ParsedTaskInfo): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!info.title || info.title.trim().length === 0) {
    errors.push('Task title cannot be empty');
  }
  
  if (info.title && info.title.length > 100) {
    errors.push('Task title too long (max 100 characters)');
  }
  
  if (info.dueDate && info.dueDate < new Date()) {
    errors.push('Due date cannot be in the past');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Format parsing result for user confirmation
 */
export function formatParsedTaskForDisplay(info: ParsedTaskInfo): string {
  const lines: string[] = [];
  
  lines.push(`📋 ${t('Task:')} ${info.title}`);
  
  if (info.dueDate) {
    lines.push(`📅 ${t('Time:')} ${info.dueDate.toLocaleString(getLocale(), {
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })}`);
  }
  
  if (info.priority) {
    const priorityText: { [key: string]: string } = {
      'urgent': `🔴 ${t('Urgent')}`,
      'high': `🟠 ${t('High')}`,
      'medium': `🟡 ${t('Medium')}`,
      'low': `🟢 ${t('Low')}`
    };
    lines.push(`⚡ ${t('Priority:')} ${priorityText[info.priority]}`);
  }
  
  if (info.tags && info.tags.length > 0) {
    lines.push(`🏷️ ${t('Tags:')} ${info.tags.map(tag => `#${tag}`).join(' ')}`);
  }
  
  return lines.join('\n');
}

export default {
  parseTaskFromText,
  validateParsedTask,
  formatParsedTaskForDisplay
};
