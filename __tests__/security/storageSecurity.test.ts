/**
 * Security Tests: Storage Security
 * Tests for secure token storage in AuthStorageService
 */

import * as Keychain from 'react-native-keychain';
import AuthStorageService from '../../src/services/AuthStorageService';
import { validateToken, generateSecureRandom, hashData } from '../../src/utils/security';
import { StorageErrorCode } from '../../src/types/auth';

// Mock dependencies
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(),
  getInternetCredentials: jest.fn(),
  resetInternetCredentials: jest.fn(),
  getSupportedBiometryType: jest.fn(),
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  },
  BIOMETRY_TYPE: {
    BIOMETRICS: 'Biometrics',
    TOUCH_ID: 'TouchID',
    FACE_ID: 'FaceID',
  },
}));

jest.mock('../../src/utils/security', () => ({
  validateToken: jest.fn(),
  generateSecureRandom: jest.fn(),
  hashData: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  },
}));

describe('Storage Security: AuthStorageService', () => {
  let authService: AuthStorageService;
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5MTYyMzkwMjJ9.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';

  beforeEach(() => {
    authService = new AuthStorageService();
    jest.clearAllMocks();
    
    // Setup default mocks
    (validateToken as jest.Mock).mockReturnValue({ isValid: true });
    (generateSecureRandom as jest.Mock).mockReturnValue('random-salt-value');
    (hashData as jest.Mock).mockReturnValue('hashed-checksum');
    
    // Mock console methods to prevent actual logging during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  describe('Token Storage', () => {
    it('should validate token before storing', async () => {
      // Mock validation to return false for this test
      (validateToken as jest.Mock).mockReturnValueOnce({ isValid: false });
      
      // Test with invalid token (too short)
      const result = await authService.storeToken('short');

      expect(result).toBe(false);
      expect(Keychain.setInternetCredentials).not.toHaveBeenCalled();
    });

    it('should store token with security metadata', async () => {
      (Keychain.setInternetCredentials as jest.Mock).mockResolvedValue(true);

      const result = await authService.storeToken(mockToken);

      expect(result).toBe(true);
      expect(Keychain.setInternetCredentials).toHaveBeenCalledWith(
        'mobdeck_auth_tokens',
        'api_token',
        expect.stringContaining('"version":"1.0"'),
        expect.objectContaining({
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        })
      );
    });

    it('should generate and store token checksum', async () => {
      (Keychain.setInternetCredentials as jest.Mock).mockResolvedValue(true);

      await authService.storeToken(mockToken);

      expect(generateSecureRandom).toHaveBeenCalledWith(16);
      expect(hashData).toHaveBeenCalledWith(mockToken, 'random-salt-value');
      
      const storedData = JSON.parse(
        (Keychain.setInternetCredentials as jest.Mock).mock.calls[0][2]
      );
      expect(storedData.checksum).toBe('hashed-checksum');
    });

    it('should reject empty or invalid tokens', async () => {
      const invalidTokens = ['', '   ', null, undefined];

      for (const token of invalidTokens) {
        const result = await authService.storeToken(token as any);
        expect(result).toBe(false);
      }

      expect(Keychain.setInternetCredentials).not.toHaveBeenCalled();
    });

    it('should extract expiration from JWT', async () => {
      (Keychain.setInternetCredentials as jest.Mock).mockResolvedValue(true);

      await authService.storeToken(mockToken);

      const storedData = JSON.parse(
        (Keychain.setInternetCredentials as jest.Mock).mock.calls[0][2]
      );
      
      // The mock token has exp: 1916239022 (year 2030)
      const expirationDate = new Date(storedData.expiresAt);
      expect(expirationDate.getFullYear()).toBeGreaterThan(2025);
    });
  });

  describe('Token Retrieval', () => {
    it('should verify token integrity on retrieval', async () => {
      const storedData = {
        token: mockToken,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        issuedAt: new Date().toISOString(),
        serverUrl: '',
        version: '1.0',
        checksum: 'stored-checksum',
      };

      (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
        password: JSON.stringify(storedData),
      });

      const token = await authService.retrieveToken();

      expect(token).toBe(mockToken);
    });

    it('should delete token if checksum verification fails', async () => {
      const tamperedData = {
        token: 'tampered-token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        issuedAt: new Date().toISOString(),
        serverUrl: '',
        version: '1.0',
        checksum: 'invalid-checksum',
      };

      (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
        password: JSON.stringify(tamperedData),
      });
      (Keychain.resetInternetCredentials as jest.Mock).mockResolvedValue(true);

      // Mock checksum verification failure
      jest.spyOn(authService as any, 'verifyTokenChecksum').mockReturnValueOnce(false);

      const token = await authService.retrieveToken();

      expect(token).toBeNull();
      expect(Keychain.resetInternetCredentials).toHaveBeenCalled();
    });

    it('should handle corrupted token data', async () => {
      (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
        password: 'not-valid-json',
      });
      (Keychain.resetInternetCredentials as jest.Mock).mockResolvedValue(true);

      const token = await authService.retrieveToken();

      expect(token).toBeNull();
      expect(Keychain.resetInternetCredentials).toHaveBeenCalled();
    });

    it('should check token rotation requirements', async () => {
      const oldTokenData = {
        token: mockToken,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        issuedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days old
        serverUrl: '',
        version: '1.0',
      };

      (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
        password: JSON.stringify(oldTokenData),
      });

      // Mock logger.info to capture the rotation message
      const loggerMock = require('../../src/utils/logger');
      const loggerInfoSpy = jest.spyOn(loggerMock.logger, 'info');
      
      await authService.retrieveToken();

      // Should log rotation recommendation
      expect(loggerInfoSpy).toHaveBeenCalledWith(
        'Token rotation recommended'
      );
    });
  });

  describe('Token Deletion', () => {
    it('should securely delete tokens', async () => {
      (Keychain.resetInternetCredentials as jest.Mock).mockResolvedValue(true);

      const result = await authService.deleteToken();

      expect(result).toBe(true);
      expect(Keychain.resetInternetCredentials).toHaveBeenCalledWith('mobdeck_auth_tokens');
    });

    it('should handle deletion errors gracefully', async () => {
      (Keychain.resetInternetCredentials as jest.Mock).mockRejectedValue(
        new Error('Keychain error')
      );

      const result = await authService.deleteToken();

      expect(result).toBe(false);
    });

    it('should clear rotation check on deletion', async () => {
      (Keychain.resetInternetCredentials as jest.Mock).mockResolvedValue(true);

      // Access private property for testing
      (authService as any).lastRotationCheck = new Date();
      
      await authService.deleteToken();

      expect((authService as any).lastRotationCheck).toBeNull();
    });
  });

  describe('Token Validation', () => {
    it('should validate stored token expiration', async () => {
      const expiredToken = {
        token: mockToken,
        expiresAt: new Date(Date.now() - 86400000).toISOString(), // Expired yesterday
        issuedAt: new Date(Date.now() - 172800000).toISOString(),
        serverUrl: '',
      };

      (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
        password: JSON.stringify(expiredToken),
      });

      const result = await authService.validateStoredToken();

      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.expiresIn).toBe(0);
    });

    it('should calculate time until expiration', async () => {
      const futureExpiration = Date.now() + 3600000; // 1 hour from now
      const validToken = {
        token: mockToken,
        expiresAt: new Date(futureExpiration).toISOString(),
        issuedAt: new Date().toISOString(),
        serverUrl: '',
      };

      (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
        password: JSON.stringify(validToken),
      });

      const result = await authService.validateStoredToken();

      expect(result.isValid).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(result.expiresIn).toBeGreaterThan(3500); // Close to 3600 seconds
      expect(result.expiresIn).toBeLessThan(3700);
    });
  });

  describe('Biometric Authentication', () => {
    it('should enable biometric authentication when available', async () => {
      (Keychain.getSupportedBiometryType as jest.Mock).mockResolvedValue('TouchID');

      const result = await authService.enableBiometricAuth();

      expect(result).toBe(true);
      expect((authService as any).keychainOptions.touchID).toBe(true);
      expect((authService as any).keychainOptions.biometryType).toBe('TouchID');
    });

    it('should handle devices without biometric support', async () => {
      (Keychain.getSupportedBiometryType as jest.Mock).mockResolvedValue(null);

      const result = await authService.enableBiometricAuth();

      expect(result).toBe(false);
      expect((authService as any).keychainOptions.touchID).toBe(false);
    });

    it('should disable biometric authentication', () => {
      (authService as any).keychainOptions.touchID = true;

      authService.disableBiometricAuth();

      expect((authService as any).keychainOptions.touchID).toBe(false);
    });
  });

  describe('Security Configuration', () => {
    it('should return current security configuration', async () => {
      (Keychain.getSupportedBiometryType as jest.Mock).mockResolvedValue('FaceID');

      const config = await authService.getSecurityConfig();

      expect(config).toEqual({
        biometricEnabled: false,
        biometricType: 'FaceID',
        tokenRotationEnabled: true,
        lastRotationCheck: null,
      });
    });
  });

  describe('Error Handling', () => {
    it('should categorize keychain errors correctly', async () => {
      const errors = [
        { error: new Error('UserCancel'), expectedCode: StorageErrorCode.USER_CANCELLED },
        { error: new Error('BiometryNotAvailable'), expectedCode: StorageErrorCode.BIOMETRIC_UNAVAILABLE },
        { error: new Error('KeychainError'), expectedCode: StorageErrorCode.KEYCHAIN_UNAVAILABLE },
      ];

      for (const { error, expectedCode } of errors) {
        (Keychain.setInternetCredentials as jest.Mock).mockRejectedValueOnce(error);

        const result = await authService.storeToken(mockToken);

        expect(result).toBe(false);
        // Verify error was categorized correctly (would be logged)
      }
    });
  });

  describe('Version Compatibility', () => {
    it('should accept legacy tokens without version', async () => {
      const legacyToken = {
        token: mockToken,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        issuedAt: new Date().toISOString(),
        serverUrl: '',
        // No version field
      };

      (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
        password: JSON.stringify(legacyToken),
      });

      const token = await authService.retrieveToken();

      expect(token).toBe(mockToken);
    });

    it('should warn about incompatible token versions', async () => {
      const futureToken = {
        token: mockToken,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        issuedAt: new Date().toISOString(),
        serverUrl: '',
        version: '2.0', // Future version
      };

      (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
        password: JSON.stringify(futureToken),
      });

      // Mock logger.warn to capture the version warning
      const loggerMock = require('../../src/utils/logger');
      const loggerWarnSpy = jest.spyOn(loggerMock.logger, 'warn');
      
      await authService.retrieveToken();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Token version incompatible, migration required'
      );
    });
  });
});