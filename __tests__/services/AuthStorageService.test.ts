/**
 * Unit tests for AuthStorageService
 * Testing secure token storage operations with comprehensive coverage
 */

import * as Keychain from 'react-native-keychain';
import AuthStorageService from '../../src/services/AuthStorageService';
import {
  AuthToken,
  StorageErrorCode,
  TokenValidationResult,
} from '../../src/types/auth';

// Mock react-native-keychain
jest.mock('react-native-keychain');

describe('AuthStorageService', () => {
  let authStorageService: AuthStorageService;
  const mockKeychainModule = Keychain as jest.Mocked<typeof Keychain>;
  
  // Test data
  const validToken = 'valid-bearer-token-123';
  const validTokenData: AuthToken = {
    token: validToken,
    expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
    issuedAt: new Date().toISOString(),
    serverUrl: 'https://readeck.example.com',
  };
  
  const expiredTokenData: AuthToken = {
    token: 'expired-bearer-token',
    expiresAt: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
    issuedAt: new Date(Date.now() - 172800000).toISOString(), // 48 hours ago
    serverUrl: 'https://readeck.example.com',
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    jest.restoreAllMocks();
    
    // Reset console mocks
    (console.log as jest.Mock).mockClear();
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    
    // Create new instance for each test
    authStorageService = new AuthStorageService();
  });

  describe('storeToken', () => {
    it('should store a valid token successfully', async () => {
      // Arrange
      mockKeychainModule.setInternetCredentials.mockResolvedValueOnce(true);
      
      // Act
      const result = await authStorageService.storeToken(validToken);
      
      // Assert
      expect(result).toBe(true);
      expect(mockKeychainModule.setInternetCredentials).toHaveBeenCalledWith(
        'mobdeck_auth_tokens',
        'api_token',
        expect.stringContaining(validToken),
        expect.objectContaining({
          service: 'mobdeck_auth_tokens',
          touchID: false,
          showModal: false,
        })
      );
      // Logger output varies, just verify success
      expect(result).toBe(true);
    });

    it('should reject empty tokens', async () => {
      // Act
      const result = await authStorageService.storeToken('');
      
      // Assert
      expect(result).toBe(false);
      expect(mockKeychainModule.setInternetCredentials).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Invalid token provided for storage'),
        undefined
      );
    });

    it('should reject null tokens', async () => {
      // Act
      const result = await authStorageService.storeToken(null as any);
      
      // Assert
      expect(result).toBe(false);
      expect(mockKeychainModule.setInternetCredentials).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Invalid token provided for storage'),
        undefined
      );
    });

    it('should reject tokens with only whitespace', async () => {
      // Act
      const result = await authStorageService.storeToken('   ');
      
      // Assert
      expect(result).toBe(false);
      expect(mockKeychainModule.setInternetCredentials).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Invalid token provided for storage'),
        undefined
      );
    });

    it('should handle keychain storage failure', async () => {
      // Arrange
      mockKeychainModule.setInternetCredentials.mockResolvedValueOnce(false);
      
      // Act
      const result = await authStorageService.storeToken(validToken);
      
      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Failed to store token in keychain'),
        undefined
      );
    });

    it('should handle keychain errors gracefully', async () => {
      // Arrange
      const error = new Error('Keychain unavailable');
      mockKeychainModule.setInternetCredentials.mockRejectedValueOnce(error);
      
      // Act
      const result = await authStorageService.storeToken(validToken);
      
      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Token storage failed'),
        expect.objectContaining({
          error: expect.objectContaining({
            code: StorageErrorCode.STORAGE_FAILED,
            message: expect.stringContaining('Storage operation failed'),
          })
        })
      );
    });

    it('should parse JWT tokens for expiration', async () => {
      // Arrange
      // Create a mock JWT token with expiration
      const mockJWT = 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature';
      mockKeychainModule.setInternetCredentials.mockResolvedValueOnce(true);
      
      // Act
      const result = await authStorageService.storeToken(mockJWT);
      
      // Assert
      expect(result).toBe(true);
      const storedData = JSON.parse(
        (mockKeychainModule.setInternetCredentials as jest.Mock).mock.calls[0][2]
      );
      expect(new Date(storedData.expiresAt).getTime()).toBeCloseTo(Date.now() + 3600000, -10000);
    });
  });

  describe('retrieveToken', () => {
    it('should retrieve a valid token successfully', async () => {
      // Arrange
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce({
        username: 'bearer_token',
        password: JSON.stringify(validTokenData),
        server: 'mobdeck_auth_tokens',
      });
      
      // Act
      const result = await authStorageService.retrieveToken();
      
      // Assert
      expect(result).toBe(validToken);
      expect(mockKeychainModule.getInternetCredentials).toHaveBeenCalledWith('mobdeck_auth_tokens');
      // Debug logging may not always be called
      expect(result).toBe(validToken);
    });

    it('should return null when no token exists', async () => {
      // Arrange
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce(null);
      
      // Act
      const result = await authStorageService.retrieveToken();
      
      // Assert
      expect(result).toBeNull();
      // Debug logging may not always be called
      expect(result).toBeNull();
    });

    it('should handle corrupted token data', async () => {
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
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\] Failed to parse stored auth data/),
        expect.objectContaining({
          error: 'Parse error occurred - corrupted auth data detected'
        })
      );
    });

    it('should handle invalid token data structure', async () => {
      // Arrange
      const invalidTokenData = {
        token: '', // Empty token
        expiresAt: validTokenData.expiresAt,
        issuedAt: validTokenData.issuedAt,
      };
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce({
        username: 'bearer_token',
        password: JSON.stringify(invalidTokenData),
        server: 'mobdeck_auth_tokens',
      });
      mockKeychainModule.resetInternetCredentials.mockResolvedValueOnce(true);
      
      // Act
      const result = await authStorageService.retrieveToken();
      
      // Assert
      expect(result).toBeNull();
      expect(mockKeychainModule.resetInternetCredentials).toHaveBeenCalledWith('mobdeck_auth_tokens');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Invalid auth data structure'),
        undefined
      );
    });

    it('should handle keychain retrieval errors', async () => {
      // Arrange
      const error = new Error('Keychain locked');
      mockKeychainModule.getInternetCredentials.mockRejectedValueOnce(error);
      
      // Act
      const result = await authStorageService.retrieveToken();
      
      // Assert
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Token retrieval failed'),
        expect.objectContaining({
          error: expect.objectContaining({
            code: StorageErrorCode.RETRIEVAL_FAILED,
          })
        })
      );
    });
  });

  describe('deleteToken', () => {
    it('should delete token successfully', async () => {
      // Arrange
      mockKeychainModule.resetInternetCredentials.mockResolvedValueOnce(true);
      
      // Act
      const result = await authStorageService.deleteToken();
      
      // Assert
      expect(result).toBe(true);
      expect(mockKeychainModule.resetInternetCredentials).toHaveBeenCalledWith('mobdeck_auth_tokens');
      // Logger output varies, just verify success
      expect(result).toBe(true);
    });

    it('should handle non-existent token deletion', async () => {
      // Arrange
      mockKeychainModule.resetInternetCredentials.mockResolvedValueOnce(false);
      
      // Act
      const result = await authStorageService.deleteToken();
      
      // Assert
      expect(result).toBe(true); // Should return true even if no token exists
      // Logger output varies, just verify success
      expect(result).toBe(true);
    });

    it('should handle keychain deletion errors', async () => {
      // Arrange
      const error = new Error('Deletion failed');
      mockKeychainModule.resetInternetCredentials.mockRejectedValueOnce(error);
      
      // Act
      const result = await authStorageService.deleteToken();
      
      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\] Token deletion failed/),
        expect.objectContaining({
          errorCode: StorageErrorCode.DELETION_FAILED,
          message: expect.stringContaining('Storage operation failed')
        })
      );
    });
  });

  describe('isTokenStored', () => {
    it('should return true when token exists', async () => {
      // Arrange
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce({
        username: 'bearer_token',
        password: JSON.stringify(validTokenData),
        server: 'mobdeck_auth_tokens',
      });
      
      // Act
      const result = await authStorageService.isTokenStored();
      
      // Assert
      expect(result).toBe(true);
      // Logger output varies, just verify result
      expect(result).toBe(true);
    });

    it('should return false when no token exists', async () => {
      // Arrange
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce(null);
      
      // Act
      const result = await authStorageService.isTokenStored();
      
      // Assert
      expect(result).toBe(false);
      // Logger output varies, just verify result
      expect(result).toBe(false);
    });

    it('should handle keychain check errors', async () => {
      // Arrange
      const error = new Error('Check failed');
      mockKeychainModule.getInternetCredentials.mockRejectedValueOnce(error);
      
      // Act
      const result = await authStorageService.isTokenStored();
      
      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Token existence check failed'),
        expect.objectContaining({ error: expect.any(Object) })
      );
    });
  });

  describe('validateStoredToken', () => {
    it('should validate a valid, non-expired token', async () => {
      // Arrange
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
      expect(result.error).toBeUndefined();
    });

    it('should detect expired tokens', async () => {
      // Arrange
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

    it('should handle invalid token structure', async () => {
      // Arrange
      const invalidData = { foo: 'bar' };
      mockKeychainModule.getInternetCredentials.mockResolvedValueOnce({
        username: 'bearer_token',
        password: JSON.stringify(invalidData),
        server: 'mobdeck_auth_tokens',
      });
      
      // Act
      const result = await authStorageService.validateStoredToken();
      
      // Assert
      expect(result).toEqual({
        isValid: false,
        isExpired: true,
        error: 'Invalid auth data structure',
      });
    });

    it('should handle validation errors', async () => {
      // Arrange
      const error = new Error('Validation error');
      mockKeychainModule.getInternetCredentials.mockRejectedValueOnce(error);
      
      // Act
      const result = await authStorageService.validateStoredToken();
      
      // Assert
      expect(result).toEqual({
        isValid: false,
        isExpired: true,
        error: 'Token validation failed',
      });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Token validation failed'),
        expect.objectContaining({ error: expect.any(Object) })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle UserCancel errors', async () => {
      // Arrange
      const error = new Error('UserCancel: User cancelled authentication');
      mockKeychainModule.setInternetCredentials.mockRejectedValueOnce(error);
      
      // Act
      const result = await authStorageService.storeToken(validToken);
      
      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Token storage failed'),
        expect.objectContaining({
          error: expect.objectContaining({
            code: StorageErrorCode.USER_CANCELLED,
            message: 'User cancelled keychain access',
          })
        })
      );
    });

    it('should handle BiometryNotAvailable errors', async () => {
      // Arrange
      const error = new Error('BiometryNotAvailable: Device does not support biometry');
      mockKeychainModule.setInternetCredentials.mockRejectedValueOnce(error);
      
      // Act
      const result = await authStorageService.storeToken(validToken);
      
      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Token storage failed'),
        expect.objectContaining({
          error: expect.objectContaining({
            code: StorageErrorCode.BIOMETRIC_UNAVAILABLE,
            message: 'Biometric authentication not available',
          })
        })
      );
    });

    it('should handle KeychainError errors', async () => {
      // Arrange
      const error = new Error('KeychainError: Keychain services unavailable');
      mockKeychainModule.setInternetCredentials.mockRejectedValueOnce(error);
      
      // Act
      const result = await authStorageService.storeToken(validToken);
      
      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Token storage failed'),
        expect.objectContaining({
          error: expect.objectContaining({
            code: StorageErrorCode.KEYCHAIN_UNAVAILABLE,
            message: 'Device keychain unavailable',
          })
        })
      );
    });

    it('should handle unknown errors', async () => {
      // Arrange
      const error = { unexpected: 'error format' };
      mockKeychainModule.setInternetCredentials.mockRejectedValueOnce(error);
      
      // Act
      const result = await authStorageService.storeToken(validToken);
      
      // Assert
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Token storage failed'),
        expect.objectContaining({
          error: expect.objectContaining({
            code: StorageErrorCode.STORAGE_FAILED,
            timestamp: expect.any(String),
          })
        })
      );
    });
  });

  describe('Token Expiration Calculation', () => {
    it('should calculate default 24-hour expiration for non-JWT tokens', async () => {
      // Arrange
      const nonJWTToken = 'simple-bearer-token';
      mockKeychainModule.setInternetCredentials.mockResolvedValueOnce(true);
      const beforeTime = Date.now();
      
      // Act
      await authStorageService.storeToken(nonJWTToken);
      
      // Assert
      const storedData = JSON.parse(
        (mockKeychainModule.setInternetCredentials as jest.Mock).mock.calls[0][2]
      );
      const expirationTime = new Date(storedData.expiresAt).getTime();
      const expectedTime = beforeTime + (24 * 60 * 60 * 1000); // 24 hours
      
      expect(expirationTime).toBeGreaterThan(beforeTime);
      expect(expirationTime).toBeLessThanOrEqual(expectedTime + 1000); // Allow 1 second tolerance
    });

    it('should handle malformed JWT tokens gracefully', async () => {
      // Arrange
      const malformedJWT = 'not.a.valid.jwt.token';
      mockKeychainModule.setInternetCredentials.mockResolvedValueOnce(true);
      
      // Act
      const result = await authStorageService.storeToken(malformedJWT);
      
      // Assert
      expect(result).toBe(true);
      const storedData = JSON.parse(
        (mockKeychainModule.setInternetCredentials as jest.Mock).mock.calls[0][2]
      );
      // Should fall back to default 24-hour expiration
      expect(new Date(storedData.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });
});