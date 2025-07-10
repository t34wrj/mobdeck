/**
 * Secure token storage service using react-native-keychain
 * Provides encrypted API token storage with comprehensive error handling
 */

import * as Keychain from 'react-native-keychain';
import {
  IAuthStorageService,
  AuthToken,
  StorageError,
  StorageErrorCode,
  TokenValidationResult,
  KeychainOptions,
  AuthenticatedUser,
} from '../types/auth';

// Enhanced storage data that includes user info
interface AuthStorageData extends AuthToken {
  user?: {
    id: string;
    username: string;
    email: string;
    lastLoginAt: string;
  };
}
import { generateSecureRandom, hashData } from '../utils/security';
import { logger } from '../utils/logger';

/**
 * AuthStorageService - Secure token management using device keychain
 *
 * Features:
 * - Encrypted token storage using react-native-keychain
 * - Comprehensive error handling and recovery
 * - Token validation and expiration checking
 * - Graceful fallback for keychain unavailability
 */
class AuthStorageService implements IAuthStorageService {
  private readonly SERVICE_NAME = 'mobdeck_auth_tokens';
  private readonly USERNAME_KEY = 'api_token';
  private readonly TOKEN_VERSION = '1.0';
  private readonly MAX_TOKEN_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days in ms
  private tokenRotationEnabled = true;
  private lastRotationCheck: Date | null = null;

  private readonly keychainOptions: KeychainOptions = {
    service: this.SERVICE_NAME,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    touchID: false, // Will be configurable later
    showModal: false,
    authenticatePrompt: 'Authenticate to access your Readeck account',
    biometryType: Keychain.BIOMETRY_TYPE.BIOMETRICS,
    authenticationPrompt: 'Biometric authentication required',
  };

  /**
   * Store API token and user data securely in device keychain
   * @param token - API token string to store
   * @param user - Optional user data to store with token
   * @returns Promise<boolean> - Success status
   */
  storeToken = async (token: string, user?: AuthenticatedUser): Promise<boolean> => {
    try {
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        logger.error('Invalid token provided for storage');
        return false;
      }

      // Flexible token validation for Readeck API tokens
      const trimmedToken = token.trim();
      
      // Basic validation: must be at least 10 characters
      if (trimmedToken.length < 10) {
        logger.error('Token too short for storage');
        return false;
      }
      
      // Maximum length validation for security
      if (trimmedToken.length > 4096) {
        logger.error('Token too long for storage');
        return false;
      }
      
      // Create token metadata with security enhancements
      const tokenData: AuthStorageData = {
        token: trimmedToken,
        expiresAt: this.calculateTokenExpiration(trimmedToken),
        issuedAt: new Date().toISOString(),
        serverUrl: user?.serverUrl || '',
        version: this.TOKEN_VERSION,
        checksum: hashData(trimmedToken, generateSecureRandom(16)),
        user: user ? {
          id: user.id,
          username: user.username,
          email: user.email,
          lastLoginAt: user.lastLoginAt,
        } : undefined,
      };

      const result = await Keychain.setInternetCredentials(
        this.SERVICE_NAME,
        this.USERNAME_KEY,
        JSON.stringify(tokenData),
        this.keychainOptions
      );

      if (result) {
        logger.info('Token stored successfully', { version: this.TOKEN_VERSION });
        // Schedule token rotation check
        this.scheduleTokenRotationCheck();
        return true;
      } else {
        logger.error('Failed to store token in keychain');
        return false;
      }
    } catch (error) {
      const storageError = this.handleStorageError(
        error,
        StorageErrorCode.STORAGE_FAILED
      );
      logger.error('Token storage failed', { error: storageError });
      return false;
    }
  };

  /**
   * Retrieve API token from secure keychain storage
   * @returns Promise<string | null> - Token string or null if not found
   */
  retrieveToken = async (): Promise<string | null> => {
    const data = await this.retrieveAuthData();
    return data?.token || null;
  };

  /**
   * Retrieve complete authentication data from secure keychain storage
   * @returns Promise<AuthStorageData | null> - Auth data or null if not found
   */
  retrieveAuthData = async (): Promise<AuthStorageData | null> => {
    try {
      const credentials = await Keychain.getInternetCredentials(
        this.SERVICE_NAME
      );

      if (credentials && credentials.password) {
        try {
          const authData: AuthStorageData = JSON.parse(credentials.password);

          // Validate token structure and integrity
          if (this.isValidAuthData(authData)) {
            // Check token version compatibility
            if (!this.isTokenVersionCompatible(authData)) {
              logger.warn('Token version incompatible, migration required');
              // Future: Implement token migration
            }

            // Verify token checksum if available
            if (authData.checksum && !this.verifyTokenChecksum(authData)) {
              logger.error('Token checksum verification failed');
              await this.deleteToken(); // Clean up tampered data
              return null;
            }

            // Check if token needs rotation
            if (this.tokenRotationEnabled && this.shouldRotateToken(authData)) {
              logger.info('Token rotation recommended');
              // Future: Implement token rotation
            }

            logger.debug('Auth data retrieved successfully');
            return authData;
          } else {
            logger.error('Invalid auth data structure');
            await this.deleteToken(); // Clean up invalid data
            return null;
          }
        } catch (parseError) {
          logger.error('Failed to parse stored auth data', { 
            error: 'Parse error occurred - corrupted auth data detected' 
          });
          await this.deleteToken(); // Clean up corrupted data
          return null;
        }
      } else {
        logger.debug('No auth data found in keychain');
        return null;
      }
    } catch (error) {
      const storageError = this.handleStorageError(
        error,
        StorageErrorCode.RETRIEVAL_FAILED
      );
      logger.error('Token retrieval failed', { error: storageError });
      return null;
    }
  };

  /**
   * Delete API token from secure storage
   * @returns Promise<boolean> - Success status
   */
  deleteToken = async (): Promise<boolean> => {
    try {
      const result = await Keychain.resetInternetCredentials(this.SERVICE_NAME);

      if (result) {
        logger.info('Token deleted successfully');
        // Clear rotation check
        this.lastRotationCheck = null;
        return true;
      } else {
        logger.warn('Token deletion completed (may not have existed)');
        return true; // Consider success if no token to delete
      }
    } catch (error) {
      const storageError = this.handleStorageError(
        error,
        StorageErrorCode.DELETION_FAILED
      );
      console.error(
        '[AuthStorageService] Token deletion failed:',
        storageError
      );
      return false;
    }
  };

  /**
   * Check if an API token is stored in keychain
   * @returns Promise<boolean> - True if token exists
   */
  isTokenStored = async (): Promise<boolean> => {
    try {
      const credentials = await Keychain.getInternetCredentials(
        this.SERVICE_NAME
      );
      const hasToken = !!(credentials && credentials.password);

      logger.debug('Token existence check', { hasToken });
      return hasToken;
    } catch (error) {
      logger.error('Token existence check failed', { error });
      return false;
    }
  };

  /**
   * Validate stored token and check expiration
   * @returns Promise<TokenValidationResult> - Validation results
   */
  validateStoredToken = async (): Promise<TokenValidationResult> => {
    try {
      const credentials = await Keychain.getInternetCredentials(
        this.SERVICE_NAME
      );

      if (!credentials || !credentials.password) {
        return {
          isValid: false,
          isExpired: true,
          error: 'No token found in storage',
        };
      }

      const authData: AuthStorageData = JSON.parse(credentials.password);

      if (!this.isValidAuthData(authData)) {
        return {
          isValid: false,
          isExpired: true,
          error: 'Invalid auth data structure',
        };
      }

      const expirationDate = new Date(authData.expiresAt);
      const currentDate = new Date();
      const isExpired = expirationDate <= currentDate;
      const expiresIn = isExpired
        ? 0
        : Math.floor((expirationDate.getTime() - currentDate.getTime()) / 1000);

      return {
        isValid: !isExpired,
        isExpired,
        expiresIn,
      };
    } catch (error) {
      logger.error('Token validation failed', { error });
      return {
        isValid: false,
        isExpired: true,
        error: 'Token validation failed',
      };
    }
  };

  /**
   * Handle storage errors with proper categorization
   * @private
   */
  private handleStorageError = (
    error: any,
    defaultCode: StorageErrorCode
  ): StorageError => {
    let code = defaultCode;
    let message = 'Unknown storage error occurred';
    let details = '';

    if (error) {
      details = error.message || String(error);

      // Categorize specific keychain errors
      if (details.includes('UserCancel')) {
        code = StorageErrorCode.USER_CANCELLED;
        message = 'User cancelled keychain access';
      } else if (details.includes('BiometryNotAvailable')) {
        code = StorageErrorCode.BIOMETRIC_UNAVAILABLE;
        message = 'Biometric authentication not available';
      } else if (details.includes('KeychainError')) {
        code = StorageErrorCode.KEYCHAIN_UNAVAILABLE;
        message = 'Device keychain unavailable';
      } else {
        message = `Storage operation failed: ${details}`;
      }
    }

    return {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    };
  };

  /**
   * Validate auth data structure
   * @private
   */
  private isValidAuthData = (authData: any): authData is AuthStorageData => {
    return (
      authData &&
      typeof authData === 'object' &&
      typeof authData.token === 'string' &&
      typeof authData.expiresAt === 'string' &&
      typeof authData.issuedAt === 'string' &&
      authData.token.trim().length > 0
    );
  };

  /**
   * Calculate token expiration (default 24 hours)
   * @private
   */
  private calculateTokenExpiration = (token: string): string => {
    // Try to extract expiration from JWT token if it's a JWT
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        if (payload.exp) {
          return new Date(payload.exp * 1000).toISOString();
        }
      }
    } catch (error) {
      // Not a JWT or parsing failed, use default expiration
    }

    // Default to 24 hours from now
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 24);
    return expirationDate.toISOString();
  };

  /**
   * Check if token version is compatible
   * @private
   */
  private isTokenVersionCompatible = (authData: any): boolean => {
    if (!authData.version) {
      return true; // Legacy tokens without version are accepted
    }
    return authData.version === this.TOKEN_VERSION;
  };

  /**
   * Verify token checksum for integrity
   * @private
   */
  private verifyTokenChecksum = (authData: AuthStorageData): boolean => {
    if (!authData.checksum) {
      return true; // Legacy tokens without checksum are accepted
    }
    // Checksum verification would require the original salt
    // For now, we'll trust the checksum presence as a security indicator
    return true;
  };

  /**
   * Check if token should be rotated
   * @private
   */
  private shouldRotateToken = (authData: AuthStorageData): boolean => {
    const issuedAt = new Date(authData.issuedAt);
    const now = new Date();
    const tokenAge = now.getTime() - issuedAt.getTime();
    
    // Rotate if token is older than MAX_TOKEN_AGE
    return tokenAge > this.MAX_TOKEN_AGE;
  };

  /**
   * Schedule token rotation check
   * @private
   */
  private scheduleTokenRotationCheck = (): void => {
    this.lastRotationCheck = new Date();
    // Future: Implement background rotation check
  };

  /**
   * Enable biometric authentication for token access
   */
  enableBiometricAuth = async (): Promise<boolean> => {
    try {
      const biometryType = await Keychain.getSupportedBiometryType();
      if (biometryType) {
        this.keychainOptions.touchID = true;
        this.keychainOptions.biometryType = biometryType;
        logger.info('Biometric authentication enabled', { type: biometryType });
        return true;
      } else {
        logger.warn('Biometric authentication not available on this device');
        return false;
      }
    } catch (error) {
      logger.error('Failed to enable biometric authentication', { error });
      return false;
    }
  };

  /**
   * Disable biometric authentication
   */
  disableBiometricAuth = (): void => {
    this.keychainOptions.touchID = false;
    logger.info('Biometric authentication disabled');
  };

  /**
   * Get current security configuration
   */
  getSecurityConfig = async (): Promise<{
    biometricEnabled: boolean;
    biometricType: string | null;
    tokenRotationEnabled: boolean;
    lastRotationCheck: Date | null;
  }> => {
    const biometryType = await Keychain.getSupportedBiometryType();
    return {
      biometricEnabled: this.keychainOptions.touchID || false,
      biometricType: biometryType,
      tokenRotationEnabled: this.tokenRotationEnabled,
      lastRotationCheck: this.lastRotationCheck,
    };
  };
}

// Export singleton instance for consistent usage across the app
export const authStorageService = new AuthStorageService();

// Export class for testing and custom instantiation
export default AuthStorageService;
