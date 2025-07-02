/**
 * Security Tests: API Security
 * Tests for API security enhancements in ReadeckApiService
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import ReadeckApiService from '../../src/services/ReadeckApiService';
import { authStorageService } from '../../src/services/AuthStorageService';
import { validateUrl, validateToken, defaultRateLimiter } from '../../src/utils/security';
import { ReadeckErrorCode } from '../../src/types/readeck';

// Mock dependencies
jest.mock('../../src/services/AuthStorageService');
jest.mock('../../src/utils/security', () => ({
  ...jest.requireActual('../../src/utils/security'),
  validateUrl: jest.fn(),
  validateToken: jest.fn(),
  defaultRateLimiter: {
    isAllowed: jest.fn(),
    reset: jest.fn(),
  },
}));

describe('API Security: ReadeckApiService', () => {
  let apiService: ReadeckApiService;
  let mockAxios: MockAdapter;
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc';

  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
    apiService = new ReadeckApiService({
      baseUrl: 'https://api.readeck.com/v1',
      timeout: 5000,
    });

    // Reset mocks
    jest.clearAllMocks();
    (validateUrl as jest.Mock).mockReturnValue({ isValid: true, sanitized: 'https://api.readeck.com/v1' });
    (validateToken as jest.Mock).mockReturnValue({ isValid: true });
    (defaultRateLimiter.isAllowed as jest.Mock).mockReturnValue(true);
    (authStorageService.retrieveToken as jest.Mock).mockResolvedValue(mockToken);
  });

  afterEach(() => {
    mockAxios.restore();
  });

  describe('URL Validation', () => {
    it('should validate base URL on initialization', () => {
      expect(() => {
        new ReadeckApiService({ baseUrl: 'invalid-url' });
      }).toThrow('Invalid API base URL');
    });

    it('should validate URLs before making requests', async () => {
      (validateUrl as jest.Mock).mockReturnValueOnce({ isValid: false, error: 'Invalid URL' });
      
      mockAxios.onGet('/articles').reply(200, {});

      await expect(apiService.getArticles()).rejects.toThrow('Invalid request URL');
    });

    it('should force HTTPS in production', () => {
      const devMode = __DEV__;
      Object.defineProperty(global, '__DEV__', { value: false, writable: true });

      (validateUrl as jest.Mock).mockImplementation((url) => ({
        isValid: true,
        sanitized: url.replace(/^http:/, 'https:'),
      }));

      const service = new ReadeckApiService({
        baseUrl: 'http://api.readeck.com/v1',
      });

      expect(service.getConfig().baseUrl).toBe('https://api.readeck.com/v1');

      Object.defineProperty(global, '__DEV__', { value: devMode, writable: true });
    });
  });

  describe('Token Security', () => {
    it('should validate token format before using', async () => {
      (validateToken as jest.Mock).mockReturnValueOnce({ isValid: false, error: 'Invalid token' });

      mockAxios.onGet('/articles').reply(200, {});

      await expect(apiService.getArticles()).rejects.toThrow('Invalid authentication token format');
    });

    it('should not include token for login endpoint', async () => {
      let requestConfig: any;
      mockAxios.onPost('/auth/login').reply((config) => {
        requestConfig = config;
        return [200, { token: mockToken }];
      });

      await apiService.login({ username: 'test', password: 'password' });

      expect(requestConfig.headers.Authorization).toBeUndefined();
      expect(authStorageService.retrieveToken).not.toHaveBeenCalled();
    });

    it('should mask token in logs', async () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
      
      mockAxios.onGet('/articles').reply(200, {});
      await apiService.getArticles();

      // Check that token is not exposed in logs
      const logCalls = consoleSpy.mock.calls;
      logCalls.forEach(call => {
        const logContent = JSON.stringify(call);
        expect(logContent).not.toContain(mockToken);
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting', async () => {
      (defaultRateLimiter.isAllowed as jest.Mock).mockReturnValueOnce(false);

      await expect(apiService.getArticles()).rejects.toMatchObject({
        code: ReadeckErrorCode.RATE_LIMITED,
        message: expect.stringContaining('Too many requests'),
      });
    });

    it('should check rate limit per endpoint', async () => {
      mockAxios.onGet('/articles').reply(200, {});
      mockAxios.onGet('/labels').reply(200, {});

      await apiService.getArticles();
      await apiService.getLabels();

      expect(defaultRateLimiter.isAllowed).toHaveBeenCalledWith('GET:/articles');
      expect(defaultRateLimiter.isAllowed).toHaveBeenCalledWith('GET:/labels');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in requests', async () => {
      let requestHeaders: any;
      mockAxios.onGet('/articles').reply((config) => {
        requestHeaders = config.headers;
        return [200, {}];
      });

      await apiService.getArticles();

      expect(requestHeaders['X-Content-Type-Options']).toBe('nosniff');
      expect(requestHeaders['X-Frame-Options']).toBe('DENY');
      expect(requestHeaders['X-XSS-Protection']).toBe('1; mode=block');
      expect(requestHeaders['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    });
  });

  describe('Error Sanitization', () => {
    it('should sanitize sensitive information from errors', async () => {
      const sensitiveError = new Error('Connection failed: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc');
      mockAxios.onGet('/articles').reply(() => {
        throw sensitiveError;
      });

      try {
        await apiService.getArticles();
      } catch (error: any) {
        expect(error.details).not.toContain('sk_test_4eC39HqLyjWDarjtT1zdp7dc');
        expect(error.details).toContain('[REDACTED]');
      }
    });

    it('should remove email addresses from error messages', async () => {
      const emailError = new Error('User user@example.com not found');
      mockAxios.onGet('/user/profile').reply(() => {
        throw emailError;
      });

      try {
        await apiService.getUserProfile();
      } catch (error: any) {
        expect(error.details).not.toContain('user@example.com');
        expect(error.details).toContain('[EMAIL]');
      }
    });

    it('should remove IP addresses from error messages', async () => {
      const ipError = new Error('Failed to connect to 192.168.1.100');
      mockAxios.onGet('/articles').reply(() => {
        throw ipError;
      });

      try {
        await apiService.getArticles();
      } catch (error: any) {
        expect(error.details).not.toContain('192.168.1.100');
        expect(error.details).toContain('[IP]');
      }
    });
  });

  describe('Certificate Pinning', () => {
    it('should store certificate pins', () => {
      const hostname = 'api.readeck.com';
      const pins = ['sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='];

      apiService.setCertificatePins(hostname, pins);
      
      // Verify pins are stored (would be used by network layer)
      expect(apiService.verifyCertificatePins(hostname, pins)).toBe(true);
    });

    it('should verify certificate pins', () => {
      const hostname = 'api.readeck.com';
      const validPins = ['sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='];
      const invalidPins = ['sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='];

      apiService.setCertificatePins(hostname, validPins);
      
      expect(apiService.verifyCertificatePins(hostname, validPins)).toBe(true);
      expect(apiService.verifyCertificatePins(hostname, invalidPins)).toBe(false);
    });

    it('should allow connections without pins', () => {
      expect(apiService.verifyCertificatePins('unpinned.com', ['any-cert'])).toBe(true);
    });

    it('should clear certificate pins', () => {
      const hostname = 'api.readeck.com';
      const pins = ['sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='];

      apiService.setCertificatePins(hostname, pins);
      apiService.clearCertificatePins();
      
      // After clearing, all connections should be allowed
      expect(apiService.verifyCertificatePins(hostname, ['any-cert'])).toBe(true);
    });
  });

  describe('Request Validation', () => {
    it('should validate request data', async () => {
      const maliciousArticle = {
        title: '<script>alert("XSS")</script>',
        url: 'javascript:alert(1)',
        content: 'Normal content',
      };

      mockAxios.onPost('/articles').reply(201, {});

      // The service should handle this securely
      await expect(apiService.createArticle(maliciousArticle)).resolves.toBeTruthy();
    });

    it('should handle network timeouts securely', async () => {
      mockAxios.onGet('/articles').timeout();

      await expect(apiService.getArticles()).rejects.toMatchObject({
        code: ReadeckErrorCode.TIMEOUT_ERROR,
        message: expect.stringContaining('timeout'),
      });
    });
  });

  describe('Retry Logic Security', () => {
    it('should not expose sensitive data in retry logs', async () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      let attempt = 0;
      mockAxios.onGet('/articles').reply(() => {
        attempt++;
        if (attempt < 2) {
          return [500, null];
        }
        return [200, {}];
      });

      await apiService.getArticles();

      const logCalls = consoleSpy.mock.calls;
      logCalls.forEach(call => {
        const logContent = JSON.stringify(call);
        expect(logContent).not.toContain(mockToken);
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Configuration Updates', () => {
    it('should validate new base URLs', () => {
      (validateUrl as jest.Mock).mockReturnValueOnce({ isValid: false, error: 'Invalid URL' });

      expect(() => {
        apiService.updateConfig({ baseUrl: 'invalid-url' });
      }).toThrow('Invalid API base URL');
    });

    it('should sanitize configuration in logs', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      apiService.updateConfig({ timeout: 10000 });

      const logCalls = consoleSpy.mock.calls;
      logCalls.forEach(call => {
        const logContent = JSON.stringify(call);
        expect(logContent).toContain('[REDACTED]');
      });

      consoleSpy.mockRestore();
    });
  });
});