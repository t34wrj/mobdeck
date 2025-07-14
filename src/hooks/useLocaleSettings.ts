/**
 * React hook for accessing and monitoring Android system locale settings
 * Provides real-time locale updates and caching for performance optimization
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  AppState,
  AppStateStatus,
  DeviceEventEmitter,
  Platform,
} from 'react-native';
import {
  getDeviceLocale,
  getDateFormatPattern,
  DateFormatPattern,
  LocaleInfo,
  getLocaleInfo,
} from '../utils/dateFormatter';

// Hook return type
export interface UseLocaleSettingsReturn {
  locale: string;
  dateFormat: DateFormatPattern;
  localeInfo: LocaleInfo;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Locale cache interface
interface LocaleCache {
  locale: string;
  dateFormat: DateFormatPattern;
  localeInfo: LocaleInfo;
  timestamp: number;
}

// Module-level cache
let localeCache: LocaleCache | null = null;

/**
 * Custom hook for accessing Android system locale settings
 * Automatically detects locale changes and provides cached values for performance
 */
export const useLocaleSettings = (): UseLocaleSettingsReturn => {
  // Initialize state with cached values or defaults
  const [locale, setLocale] = useState<string>(() => {
    if (localeCache && Date.now() - localeCache.timestamp < CACHE_DURATION) {
      return localeCache.locale;
    }
    return getDeviceLocale();
  });

  const [dateFormat, setDateFormat] = useState<DateFormatPattern>(() => {
    if (localeCache && Date.now() - localeCache.timestamp < CACHE_DURATION) {
      return localeCache.dateFormat;
    }
    return getDateFormatPattern();
  });

  const [localeInfo, setLocaleInfo] = useState<LocaleInfo>(() => {
    if (localeCache && Date.now() - localeCache.timestamp < CACHE_DURATION) {
      return localeCache.localeInfo;
    }
    return getLocaleInfo();
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track component mount status
  const isMountedRef = useRef(true);

  /**
   * Updates locale information and cache
   */
  const updateLocaleInfo = useCallback(() => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const newLocale = getDeviceLocale();
      const newDateFormat = getDateFormatPattern(newLocale);
      const newLocaleInfo = getLocaleInfo();

      // Update state
      setLocale(newLocale);
      setDateFormat(newDateFormat);
      setLocaleInfo(newLocaleInfo);

      // Update cache
      localeCache = {
        locale: newLocale,
        dateFormat: newDateFormat,
        localeInfo: newLocaleInfo,
        timestamp: Date.now(),
      };

      setIsLoading(false);
    } catch (err) {
      if (isMountedRef.current) {
        setError(
          err instanceof Error ? err.message : 'Failed to detect locale'
        );
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    updateLocaleInfo();
  }, [updateLocaleInfo]);

  /**
   * Handle app state changes (detects when app returns from settings)
   */
  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Check if locale might have changed while app was in background
        const currentLocale = getDeviceLocale();
        if (currentLocale !== locale) {
          updateLocaleInfo();
        }
      }
    },
    [locale, updateLocaleInfo]
  );

  useEffect(() => {
    // Initial load if cache is expired
    if (!localeCache || Date.now() - localeCache.timestamp >= CACHE_DURATION) {
      updateLocaleInfo();
    }

    // Listen for app state changes
    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    // Android-specific locale change listener
    let localeChangeListener: any;
    if (Platform.OS === 'android') {
      try {
        // Some Android devices emit locale change events
        localeChangeListener = DeviceEventEmitter.addListener(
          'localeChanged',
          updateLocaleInfo
        );
      } catch (err) {
        console.warn('Failed to setup locale change listener:', err);
      }
    }

    return () => {
      isMountedRef.current = false;
      appStateSubscription.remove();
      if (localeChangeListener) {
        localeChangeListener.remove();
      }
    };
  }, [handleAppStateChange, updateLocaleInfo]);

  return {
    locale,
    dateFormat,
    localeInfo,
    isLoading,
    error,
    refresh,
  };
};

/**
 * Hook for formatting dates with current locale settings
 * Provides memoized formatter functions that automatically use device locale
 */
export const useLocaleDateFormatter = () => {
  const { locale, dateFormat } = useLocaleSettings();

  const formatDate = useCallback(
    (
      date: Date | string | number,
      options?: {
        includeTime?: boolean;
        includeYear?: boolean;
        shortFormat?: boolean;
      }
    ) => {
      const { formatDate: formatter } = require('../utils/dateFormatter');
      return formatter(date, { ...options, fallbackLocale: locale });
    },
    [locale]
  );

  const formatRelativeDate = useCallback(
    (date: Date | string | number) => {
      const {
        formatRelativeDate: formatter,
      } = require('../utils/dateFormatter');
      return formatter(date, locale);
    },
    [locale]
  );

  return {
    formatDate,
    formatRelativeDate,
    dateFormat,
    locale,
  };
};

/**
 * Clears the locale cache (useful for testing)
 */
export const clearLocaleCache = () => {
  localeCache = null;
};
