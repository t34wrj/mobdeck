/**
 * Unit Tests for Simple Logger Service
 */

import { logger } from '../../src/utils/logger';

// Mock console methods to prevent actual logging during tests
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

// Store original console methods
const originalConsole = { ...console };

// Mock __DEV__ before importing logger
(global as any).__DEV__ = true;

describe('Simple Logger', () => {
  beforeEach(() => {
    // Replace console methods with mocks
    Object.assign(console, mockConsole);
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console methods
    Object.assign(console, originalConsole);
  });

  describe('debug logging', () => {
    it('should log debug messages in development mode', () => {
      logger.debug('Debug message', { test: 'data' });

      expect(mockConsole.debug).toHaveBeenCalledWith('[DEBUG] Debug message', {
        test: 'data',
      });
    });

    it('should log debug messages without data', () => {
      logger.debug('Debug message');

      expect(mockConsole.debug).toHaveBeenCalledWith(
        '[DEBUG] Debug message',
        undefined
      );
    });
  });

  describe('info logging', () => {
    it('should log info messages in development mode', () => {
      logger.info('Info message', { test: 'data' });

      expect(mockConsole.info).toHaveBeenCalledWith('[INFO] Info message', {
        test: 'data',
      });
    });

    it('should log info messages without data', () => {
      logger.info('Info message');

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[INFO] Info message',
        undefined
      );
    });
  });

  describe('warn logging', () => {
    it('should log warn messages always (regardless of dev mode)', () => {
      logger.warn('Warning message', { test: 'data' });

      expect(mockConsole.warn).toHaveBeenCalledWith('[WARN] Warning message', {
        test: 'data',
      });
    });

    it('should log warn messages without data', () => {
      logger.warn('Warning message');

      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[WARN] Warning message',
        undefined
      );
    });
  });

  describe('error logging', () => {
    it('should log error messages always (regardless of dev mode)', () => {
      logger.error('Error message', { error: 'details' });

      expect(mockConsole.error).toHaveBeenCalledWith('[ERROR] Error message', {
        error: 'details',
      });
    });

    it('should log error messages without data', () => {
      logger.error('Error message');

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[ERROR] Error message',
        undefined
      );
    });
  });

  describe('data parameter handling', () => {
    it('should handle undefined data parameter', () => {
      logger.info('Message without data');

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[INFO] Message without data',
        undefined
      );
    });

    it('should handle object data parameter', () => {
      const testData = { key: 'value', nested: { prop: 'test' } };
      logger.debug('Message with object', testData);

      expect(mockConsole.debug).toHaveBeenCalledWith(
        '[DEBUG] Message with object',
        testData
      );
    });

    it('should handle string data parameter', () => {
      logger.warn('Message with string', 'string data');

      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[WARN] Message with string',
        'string data'
      );
    });
  });
});
