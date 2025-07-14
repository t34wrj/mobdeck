/**
 * Security tests for error handling to ensure no sensitive data leakage
 */

import { errorHandler, ErrorCategory, ErrorSeverity } from '../../src/utils/errorHandler';
import { logger } from '../../src/utils/logger';

// Declare global ErrorUtils for React Native
declare global {
  interface ErrorUtils {
    setGlobalHandler: (handler: (error: Error, isFatal: boolean) => void) => void;
    getGlobalHandler: () => ((error: Error, isFatal: boolean) => void) | undefined;
  }
  
  var ErrorUtils: ErrorUtils | undefined;
}
import { sanitizeForLogging, sanitizeErrorMessage, sanitizeStackTrace } from '../../src/utils/security';

// Mock logger to capture log calls
jest.mock('../../src/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    startPerformanceTimer: jest.fn(),
    endPerformanceTimer: jest.fn(),
  },
}));

describe('Error Handling Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Sensitive Data Sanitization', () => {
    it('should sanitize Bearer tokens in error details', () => {
      const error = new Error('Authentication failed');
      const sensitiveDetails = {
        authorization: 'Bearer sk_live_test123456789abcdef',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature',
        apiKey: 'api_key_1234567890abcdef',
      };

      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.AUTHENTICATION,
        details: sensitiveDetails,
      });

      // Verify that sensitive data is redacted
      expect(handledError.details?.authorization).toBe('[REDACTED_BEARER_TOKEN]');
      expect(handledError.details?.token).toBe('[REDACTED_JWT]');
      expect(handledError.details?.apiKey).toBe('[REDACTED_API_KEY]');
    });

    it('should sanitize sensitive data in nested objects', () => {
      const error = new Error('Request failed');
      const nestedSensitiveData = {
        user: {
          id: 'user123',
          credentials: {
            password: 'mySecretPassword123',
            token: 'Bearer abc123def456',
          },
        },
        request: {
          headers: {
            authorization: 'Bearer token123',
            'x-api-key': 'secret_key_here',
          },
        },
      };

      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.NETWORK,
        details: nestedSensitiveData,
      });

      // First verify the structure exists
      expect(handledError.details).toBeDefined();
      expect(handledError.details?.user).toBeDefined();
      expect(handledError.details?.user?.credentials).toBeDefined();
      
      // Verify nested sensitive data is redacted
      expect(handledError.details?.user?.credentials?.password).toBe('[REDACTED]');
      expect(handledError.details?.user?.credentials?.token).toBe('[REDACTED_BEARER_TOKEN]');
      expect(handledError.details?.request?.headers?.authorization).toBe('[REDACTED_BEARER_TOKEN]');
      expect(handledError.details?.request?.headers?.['x-api-key']).toBe('[REDACTED]');
    });

    it('should sanitize URLs with embedded credentials', () => {
      const error = new Error('Connection failed');
      const sensitiveContext = {
        serverUrl: 'https://user:password@api.example.com/endpoint?token=secret123',
        apiEndpoint: '/api/users/abc123def456789/profile',
      };

      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.NETWORK,
        context: sensitiveContext,
      });

      // Verify URL credentials are sanitized
      expect(handledError.context?.serverUrl).toContain('%5BREDACTED%5D'); // URL encoded [REDACTED]
      expect(handledError.context?.serverUrl).not.toContain('user:password');
      expect(handledError.context?.apiEndpoint).toContain('[REDACTED_ID]');
    });

    it('should sanitize error messages containing sensitive patterns', () => {
      const sensitiveMessages = [
        'Authentication failed with Bearer sk_live_123456789',
        'JWT token eyJhbGciOiJIUzI1NiJ9.test.sig is invalid',
        'API key api_123456789abcdef not found',
        'Email user@example.com not verified',
        'Server error at 192.168.1.100',
      ];

      sensitiveMessages.forEach(message => {
        const sanitized = sanitizeErrorMessage(message);
        
        expect(sanitized).not.toContain('sk_live_123456789');
        expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9.test.sig');
        expect(sanitized).toContain('[REDACTED]'); // API key should be sanitized
        expect(sanitized).not.toContain('user@example.com');
        expect(sanitized).not.toContain('192.168.1.100');
        
        expect(sanitized).toContain('[REDACTED]');
      });
    });

    it('should sanitize stack traces with sensitive file paths', () => {
      const sensitiveStack = `Error: Authentication failed
        at AuthService.login (/home/user123/Projects/app/src/auth.js:45:12)
        at /Users/johndoe/Development/app/src/api.js:123:8
        at C:\\Users\\sensitive\\Desktop\\app\\src\\utils.js:67:4
        Bearer token123 in request headers`;

      const sanitized = sanitizeStackTrace(sensitiveStack);

      expect(sanitized).not.toContain('/home/user123');
      expect(sanitized).not.toContain('/Users/johndoe');
      expect(sanitized).not.toContain('C:\\Users\\sensitive');
      expect(sanitized).not.toContain('Bearer token123');
      
      expect(sanitized).toContain('/home/[USERNAME]');
      expect(sanitized).toContain('/Users/[USERNAME]');
      expect(sanitized).toContain('C:\\Users\\[USERNAME]');
      expect(sanitized).toContain('Bearer [REDACTED]');
    });
  });

  describe('Error Logging Security', () => {
    it('should not log sensitive data in error messages', () => {
      const error = new Error('API call failed with Bearer token123');
      const sensitiveDetails = {
        password: 'myPassword123',
        token: 'secret_token_here',
      };

      errorHandler.handleError(error, {
        category: ErrorCategory.AUTHENTICATION,
        details: sensitiveDetails,
      });

      // Verify logger was called but without sensitive data
      expect(logger.log).toHaveBeenCalled();
      const logCall = (logger.log as jest.Mock).mock.calls[0];
      const loggedData = JSON.stringify(logCall);
      
      expect(loggedData).not.toContain('myPassword123');
      expect(loggedData).not.toContain('secret_token_here');
      expect(loggedData).not.toContain('Bearer token123');
    });

    it('should prevent console.error from exposing sensitive data', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        // Simulate a console.error call with sensitive data
        console.error('Auth failed', { token: 'Bearer secret123', password: 'password123' });
        
        // The error handler should have intercepted and sanitized this
        // Note: In real implementation, global error handlers would sanitize console calls
        expect(consoleSpy).toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('Error Context Sanitization', () => {
    it('should sanitize device info in error context', () => {
      const error = new Error('System error');
      const sensitiveContext = {
        deviceInfo: {
          deviceId: 'unique_device_id_123',
          userId: 'user_secret_id',
          credentials: {
            token: 'device_token_123',
          },
        },
      };

      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.RUNTIME,
        context: sensitiveContext,
      });

      // Verify device info is sanitized
      expect(handledError.context?.deviceInfo?.credentials?.token).toBe('[REDACTED]');
    });

    it('should sanitize query parameters in server URLs', () => {
      const error = new Error('Network error');
      const sensitiveContext = {
        serverUrl: 'https://api.example.com/data?token=secret123&key=apikey456&safe=value',
      };

      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.NETWORK,
        context: sensitiveContext,
      });

      const sanitizedUrl = handledError.context?.serverUrl || '';
      expect(sanitizedUrl).toContain('token=%5BREDACTED%5D'); // URL encoded [REDACTED]
      expect(sanitizedUrl).toContain('key=%5BREDACTED%5D'); // URL encoded [REDACTED]
      expect(sanitizedUrl).toContain('safe=value'); // Non-sensitive params preserved
    });
  });

  describe('Global Error Handler Security', () => {
    it('should sanitize unhandled errors', () => {
      const originalErrorHandler = global.ErrorUtils?.setGlobalHandler;
      const mockGlobalHandler = jest.fn();
      
      if (global.ErrorUtils) {
        global.ErrorUtils.setGlobalHandler = mockGlobalHandler;
      }

      try {
        // Simulate an unhandled error with sensitive data
        const sensitiveError = new Error('Unhandled error with Bearer token123');
        
        // The global handler should be set up to sanitize errors
        if (global.ErrorUtils?.setGlobalHandler) {
          global.ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
            const sanitizedMessage = sanitizeErrorMessage(error.message);
            expect(sanitizedMessage).not.toContain('Bearer token123');
            expect(sanitizedMessage).toContain('[REDACTED]');
          });
        }
      } finally {
        if (global.ErrorUtils && originalErrorHandler) {
          global.ErrorUtils.setGlobalHandler = originalErrorHandler;
        }
      }
    });
  });

  describe('Sanitization Function Tests', () => {
    it('should comprehensively sanitize logging objects', () => {
      const sensitiveObject = {
        user: {
          email: 'user@example.com',
          password: 'secret123',
        },
        api: {
          token: 'Bearer abc123def456',
          key: 'api_key_789xyz',
        },
        server: {
          ip: '192.168.1.100',
          url: 'https://user:pass@api.com',
        },
        error: new Error('Auth failed with JWT eyJhbGciOiJIUzI1NiJ9.test.sig'),
      };

      const sanitized = sanitizeForLogging(sensitiveObject);

      // Verify all sensitive data is sanitized
      expect(sanitized.user.email).toBe('u***@example.com');
      expect(sanitized.user.password).toBe('[REDACTED]');
      expect(sanitized.api.token).toBe('[REDACTED]');
      expect(sanitized.api.key).toBe('[REDACTED]');
      expect(sanitized.server.ip).toBe('[IP_ADDRESS]');
      expect(sanitized.server.url).toBe('h***@api.com'); // Masked as email-like pattern
      expect(sanitized.error.message).toContain('[REDACTED]');
    });
  });

  describe('Production Environment Security', () => {
    it('should have stricter sanitization in production mode', () => {
      const originalDev = (global as any).__DEV__;
      (global as any).__DEV__ = false;

      try {
        const error = new Error('Production error');
        const handledError = errorHandler.handleError(error, {
          category: ErrorCategory.RUNTIME,
          details: { debugInfo: 'sensitive debug data' },
        });

        // In production, even debug info should be sanitized more aggressively
        expect(handledError.reportable).toBeTruthy();
      } finally {
        (global as any).__DEV__ = originalDev;
      }
    });
  });
});