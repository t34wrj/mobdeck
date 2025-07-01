/**
 * Secure token storage service using react-native-keychain
 * Provides encrypted Bearer token storage with comprehensive error handling
 */

import * as Keychain from 'react-native-keychain';
import {
  IAuthStorageService,
  AuthToken,
  StorageError,
  StorageErrorCode,
  TokenValidationResult,
  KeychainOptions,
} from '../types/auth';

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
  private readonly USERNAME_KEY = 'bearer_token';

  private readonly keychainOptions: KeychainOptions = {
    service: this.SERVICE_NAME,
    touchID: false, // Disable biometric for basic auth
    showModal: false,
    authenticatePrompt: 'Authenticate to access your Readeck account',
  };

  /**
   * Store Bearer token securely in device keychain
   * @param token - Bearer token string to store
   * @returns Promise<boolean> - Success status
   */
  storeToken = async (token: string): Promise<boolean> => {
    try {
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        console.error(
          '[AuthStorageService] Invalid token provided for storage'
        );
        return false;
      }

      // Create token metadata for validation
      const tokenData: AuthToken = {
        token: token.trim(),
        expiresAt: this.calculateTokenExpiration(token),
        issuedAt: new Date().toISOString(),
        serverUrl: '', // Will be set by calling service
      };

      const result = await Keychain.setInternetCredentials(
        this.SERVICE_NAME,
        this.USERNAME_KEY,
        JSON.stringify(tokenData),
        this.keychainOptions
      );

      if (result) {
        console.log('[AuthStorageService] Token stored successfully');
        return true;
      } else {
        console.error('[AuthStorageService] Failed to store token in keychain');
        return false;
      }
    } catch (error) {
      const storageError = this.handleStorageError(
        error,
        StorageErrorCode.STORAGE_FAILED
      );
      console.error('[AuthStorageService] Token storage failed:', storageError);
      return false;
    }
  };

  /**
   * Retrieve Bearer token from secure keychain storage
   * @returns Promise<string | null> - Token string or null if not found
   */
  retrieveToken = async (): Promise<string | null> => {
    try {
      const credentials = await Keychain.getInternetCredentials(
        this.SERVICE_NAME
      );

      if (credentials && credentials.password) {
        try {
          const tokenData: AuthToken = JSON.parse(credentials.password);

          // Validate token structure
          if (this.isValidTokenData(tokenData)) {
            console.log('[AuthStorageService] Token retrieved successfully');
            return tokenData.token;
          } else {
            console.error('[AuthStorageService] Invalid token data structure');
            await this.deleteToken(); // Clean up invalid data
            return null;
          }
        } catch (parseError) {
          console.error(
            '[AuthStorageService] Failed to parse stored token data:',
            parseError
          );
          await this.deleteToken(); // Clean up corrupted data
          return null;
        }
      } else {
        console.log('[AuthStorageService] No token found in keychain');
        return null;
      }
    } catch (error) {
      const storageError = this.handleStorageError(
        error,
        StorageErrorCode.RETRIEVAL_FAILED
      );
      console.error(
        '[AuthStorageService] Token retrieval failed:',
        storageError
      );
      return null;
    }
  };

  /**
   * Delete Bearer token from secure storage
   * @returns Promise<boolean> - Success status
   */
  deleteToken = async (): Promise<boolean> => {
    try {
      const result = await Keychain.resetInternetCredentials(this.SERVICE_NAME);

      if (result) {
        console.log('[AuthStorageService] Token deleted successfully');
        return true;
      } else {
        console.warn(
          '[AuthStorageService] Token deletion completed (may not have existed)'
        );
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
   * Check if a Bearer token is stored in keychain
   * @returns Promise<boolean> - True if token exists
   */
  isTokenStored = async (): Promise<boolean> => {
    try {
      const credentials = await Keychain.getInternetCredentials(
        this.SERVICE_NAME
      );
      const hasToken = !!(credentials && credentials.password);

      console.log(`[AuthStorageService] Token existence check: ${hasToken}`);
      return hasToken;
    } catch (error) {
      console.error(
        '[AuthStorageService] Token existence check failed:',
        error
      );
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

      const tokenData: AuthToken = JSON.parse(credentials.password);

      if (!this.isValidTokenData(tokenData)) {
        return {
          isValid: false,
          isExpired: true,
          error: 'Invalid token data structure',
        };
      }

      const expirationDate = new Date(tokenData.expiresAt);
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
      console.error('[AuthStorageService] Token validation failed:', error);
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
   * Validate token data structure
   * @private
   */
  private isValidTokenData = (tokenData: any): tokenData is AuthToken => {
    return (
      tokenData &&
      typeof tokenData === 'object' &&
      typeof tokenData.token === 'string' &&
      typeof tokenData.expiresAt === 'string' &&
      typeof tokenData.issuedAt === 'string' &&
      tokenData.token.trim().length > 0
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
}

// Export singleton instance for consistent usage across the app
export const authStorageService = new AuthStorageService();

// Export class for testing and custom instantiation
export default AuthStorageService;
