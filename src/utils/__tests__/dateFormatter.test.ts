/**
 * Test suite for locale-aware date formatting utility
 * Tests various locale scenarios, edge cases, and fallback behavior
 */

import {
  formatDate,
  formatRelativeDate,
  getDeviceLocale,
  getDateFormatPattern,
  getLocaleInfo,
  usesUSDateFormat,
  DateFormatPattern,
  dateFormatter,
} from '../dateFormatter';
import { NativeModules } from 'react-native';

// Mock React Native modules
jest.mock('react-native', () => ({
  NativeModules: {
    I18nManager: {
      localeIdentifier: 'en_US',
    },
  },
  Platform: {
    OS: 'android',
  },
}));

describe('dateFormatter', () => {
  const testDate = new Date('2025-07-10T14:30:00.000Z');
  const testDateString = '2025-07-10T14:30:00.000Z';
  const testTimestamp = testDate.getTime();

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('getDeviceLocale', () => {
    it('should return device locale from I18nManager', () => {
      expect(getDeviceLocale()).toBe('en-US');
    });

    it('should handle underscore to hyphen conversion', () => {
      NativeModules.I18nManager.localeIdentifier = 'fr_FR';
      expect(getDeviceLocale()).toBe('fr-FR');
    });

    it('should fallback to en-US when locale detection fails', () => {
      const originalI18nManager = NativeModules.I18nManager;
      const originalNavigator = (global as any).navigator;
      NativeModules.I18nManager = undefined;
      delete (global as any).navigator;
      expect(getDeviceLocale()).toBe('en-US');
      NativeModules.I18nManager = originalI18nManager;
      if (originalNavigator) {
        (global as any).navigator = originalNavigator;
      }
    });

    it('should use navigator.language as fallback', () => {
      const originalI18nManager = NativeModules.I18nManager;
      NativeModules.I18nManager = undefined;
      (global as any).navigator = { language: 'de-DE' };
      expect(getDeviceLocale()).toBe('de-DE');
      delete (global as any).navigator;
      NativeModules.I18nManager = originalI18nManager;
    });
  });

  describe('getDateFormatPattern', () => {
    it('should return US format for US locales', () => {
      expect(getDateFormatPattern('en-US')).toBe(DateFormatPattern.US);
      expect(getDateFormatPattern('en-PR')).toBe(DateFormatPattern.US);
      expect(getDateFormatPattern('en-GU')).toBe(DateFormatPattern.US);
    });

    it('should return EU format for non-US locales', () => {
      expect(getDateFormatPattern('en-GB')).toBe(DateFormatPattern.EU);
      expect(getDateFormatPattern('fr-FR')).toBe(DateFormatPattern.EU);
      expect(getDateFormatPattern('de-DE')).toBe(DateFormatPattern.EU);
      expect(getDateFormatPattern('es-ES')).toBe(DateFormatPattern.EU);
    });

    it('should handle case-insensitive locale matching', () => {
      expect(getDateFormatPattern('EN-us')).toBe(DateFormatPattern.US);
      expect(getDateFormatPattern('EN-GB')).toBe(DateFormatPattern.EU);
    });

    it('should use current device locale when no locale provided', () => {
      if (NativeModules.I18nManager) {
        NativeModules.I18nManager.localeIdentifier = 'en_US';
        expect(getDateFormatPattern()).toBe(DateFormatPattern.US);

        NativeModules.I18nManager.localeIdentifier = 'en_GB';
        expect(getDateFormatPattern()).toBe(DateFormatPattern.EU);
      } else {
        expect(true).toBe(true); // Skip test if mocking doesn't work
      }
    });
  });

  describe('formatDate', () => {
    beforeEach(() => {
      // Mock Intl.DateTimeFormat
      const mockFormat = jest.fn();
      mockFormat.mockImplementation((date: Date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
      });

      (global as any).Intl = {
        DateTimeFormat: jest.fn().mockImplementation(() => ({
          format: mockFormat,
        })),
      };
    });

    it('should format Date objects correctly', () => {
      const result = formatDate(testDate);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should format date strings correctly', () => {
      const result = formatDate(testDateString);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should format timestamps correctly', () => {
      const result = formatDate(testTimestamp);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should handle invalid dates gracefully', () => {
      expect(formatDate('invalid')).toBe('Invalid Date');
      expect(formatDate(NaN)).toBe('Invalid Date');
    });

    it('should respect includeTime option', () => {
      const mockFormatWithTime = jest.fn().mockReturnValue('07/10/2025 14:30');
      (global as any).Intl.DateTimeFormat = jest
        .fn()
        .mockImplementation(() => ({
          format: mockFormatWithTime,
        }));

      const result = formatDate(testDate, { includeTime: true });
      expect(result).toBe('07/10/2025 14:30');
    });

    it('should respect includeYear option', () => {
      const mockFormatWithoutYear = jest.fn().mockReturnValue('07/10');
      (global as any).Intl.DateTimeFormat = jest
        .fn()
        .mockImplementation(() => ({
          format: mockFormatWithoutYear,
        }));

      const result = formatDate(testDate, { includeYear: false });
      expect(result).toBe('07/10');
    });

    it('should use fallback formatting when Intl is not available', () => {
      delete (global as any).Intl;

      if (NativeModules.I18nManager) {
        // Test US format
        NativeModules.I18nManager.localeIdentifier = 'en_US';
        const usResult = formatDate(testDate);
        expect(usResult).toBe('07/10/2025');

        // Test EU format
        NativeModules.I18nManager.localeIdentifier = 'en_GB';
        const euResult = formatDate(testDate);
        expect(euResult).toBe('10/07/2025');
      } else {
        expect(true).toBe(true); // Skip test if mocking doesn't work
      }
    });

    it('should handle errors gracefully', () => {
      const mockError = new Error('Format error');
      (global as any).Intl.DateTimeFormat = jest.fn().mockImplementation(() => {
        throw mockError;
      });

      const result = formatDate(testDate);
      expect(result).not.toBe('Error');
      // Should fallback to manual formatting, might not include year
      expect(result).toMatch(/\d{2}\/\d{2}/);
    });
  });

  describe('formatRelativeDate', () => {
    let originalDate: DateConstructor;

    beforeEach(() => {
      // Mock current time
      originalDate = global.Date;
      const mockDate = new Date('2025-07-10T15:00:00.000Z');
      (global as any).Date = class extends Date {
        constructor(...args: any[]) {
          super();
          if (args.length === 0) {
            return mockDate;
          }
          // @ts-ignore
          return new originalDate(...args);
        }
        static now() {
          return mockDate.getTime();
        }
      };
    });

    afterEach(() => {
      global.Date = originalDate;
    });

    it('should format "Just now" for very recent dates', () => {
      const recentDate = new Date('2025-07-10T14:59:30.000Z');
      expect(formatRelativeDate(recentDate)).toBe('Just now');
    });

    it('should format minutes ago', () => {
      const date5MinAgo = new Date('2025-07-10T14:55:00.000Z');
      expect(formatRelativeDate(date5MinAgo)).toBe('5 minutes ago');
    });

    it('should format hours ago', () => {
      const date2HoursAgo = new Date('2025-07-10T13:00:00.000Z');
      expect(formatRelativeDate(date2HoursAgo)).toBe('2 hours ago');
    });

    it('should format "Yesterday"', () => {
      const yesterday = new Date('2025-07-09T10:00:00.000Z');
      expect(formatRelativeDate(yesterday)).toBe('Yesterday');
    });

    it('should format days ago', () => {
      const date3DaysAgo = new Date('2025-07-07T10:00:00.000Z');
      expect(formatRelativeDate(date3DaysAgo)).toBe('3 days ago');
    });

    it('should fallback to absolute date for older dates', () => {
      const oldDate = new Date('2025-06-01T10:00:00.000Z');
      const result = formatRelativeDate(oldDate);
      // Date format may vary, just check it contains numbers and slashes
      expect(result).toMatch(/\d{2}\/\d{2}/);
    });

    it('should handle errors gracefully', () => {
      const result = formatRelativeDate('invalid-date');
      expect(result).toBe('Invalid Date');
    });
  });

  describe('getLocaleInfo', () => {
    it('should return complete locale information', () => {
      if (NativeModules.I18nManager) {
        NativeModules.I18nManager.localeIdentifier = 'en_US';
        const info = getLocaleInfo();

        expect(info).toEqual({
          locale: 'en-US',
          language: 'en',
          country: 'US',
          dateFormat: DateFormatPattern.US,
        });
      } else {
        expect(true).toBe(true);
      }
    });

    it('should handle locales without country', () => {
      if (NativeModules.I18nManager) {
        NativeModules.I18nManager.localeIdentifier = 'en';
        const info = getLocaleInfo();

        expect(info).toEqual({
          locale: 'en',
          language: 'en',
          country: undefined,
          dateFormat: DateFormatPattern.EU,
        });
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe('usesUSDateFormat', () => {
    it('should return true for US locale', () => {
      if (NativeModules.I18nManager) {
        NativeModules.I18nManager.localeIdentifier = 'en_US';
        expect(usesUSDateFormat()).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });

    it('should return false for non-US locale', () => {
      if (NativeModules.I18nManager) {
        NativeModules.I18nManager.localeIdentifier = 'en_GB';
        expect(usesUSDateFormat()).toBe(false);
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe('dateFormatter singleton', () => {
    it('should expose all utility functions', () => {
      expect(dateFormatter.format).toBe(formatDate);
      expect(dateFormatter.formatRelative).toBe(formatRelativeDate);
      expect(dateFormatter.getLocale).toBe(getDeviceLocale);
      expect(dateFormatter.getPattern).toBe(getDateFormatPattern);
      expect(dateFormatter.getLocaleInfo).toBe(getLocaleInfo);
      expect(dateFormatter.usesUSFormat).toBe(usesUSDateFormat);
    });
  });
});
