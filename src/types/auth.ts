/**
 * Authentication and token management type definitions
 * Provides comprehensive typing for secure token storage operations
 */

// Core authentication token interface
export interface AuthToken {
  token: string;
  expiresAt: string;
  issuedAt: string;
  serverUrl: string;
}

// Token storage operation results
export interface AuthStorageResult {
  success: boolean;
  error?: StorageError;
}

// Storage error types for comprehensive error handling
export interface StorageError {
  code: StorageErrorCode;
  message: string;
  details?: string;
  timestamp: string;
}

export enum StorageErrorCode {
  KEYCHAIN_UNAVAILABLE = 'KEYCHAIN_UNAVAILABLE',
  STORAGE_FAILED = 'STORAGE_FAILED',
  RETRIEVAL_FAILED = 'RETRIEVAL_FAILED',
  DELETION_FAILED = 'DELETION_FAILED',
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  INVALID_TOKEN_FORMAT = 'INVALID_TOKEN_FORMAT',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  BIOMETRIC_UNAVAILABLE = 'BIOMETRIC_UNAVAILABLE',
  USER_CANCELLED = 'USER_CANCELLED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// Keychain storage options configuration
export interface KeychainOptions {
  service: string;
  accessGroup?: string;
  touchID?: boolean;
  showModal?: boolean;
  kSecAccessControl?: string;
  authenticatePrompt?: string;
}

// Token validation result
export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  expiresIn?: number;
  error?: string;
}

// Storage service interface for dependency injection
export interface IAuthStorageService {
  storeToken(token: string): Promise<boolean>;
  retrieveToken(): Promise<string | null>;
  deleteToken(): Promise<boolean>;
  isTokenStored(): Promise<boolean>;
  validateStoredToken(): Promise<TokenValidationResult>;
}

// Authentication credentials for login
export interface AuthCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

// Enhanced user interface with authentication metadata
export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  serverUrl: string;
  lastLoginAt: string;
  tokenExpiresAt: string;
}

// Authentication state for Redux store
export interface AuthState {
  user: AuthenticatedUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  lastTokenRefresh?: string;
}

// Login response from Readeck API
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  expiresIn: number;
}

// Token refresh response
export interface TokenRefreshResponse {
  token: string;
  expiresIn: number;
}