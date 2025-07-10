/**
 * Comprehensive security validation tests for AuthStorageService
 * Tests production-ready security features and edge cases
 */

import * as Keychain from 'react-native-keychain';
import AuthStorageService from '../../src/services/AuthStorageService';
import { StorageErrorCode } from '../../src/types/auth';

// Mock dependencies
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(),
  getInternetCredentials: jest.fn(),
  resetInternetCredentials: jest.fn(),
  getSupportedBiometryType: jest.fn(),
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
  },
  BIOMETRY_TYPE: {
    BIOMETRICS: 'Biometrics',
    FACE_ID: 'FaceID',
    TOUCH_ID: 'TouchID',
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../src/utils/security', () => ({
  generateSecureRandom: jest.fn(() => 'mocked-random-salt'),
  hashData: jest.fn(() => 'mocked-hash-checksum'),
}));

// Console mocks for testing
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

Object.assign(console, mockConsole);

describe('AuthStorageService Security Validation', () => {
  let authStorageService: AuthStorageService;
  const mockKeychainModule = Keychain as jest.Mocked<typeof Keychain>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    authStorageService = new AuthStorageService();
  });

  describe('Hardware-backed encryption validation', () => {
    it('should enforce minimum token length security', async () => {
      // Act
      const result = await authStorageService.storeToken('short');
      
      // Assert
      expect(result).toBe(false);
      expect(mockKeychainModule.setInternetCredentials).not.toHaveBeenCalled();
    });

    it('should enforce maximum token length security', async () => {
      // Arrange
      const longToken = 'a'.repeat(5000); // Exceeds 4096 limit
      
      // Act
      const result = await authStorageService.storeToken(longToken);
      
      // Assert
      expect(result).toBe(false);
      expect(mockKeychainModule.setInternetCredentials).not.toHaveBeenCalled();
    });

    it('should use secure keychain options', async () => {
      // Arrange
      mockKeychainModule.setInternetCredentials.mockResolvedValueOnce(true);
      const token = 'secure-test-token-123';
      
      // Act
      await authStorageService.storeToken(token);
      
      // Assert
      expect(mockKeychainModule.setInternetCredentials).toHaveBeenCalledWith(
        'mobdeck_auth_tokens',
        'api_token',
        expect.any(String),
        expect.objectContaining({
          service: 'mobdeck_auth_tokens',
          accessible: 'WhenUnlockedThisDeviceOnly',
          touchID: false,
          showModal: false,
        })
      );
    });

    it('should handle keychain unavailable scenario gracefully', async () => {
      // Arrange
      const keychainError = new Error('KeychainError: Keychain services unavailable');
      mockKeychainModule.setInternetCredentials.mockRejectedValueOnce(keychainError);
      
      // Act
      const result = await authStorageService.storeToken('test-token-123');
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Token storage security features', () => {
    it('should store tokens with security metadata', async () => {
      // Arrange
      mockKeychainModule.setInternetCredentials.mockResolvedValueOnce(true);
      const token = 'test-token-123';
      
      // Act
      await authStorageService.storeToken(token);
      
      // Assert
      expect(mockKeychainModule.setInternetCredentials).toHaveBeenCalled();
      const storedData = JSON.parse(mockKeychainModule.setInternetCredentials.mock.calls[0][2]);
      expect(storedData).toHaveProperty('token', token);
      expect(storedData).toHaveProperty('expiresAt');
      expect(storedData).toHaveProperty('issuedAt');
      expect(storedData).toHaveProperty('version', '1.0');
      expect(storedData).toHaveProperty('checksum', 'mocked-hash-checksum');
    });

    it('should use unique service identifier for token isolation', async () => {
      // Arrange
      mockKeychainModule.setInternetCredentials.mockResolvedValueOnce(true);
      
      // Act
      await authStorageService.storeToken('test-token-123');
      
      // Assert
      expect(mockKeychainModule.setInternetCredentials).toHaveBeenCalledWith(
        'mobdeck_auth_tokens',
        'api_token',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should validate token data structure on retrieval', async () => {
      // Arrange
      const invalidData = { invalid: 'structure' };
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce({
        username: 'bearer_token',
        password: JSON.stringify(invalidData),
        server: 'mobdeck_auth_tokens',
      });
      mockKeychainModule.resetInternetCredentials.mockResolvedValueOnce(true);
      
      // Act
      const result = await authStorageService.retrieveToken();
      
      // Assert
      expect(result).toBeNull();
      expect(mockKeychainModule.resetInternetCredentials).toHaveBeenCalledWith('mobdeck_auth_tokens');
    });
  });

  describe('Secure error handling validation', () => {
    it('should handle corrupted token data gracefully', async () => {
      // Arrange
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce({
        username: 'bearer_token',
        password: 'invalid-json-data',
        server: 'mobdeck_auth_tokens',
      });
      mockKeychainModule.resetInternetCredentials.mockResolvedValueOnce(true);
      
      // Act
      const result = await authStorageService.retrieveToken();
      
      // Assert
      expect(result).toBeNull();
      expect(mockKeychainModule.resetInternetCredentials).toHaveBeenCalledWith('mobdeck_auth_tokens');
    });

    it('should handle biometric authentication errors properly', async () => {
      // Arrange
      const biometricError = new Error('BiometryNotAvailable: Device does not support biometry');
      mockKeychainModule.setInternetCredentials.mockRejectedValueOnce(biometricError);
      
      // Act
      const result = await authStorageService.storeToken('test-token-123');
      
      // Assert
      expect(result).toBe(false);
    });

    it('should handle user cancellation gracefully', async () => {
      // Arrange
      const userCancelError = new Error('UserCancel: User cancelled authentication');
      mockKeychainModule.setInternetCredentials.mockRejectedValueOnce(userCancelError);
      
      // Act
      const result = await authStorageService.storeToken('test-token-123');
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Token access control', () => {
    it('should enforce token access through proper service name', async () => {
      // Arrange
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce(null);
      
      // Act
      await authStorageService.retrieveToken();
      
      // Assert
      expect(mockKeychainModule.getInternetCredentials).toHaveBeenCalledWith('mobdeck_auth_tokens');
    });

    it('should properly isolate token deletion', async () => {
      // Arrange
      mockKeychainModule.resetInternetCredentials.mockResolvedValueOnce(true);
      
      // Act
      await authStorageService.deleteToken();
      
      // Assert
      expect(mockKeychainModule.resetInternetCredentials).toHaveBeenCalledWith('mobdeck_auth_tokens');
    });

    it('should return true for deletion even if no token exists', async () => {
      // Arrange
      mockKeychainModule.resetInternetCredentials.mockResolvedValueOnce(false);
      
      // Act
      const result = await authStorageService.deleteToken();
      
      // Assert
      expect(result).toBe(true);
    });
  });

  describe('Token validation security', () => {
    it('should validate a valid, non-expired token', async () => {
      // Arrange
      const validTokenData = {
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        issuedAt: new Date().toISOString(),
        serverUrl: 'https://example.com',
      };
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce({
        username: 'bearer_token',
        password: JSON.stringify(validTokenData),
        server: 'mobdeck_auth_tokens',
      });
      
      // Act
      const result = await authStorageService.validateStoredToken();
      
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(result.expiresIn).toBeGreaterThan(0);
    });

    it('should detect expired tokens', async () => {
      // Arrange
      const expiredTokenData = {
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
        issuedAt: new Date().toISOString(),
        serverUrl: 'https://example.com',
      };
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce({
        username: 'bearer_token',
        password: JSON.stringify(expiredTokenData),
        server: 'mobdeck_auth_tokens',
      });
      
      // Act
      const result = await authStorageService.validateStoredToken();
      
      // Assert
      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.expiresIn).toBe(0);
    });

    it('should handle missing tokens', async () => {
      // Arrange
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce(null);
      
      // Act
      const result = await authStorageService.validateStoredToken();
      
      // Assert
      expect(result).toEqual({
        isValid: false,
        isExpired: true,
        error: 'No token found in storage',
      });
    });
  });

  describe('Biometric authentication security', () => {
    it('should enable biometric authentication when available', async () => {
      // Arrange
      mockKeychainModule.getSupportedBiometryType.mockResolvedValueOnce('FaceID');
      
      // Act
      const result = await authStorageService.enableBiometricAuth();
      
      // Assert
      expect(result).toBe(true);
    });

    it('should handle biometric unavailable scenario', async () => {
      // Arrange
      mockKeychainModule.getSupportedBiometryType.mockResolvedValueOnce(null);
      
      // Act
      const result = await authStorageService.enableBiometricAuth();
      
      // Assert
      expect(result).toBe(false);
    });

    it('should provide security configuration details', async () => {
      // Arrange
      mockKeychainModule.getSupportedBiometryType.mockResolvedValueOnce('TouchID');
      
      // Act
      const config = await authStorageService.getSecurityConfig();
      
      // Assert
      expect(config).toEqual({
        biometricEnabled: false,
        biometricType: 'TouchID',
        tokenRotationEnabled: true,
        lastRotationCheck: null,
      });
    });
  });

  describe('JWT token handling security', () => {
    it('should handle malformed JWT tokens gracefully', async () => {
      // Arrange
      const malformedJWT = 'not.a.valid.jwt.token';
      mockKeychainModule.setInternetCredentials.mockResolvedValueOnce(true);
      
      // Act
      const result = await authStorageService.storeToken(malformedJWT);
      
      // Assert
      expect(result).toBe(true);
      const storedData = JSON.parse(mockKeychainModule.setInternetCredentials.mock.calls[0][2]);
      expect(new Date(storedData.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('should calculate default 24-hour expiration for non-JWT tokens', async () => {
      // Arrange
      const nonJWTToken = 'simple-bearer-token';
      mockKeychainModule.setInternetCredentials.mockResolvedValueOnce(true);
      
      // Act
      await authStorageService.storeToken(nonJWTToken);
      
      // Assert
      const storedData = JSON.parse(mockKeychainModule.setInternetCredentials.mock.calls[0][2]);
      const expirationTime = new Date(storedData.expiresAt).getTime();
      const now = Date.now();
      
      expect(expirationTime).toBeGreaterThan(now);
      expect(expirationTime).toBeLessThan(now + (25 * 60 * 60 * 1000)); // Less than 25 hours
    });
  });

  describe('Device security edge cases', () => {
    it('should handle token storage with null input', async () => {
      // Act
      const result = await authStorageService.storeToken(null as any);
      
      // Assert
      expect(result).toBe(false);
      expect(mockKeychainModule.setInternetCredentials).not.toHaveBeenCalled();
    });

    it('should handle token storage with empty string', async () => {
      // Act
      const result = await authStorageService.storeToken('');
      
      // Assert
      expect(result).toBe(false);
      expect(mockKeychainModule.setInternetCredentials).not.toHaveBeenCalled();
    });

    it('should handle token storage with whitespace only', async () => {
      // Act
      const result = await authStorageService.storeToken('   ');
      
      // Assert
      expect(result).toBe(false);
      expect(mockKeychainModule.setInternetCredentials).not.toHaveBeenCalled();
    });

    it('should handle keychain retrieval errors', async () => {
      // Arrange
      const error = new Error('Keychain locked');
      mockKeychainModule.getInternetCredentials.mockRejectedValueOnce(error);
      
      // Act
      const result = await authStorageService.retrieveToken();
      
      // Assert
      expect(result).toBeNull();
    });

    it('should handle keychain deletion errors', async () => {
      // Arrange
      const error = new Error('Deletion failed');
      mockKeychainModule.resetInternetCredentials.mockRejectedValueOnce(error);
      
      // Act
      const result = await authStorageService.deleteToken();
      
      // Assert
      expect(result).toBe(false);
    });
  });
});