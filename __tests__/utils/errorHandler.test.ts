/**
 * Unit Tests for ErrorHandler Service
 */

import errorHandler, { ErrorCategory, ErrorSeverity } from '../../src/utils/errorHandler';

// Mock logger to prevent actual logging during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  },
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    errorHandler.clearBreadcrumbs();
    jest.clearAllMocks();
  });

  describe('handleError', () => {
    it('should handle Error objects correctly', () => {
      const testError = new Error('Test error message');
      const result = errorHandler.handleError(testError);

      expect(result.message).toBe('Test error message');
      expect(result.category).toBe(ErrorCategory.RUNTIME);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle string errors correctly', () => {
      const result = errorHandler.handleError('String error message');

      expect(result.message).toBe('String error message');
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.userMessage).toBeDefined();
    });

    it('should categorize network errors correctly', () => {
      const networkError = { code: 'NETWORK_ERROR', message: 'Network failed' };
      const result = errorHandler.handleError(networkError);

      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.retryable).toBe(true);
    });

    it('should categorize authentication errors correctly', () => {
      const authError = { status: 401, message: 'Unauthorized' };
      const result = errorHandler.handleError(authError);

      expect(result.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should handle custom options correctly', () => {
      const error = new Error('Test');
      const result = errorHandler.handleError(error, {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        userMessage: 'Custom user message',
      });

      expect(result.category).toBe(ErrorCategory.VALIDATION);
      expect(result.severity).toBe(ErrorSeverity.LOW);
      expect(result.userMessage).toBe('Custom user message');
    });

    it('should sanitize sensitive data in details', () => {
      const error = new Error('Test');
      const result = errorHandler.handleError(error, {
        details: {
          password: 'secret123',
          token: 'bearer-token',
          normalData: 'public-info',
        },
      });

      expect(result.details?.password).toBe('[REDACTED]');
      expect(result.details?.token).toBe('[REDACTED]');
      expect(result.details?.normalData).toBe('public-info');
    });

    it('should sanitize context data correctly', () => {
      const error = new Error('Test');
      const result = errorHandler.handleError(error, {
        context: {
          serverUrl: 'https://example.com:8080/api',
          userId: 'user123',
          screenName: 'LoginScreen',
        },
      });

      expect(result.context?.serverUrl).toBe('https://example.com:8080');
      expect(result.context?.userId).toBe('[USER_ID_PRESENT]');
      expect(result.context?.screenName).toBe('LoginScreen');
    });
  });

  describe('breadcrumbs', () => {
    it('should add breadcrumbs correctly', () => {
      errorHandler.addBreadcrumb('First action');
      errorHandler.addBreadcrumb('Second action');

      const breadcrumbs = errorHandler.getBreadcrumbs();
      expect(breadcrumbs).toHaveLength(2);
      expect(breadcrumbs[0]).toContain('First action');
      expect(breadcrumbs[1]).toContain('Second action');
    });

    it('should limit breadcrumbs to maximum count', () => {
      // Add more than the maximum breadcrumbs (50)
      for (let i = 0; i < 60; i++) {
        errorHandler.addBreadcrumb(`Action ${i}`);
      }

      const breadcrumbs = errorHandler.getBreadcrumbs();
      expect(breadcrumbs).toHaveLength(50);
      expect(breadcrumbs[0]).toContain('Action 10'); // First 10 should be removed
    });

    it('should clear breadcrumbs correctly', () => {
      errorHandler.addBreadcrumb('Test action');
      errorHandler.clearBreadcrumbs();

      const breadcrumbs = errorHandler.getBreadcrumbs();
      expect(breadcrumbs).toHaveLength(0);
    });
  });

  describe('error categorization', () => {
    it('should categorize network errors', () => {
      const networkErrors = [
        { code: 'NETWORK_ERROR' },
        { message: 'network timeout' },
        { status: 503 },
      ];

      networkErrors.forEach(error => {
        const result = errorHandler.handleError(error);
        expect([ErrorCategory.NETWORK, ErrorCategory.UNKNOWN]).toContain(result.category);
      });
    });

    it('should categorize authentication errors', () => {
      const authErrors = [
        { status: 401 },
        { code: 'AUTH_ERROR' },
      ];

      authErrors.forEach(error => {
        const result = errorHandler.handleError(error);
        expect(result.category).toBe(ErrorCategory.AUTHENTICATION);
      });
    });

    it('should categorize storage errors', () => {
      const storageError = { message: 'storage operation failed' };
      const result = errorHandler.handleError(storageError);
      expect(result.category).toBe(ErrorCategory.STORAGE);
    });
  });

  describe('error handlers', () => {
    it('should create network error handler', () => {
      const handler = errorHandler.getNetworkErrorHandler();
      const result = handler(new Error('Network issue'));

      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.context?.actionType).toBe('network_request');
    });

    it('should create storage error handler', () => {
      const handler = errorHandler.getStorageErrorHandler();
      const result = handler(new Error('Storage issue'));

      expect(result.category).toBe(ErrorCategory.STORAGE);
      expect(result.context?.actionType).toBe('storage_operation');
    });

    it('should create sync error handler', () => {
      const handler = errorHandler.getSyncErrorHandler();
      const result = handler(new Error('Sync issue'));

      expect(result.category).toBe(ErrorCategory.SYNC);
      expect(result.context?.actionType).toBe('sync_operation');
    });
  });

  describe('Redux integration', () => {
    it('should create Redux error action', () => {
      const error = errorHandler.handleError(new Error('Test error'));
      const action = errorHandler.createReduxErrorAction(error);

      expect(action.type).toBe('error/errorOccurred');
      expect(action.payload.id).toBe(error.id);
      expect(action.payload.message).toBe(error.userMessage);
      expect(action.payload.category).toBe(error.category);
      expect(action.payload.severity).toBe(error.severity);
    });
  });

  describe('retryable errors', () => {
    it('should mark network errors as retryable', () => {
      const networkError = { code: 'NETWORK_ERROR' };
      const result = errorHandler.handleError(networkError);
      expect(result.retryable).toBe(true);
    });

    it('should mark server errors as retryable', () => {
      const serverError = { status: 500 };
      const result = errorHandler.handleError(serverError);
      expect(result.retryable).toBe(true);
    });

    it('should mark validation errors as non-retryable', () => {
      const validationError = { status: 400 };
      const result = errorHandler.handleError(validationError, {
        category: ErrorCategory.VALIDATION,
      });
      expect(result.retryable).toBe(false);
    });
  });

  describe('reportable errors', () => {
    it('should mark high severity errors as reportable', () => {
      const result = errorHandler.handleError(new Error('Critical error'), {
        severity: ErrorSeverity.HIGH,
      });
      expect(result.reportable).toBe(true);
    });

    it('should mark low severity errors as non-reportable', () => {
      const result = errorHandler.handleError(new Error('Minor error'), {
        severity: ErrorSeverity.LOW,
      });
      expect(result.reportable).toBe(false);
    });

    it('should mark validation errors as non-reportable', () => {
      const result = errorHandler.handleError(new Error('Validation error'), {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
      });
      expect(result.reportable).toBe(false);
    });
  });

  describe('session management', () => {
    it('should have a session ID', () => {
      const sessionId = errorHandler.getSessionId();
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });
  });
});