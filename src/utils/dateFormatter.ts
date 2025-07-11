/**
 * Locale-aware date formatting utility
 * Provides automatic date formatting based on Android system locale settings
 * Supports DD/MM/YYYY and MM/DD/YYYY formats with proper fallback handling
 */

import { NativeModules, Platform } from 'react-native';

// Type definitions for date formatting options
export interface DateFormatOptions {
  includeTime?: boolean;
  includeYear?: boolean;
  shortFormat?: boolean;
  fallbackLocale?: string;
}

// Supported date format patterns
export enum DateFormatPattern {
  US = 'MM/DD/YYYY',
  EU = 'DD/MM/YYYY',
  ISO = 'YYYY-MM-DD',
}

// Interface for locale information
export interface LocaleInfo {
  locale: string;
  country?: string;
  language?: string;
  dateFormat: DateFormatPattern;
}

/**
 * Gets the current device locale information
 * Falls back to 'en-US' if locale detection fails
 */
export const getDeviceLocale = (): string => {
  try {
    // Primary: Use Android I18nManager locale
    if (Platform.OS === 'android' && NativeModules.I18nManager) {
      const locale = NativeModules.I18nManager.localeIdentifier;
      if (locale) {
        return locale.replace('_', '-'); // Convert en_US to en-US format
      }
    }
    
    // Secondary: Use navigator locale as fallback (for web environments and tests)
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language;
    }
    
    // Final fallback: Always return en-US
    return 'en-US';
  } catch (error) {
    console.warn('Failed to detect device locale:', error);
    return 'en-US';
  }
};

/**
 * Determines the appropriate date format pattern based on locale
 * US locales use MM/DD/YYYY, most others use DD/MM/YYYY
 */
export const getDateFormatPattern = (locale: string = getDeviceLocale()): DateFormatPattern => {
  // List of locales that use MM/DD/YYYY format
  const usFormatLocales = ['en-US', 'en-AS', 'en-GU', 'en-MH', 'en-MP', 'en-PR', 'en-UM', 'en-VI'];
  
  // Check if the locale uses US date format
  const localeUpper = locale.toUpperCase();
  const usesUSFormat = usFormatLocales.some(usLocale => localeUpper.startsWith(usLocale.toUpperCase()));
  
  return usesUSFormat ? DateFormatPattern.US : DateFormatPattern.EU;
};

/**
 * Formats a date according to the device's locale settings
 * @param date - The date to format (Date object, ISO string, or timestamp)
 * @param options - Optional formatting configuration
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string | number,
  options: DateFormatOptions = {}
): string => {
  try {
    // Convert input to Date object
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Validate date
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date provided to formatDate:', date);
      return 'Invalid Date';
    }
    
    const locale = options.fallbackLocale || getDeviceLocale();
    
    // Use Intl.DateTimeFormat for native locale formatting
    try {
      const formatOptions: Intl.DateTimeFormatOptions = {
        year: options.includeYear !== false ? 'numeric' : undefined,
        month: options.shortFormat ? 'short' : '2-digit',
        day: '2-digit',
      };
      
      if (options.includeTime) {
        formatOptions.hour = '2-digit';
        formatOptions.minute = '2-digit';
      }
      
      return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
    } catch (intlError) {
      // Fallback to manual formatting if Intl is not available
      console.warn('Intl.DateTimeFormat not available, using fallback:', intlError);
      return fallbackDateFormat(dateObj, getDateFormatPattern(locale), options);
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Error';
  }
};

/**
 * Manual date formatting fallback for environments without Intl support
 */
const fallbackDateFormat = (
  date: Date,
  pattern: DateFormatPattern,
  options: DateFormatOptions
): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  let formatted: string;
  
  switch (pattern) {
    case DateFormatPattern.US:
      formatted = `${month}/${day}/${year}`;
      break;
    case DateFormatPattern.EU:
      formatted = `${day}/${month}/${year}`;
      break;
    case DateFormatPattern.ISO:
      formatted = `${year}-${month}-${day}`;
      break;
    default:
      formatted = `${month}/${day}/${year}`;
  }
  
  if (options.includeYear === false) {
    // Remove year from formatted string
    formatted = formatted.substring(0, formatted.lastIndexOf('/'));
  }
  
  if (options.includeTime) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    formatted += ` ${hours}:${minutes}`;
  }
  
  return formatted;
};

/**
 * Formats a relative date (e.g., "2 days ago", "Yesterday")
 * Falls back to absolute date for dates older than 7 days
 */
export const formatRelativeDate = (
  date: Date | string | number,
  _locale: string = getDeviceLocale()
): string => {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Today
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
      }
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      // Fall back to absolute date
      return formatDate(dateObj, { includeTime: false });
    }
  } catch (error) {
    console.error('Error formatting relative date:', error);
    return formatDate(date);
  }
};

/**
 * Gets locale information including the preferred date format
 */
export const getLocaleInfo = (): LocaleInfo => {
  const currentLocale = getDeviceLocale();
  const [language, country] = currentLocale.split('-');
  
  return {
    locale: currentLocale,
    language,
    country,
    dateFormat: getDateFormatPattern(currentLocale),
  };
};

/**
 * Checks if the device uses US date format (MM/DD/YYYY)
 */
export const usesUSDateFormat = (): boolean => {
  return getDateFormatPattern() === DateFormatPattern.US;
};

// Export a singleton instance for consistent locale caching
export const dateFormatter = {
  format: formatDate,
  formatRelative: formatRelativeDate,
  getLocale: getDeviceLocale,
  getPattern: getDateFormatPattern,
  getLocaleInfo,
  usesUSFormat: usesUSDateFormat,
};