/**
 * Unit Tests for ErrorHandler Service
 */

import {
  ErrorType,
  AppError as _AppError,
  getErrorMessage,
  classifyError,
  createAppError,
  handleError,
} from '../../src/utils/errorHandler';

describe('ErrorHandler', () => {
  describe('getErrorMessage', () => {
    it('should extract message from string errors', () => {
      const result = getErrorMessage('String error message');
      expect(result).toBe('String error message');
    });

    it('should extract message from Error objects', () => {
      const error = new Error('Test error message');
      const result = getErrorMessage(error);
      expect(result).toBe('Test error message');
    });

    it('should extract message from objects with message property', () => {
      const error = { message: 'Object error message' };
      const result = getErrorMessage(error);
      expect(result).toBe('Object error message');
    });

    it('should handle null and undefined errors', () => {
      expect(getErrorMessage(null)).toBe('Unknown error occurred');
      expect(getErrorMessage(undefined)).toBe('Unknown error occurred');
    });

    it('should handle objects without message property', () => {
      const error = { code: 500 };
      const result = getErrorMessage(error);
      expect(result).toBe('Unknown error occurred');
    });
  });

  describe('classifyError', () => {
    it('should classify network errors', () => {
      expect(classifyError('Network connection failed')).toBe(
        ErrorType.NETWORK
      );
      expect(classifyError('Fetch request failed')).toBe(ErrorType.NETWORK);
      expect(classifyError(new Error('network timeout'))).toBe(
        ErrorType.NETWORK
      );
    });

    it('should classify authentication errors', () => {
      expect(classifyError('Unauthorized access')).toBe(ErrorType.AUTH);
      expect(classifyError('Authentication failed')).toBe(ErrorType.AUTH);
      expect(classifyError(new Error('auth token expired'))).toBe(
        ErrorType.AUTH
      );
    });

    it('should classify validation errors', () => {
      expect(classifyError('Validation failed')).toBe(ErrorType.VALIDATION);
      expect(classifyError('Invalid input data')).toBe(ErrorType.VALIDATION);
      expect(classifyError(new Error('invalid email format'))).toBe(
        ErrorType.VALIDATION
      );
    });

    it('should classify storage errors', () => {
      expect(classifyError('Storage operation failed')).toBe(ErrorType.STORAGE);
      expect(classifyError('Database connection error')).toBe(
        ErrorType.STORAGE
      );
      expect(classifyError(new Error('storage quota exceeded'))).toBe(
        ErrorType.STORAGE
      );
    });

    it('should classify sync errors', () => {
      expect(classifyError('Sync operation failed')).toBe(ErrorType.SYNC);
      expect(classifyError(new Error('sync timeout'))).toBe(ErrorType.SYNC);
    });

    it('should classify unknown errors', () => {
      expect(classifyError('Random error message')).toBe(ErrorType.UNKNOWN);
      expect(classifyError(new Error('unexpected error'))).toBe(
        ErrorType.UNKNOWN
      );
      expect(classifyError(null)).toBe(ErrorType.UNKNOWN);
    });
  });

  describe('createAppError', () => {
    it('should create AppError from Error object', () => {
      const error = new Error('Network connection failed');
      const result = createAppError(error);

      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.message).toBe('Network connection failed');
      expect(result.userMessage).toBe(
        'Network connection failed. Please check your internet connection and try again.'
      );
      expect(result.retryable).toBe(true);
    });

    it('should create AppError from string', () => {
      const result = createAppError('Authentication failed');

      expect(result.type).toBe(ErrorType.AUTH);
      expect(result.message).toBe('Authentication failed');
      expect(result.userMessage).toBe(
        'Authentication failed. Please check your credentials and try again.'
      );
      expect(result.retryable).toBe(false);
    });

    it('should handle validation errors as non-retryable', () => {
      const result = createAppError('Validation error');

      expect(result.type).toBe(ErrorType.VALIDATION);
      expect(result.retryable).toBe(false);
    });

    it('should handle sync errors as retryable', () => {
      const result = createAppError('Sync failed');

      expect(result.type).toBe(ErrorType.SYNC);
      expect(result.retryable).toBe(true);
    });
  });

  describe('handleError', () => {
    const originalDev = global.__DEV__;
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    beforeEach(() => {
      consoleSpy.mockClear();
    });

    afterAll(() => {
      global.__DEV__ = originalDev;
      consoleSpy.mockRestore();
    });

    it('should handle and return AppError', () => {
      const error = new Error('Test error');
      const result = handleError(error);

      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.message).toBe('Test error');
      expect(result.userMessage).toBe(
        'Something went wrong. Please try again.'
      );
      expect(result.retryable).toBe(false);
    });

    it('should log error in development mode', () => {
      global.__DEV__ = true;
      const error = new Error('Dev error');
      const result = handleError(error);

      expect(consoleSpy).toHaveBeenCalledWith('App Error:', result);
    });

    it('should not log error in production mode', () => {
      global.__DEV__ = false;
      const error = new Error('Prod error');
      handleError(error);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('retryable errors', () => {
    it('should mark network errors as retryable', () => {
      const result = createAppError('Network error');
      expect(result.retryable).toBe(true);
    });

    it('should mark sync errors as retryable', () => {
      const result = createAppError('Sync failed');
      expect(result.retryable).toBe(true);
    });

    it('should mark authentication errors as non-retryable', () => {
      const result = createAppError('Authentication failed');
      expect(result.retryable).toBe(false);
    });

    it('should mark validation errors as non-retryable', () => {
      const result = createAppError('Validation error');
      expect(result.retryable).toBe(false);
    });

    it('should mark storage errors as non-retryable', () => {
      const result = createAppError('Storage failed');
      expect(result.retryable).toBe(false);
    });

    it('should mark unknown errors as non-retryable', () => {
      const result = createAppError('Random error');
      expect(result.retryable).toBe(false);
    });
  });

  describe('user messages', () => {
    it('should provide appropriate user message for network errors', () => {
      const result = createAppError('Network timeout');
      expect(result.userMessage).toBe(
        'Network connection failed. Please check your internet connection and try again.'
      );
    });

    it('should provide appropriate user message for auth errors', () => {
      const result = createAppError('Unauthorized');
      expect(result.userMessage).toBe(
        'Authentication failed. Please check your credentials and try again.'
      );
    });

    it('should provide appropriate user message for validation errors', () => {
      const result = createAppError('Invalid input');
      expect(result.userMessage).toBe(
        'Invalid input. Please check your data and try again.'
      );
    });

    it('should provide appropriate user message for storage errors', () => {
      const result = createAppError('Storage error');
      expect(result.userMessage).toBe('Storage error. Please try again.');
    });

    it('should provide appropriate user message for sync errors', () => {
      const result = createAppError('Sync error');
      expect(result.userMessage).toBe('Sync failed. Please try again later.');
    });

    it('should provide generic user message for unknown errors', () => {
      const result = createAppError('Unknown error');
      expect(result.userMessage).toBe(
        'Something went wrong. Please try again.'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle null errors', () => {
      const result = handleError(null);
      expect(result.message).toBe('Unknown error occurred');
      expect(result.type).toBe(ErrorType.UNKNOWN);
    });

    it('should handle undefined errors', () => {
      const result = handleError(undefined);
      expect(result.message).toBe('Unknown error occurred');
      expect(result.type).toBe(ErrorType.UNKNOWN);
    });

    it('should handle empty string errors', () => {
      const result = handleError('');
      expect(result.message).toBe('');
      expect(result.type).toBe(ErrorType.UNKNOWN);
    });

    it('should handle objects without message', () => {
      const error = { code: 500, status: 'error' };
      const result = handleError(error);
      expect(result.message).toBe('Unknown error occurred');
    });

    it('should handle complex error objects', () => {
      const error = {
        message: 'Complex network error',
        code: 'NETWORK_TIMEOUT',
        details: { timeout: 5000 },
      };
      const result = handleError(error);
      expect(result.message).toBe('Complex network error');
      expect(result.type).toBe(ErrorType.NETWORK);
    });
  });
});
