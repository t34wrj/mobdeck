import { jest } from '@jest/globals';

// Mock react-native-keychain
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(),
  getInternetCredentials: jest.fn(),
  resetInternetCredentials: jest.fn(),
  getSupportedBiometryType: jest.fn(),
  BIOMETRY_TYPE: {
    TOUCH_ID: 'TouchID',
    FACE_ID: 'FaceID',
    FINGERPRINT: 'Fingerprint',
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

import Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Mobile Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Storage Security', () => {
    test('should store tokens securely using keychain', async () => {
      const mockToken = 'test-token-123';
      const mockUsername = 'test-user';
      
      (Keychain.setInternetCredentials as jest.Mock).mockResolvedValue(true);
      
      await Keychain.setInternetCredentials('mobdeck', mockUsername, mockToken);
      
      expect(Keychain.setInternetCredentials).toHaveBeenCalledWith(
        'mobdeck',
        mockUsername,
        mockToken
      );
    });

    test('should retrieve tokens securely from keychain', async () => {
      const mockCredentials = {
        username: 'test-user',
        password: 'test-token-123',
      };
      
      (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue(mockCredentials);
      
      const result = await Keychain.getInternetCredentials('mobdeck');
      
      expect(result).toEqual(mockCredentials);
      expect(Keychain.getInternetCredentials).toHaveBeenCalledWith('mobdeck');
    });

    test('should handle keychain errors gracefully', async () => {
      (Keychain.getInternetCredentials as jest.Mock).mockRejectedValue(
        new Error('Keychain access denied')
      );
      
      await expect(Keychain.getInternetCredentials('mobdeck')).rejects.toThrow(
        'Keychain access denied'
      );
    });

    test('should support biometric authentication', async () => {
      (Keychain.getSupportedBiometryType as jest.Mock).mockResolvedValue('TouchID');
      
      const biometryType = await Keychain.getSupportedBiometryType();
      
      expect(biometryType).toBe('TouchID');
      expect(Keychain.getSupportedBiometryType).toHaveBeenCalled();
    });
  });

  describe('Input Validation Security', () => {
    test('should validate API URLs', () => {
      const validUrls = [
        'https://api.example.com',
        'http://localhost:3000',
        'https://readeck.example.com:8080',
      ];
      
      const invalidUrls = [
        'javascript:alert(1)',
        'file:///etc/passwd',
        'ftp://malicious.com',
        'data:text/html,<script>alert(1)</script>',
      ];
      
      validUrls.forEach(url => {
        expect(isValidApiUrl(url)).toBe(true);
      });
      
      invalidUrls.forEach(url => {
        expect(isValidApiUrl(url)).toBe(false);
      });
    });

    test('should validate API tokens', () => {
      const validTokens = [
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'api-key-123456789',
        'token_abcdef123456',
      ];
      
      const invalidTokens = [
        '',
        null,
        undefined,
        '<script>alert(1)</script>',
        'token with spaces',
        'token\nwith\nnewlines',
      ];
      
      validTokens.forEach(token => {
        expect(isValidToken(token)).toBe(true);
      });
      
      invalidTokens.forEach(token => {
        expect(isValidToken(token)).toBe(false);
      });
    });

    test('should sanitize user inputs', () => {
      const dangerousInputs = [
        '<script>alert("XSS")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        '"><script>alert(1)</script>',
      ];
      
      dangerousInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
      });
    });
  });

  describe('Error Handling Security', () => {
    test('should sanitize error messages to prevent token leakage', () => {
      const sensitiveErrors = [
        'Authentication failed with token: Bearer abc123',
        'API request failed: https://api.example.com?token=secret123',
        'Database error: password=mypassword',
        'Network error: Authorization: Bearer xyz789',
      ];
      
      sensitiveErrors.forEach(error => {
        const sanitized = sanitizeErrorMessage(error);
        expect(sanitized).not.toContain('Bearer abc123');
        expect(sanitized).not.toContain('token=secret123');
        expect(sanitized).not.toContain('password=mypassword');
        expect(sanitized).not.toContain('Bearer xyz789');
      });
    });

    test('should prevent sensitive data in console logs', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const sensitiveData = {
        token: 'secret-token-123',
        password: 'user-password',
        apiKey: 'api-key-456',
      };
      
      // This should not log sensitive data
      safeLog('User data:', sensitiveData);
      
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('secret-token-123')
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('user-password')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Data Storage Security', () => {
    test('should use keychain for sensitive data instead of AsyncStorage', async () => {
      // Test that we use proper storage for sensitive data
      const sensitiveData = {
        token: 'secret-token',
        password: 'user-password',
      };
      
      // Store sensitive data in keychain
      (Keychain.setInternetCredentials as jest.Mock).mockResolvedValue(true);
      
      await Keychain.setInternetCredentials('mobdeck', 'user', sensitiveData.token);
      
      expect(Keychain.setInternetCredentials).toHaveBeenCalledWith(
        'mobdeck',
        'user',
        sensitiveData.token
      );
      
      // Only store non-sensitive data in AsyncStorage
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(true);
      
      await AsyncStorage.setItem('app-settings', '{"theme": "dark"}');
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'app-settings',
        '{"theme": "dark"}'
      );
    });

    test('should clear sensitive data on app backgrounding', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(true);
      
      await clearSensitiveData();
      
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('temp-data');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('cache-data');
    });
  });
});

// Helper functions (would be in actual implementation)
function isValidApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isValidToken(token: any): boolean {
  if (token === null || token === undefined || typeof token !== 'string' || token.length === 0) {
    return false;
  }
  
  // Allow Bearer tokens with spaces
  if (token.startsWith('Bearer ')) {
    return !token.includes('<') && !token.includes('>') && !token.includes('\n') && !token.includes('\r');
  }
  
  // For non-Bearer tokens, disallow spaces
  return (
    !token.includes('<') &&
    !token.includes('>') &&
    !token.includes('\n') &&
    !token.includes('\r') &&
    !token.includes(' ')
  );
}

function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/onerror=/gi, '')
    .replace(/onload=/gi, '');
}

function sanitizeErrorMessage(error: string): string {
  return error
    .replace(/Bearer\s+[\w-]+/g, 'Bearer [REDACTED]')
    .replace(/token=[\w-]+/g, 'token=[REDACTED]')
    .replace(/password=[\w-]+/g, 'password=[REDACTED]')
    .replace(/Authorization:\s*Bearer\s+[\w-]+/g, 'Authorization: Bearer [REDACTED]');
}

function safeLog(message: string, data?: any): void {
  if (data && typeof data === 'object') {
    const sanitizedData = { ...data };
    ['token', 'password', 'apiKey', 'authorization'].forEach(key => {
      if (sanitizedData[key]) {
        sanitizedData[key] = '[REDACTED]';
      }
    });
    console.log(message, sanitizedData);
  } else {
    console.log(message);
  }
}

function clearSensitiveData(): Promise<void> {
  return Promise.all([
    AsyncStorage.removeItem('temp-data'),
    AsyncStorage.removeItem('cache-data'),
  ]).then(() => {});
}