// Authentication Types - Simplified for Mobile Client
export interface AuthToken {
  token: string;
  expiresAt: string;
  serverUrl: string;
}

export interface AuthCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface User {
  id: string;
  username: string;
  email: string;
  serverUrl: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  expiresIn: number;
}

export interface AuthStorageResult {
  success: boolean;
  error?: string;
}

export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  SERVER_UNREACHABLE = 'SERVER_UNREACHABLE',
  STORAGE_ERROR = 'STORAGE_ERROR',
}

export enum StorageErrorCode {
  STORAGE_FAILED = 'STORAGE_FAILED',
  RETRIEVAL_FAILED = 'RETRIEVAL_FAILED',
  DELETION_FAILED = 'DELETION_FAILED',
  USER_CANCELLED = 'USER_CANCELLED',
  BIOMETRIC_UNAVAILABLE = 'BIOMETRIC_UNAVAILABLE',
  KEYCHAIN_UNAVAILABLE = 'KEYCHAIN_UNAVAILABLE',
}

export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  expiresIn?: number;
  expiresAt?: string;
  error?: string;
}

export interface StorageError {
  code: StorageErrorCode;
  message: string;
  details: string;
  timestamp: string;
}

export interface IAuthStorageService {
  storeToken(token: string, user?: AuthenticatedUser): Promise<boolean>;
  retrieveToken(): Promise<string | null>;
  retrieveAuthData(): Promise<AuthToken | null>;
  deleteToken(): Promise<boolean>;
  isTokenStored(): Promise<boolean>;
  validateStoredToken(): Promise<TokenValidationResult>;
  enableBiometricAuth(): Promise<boolean>;
  disableBiometricAuth(): void;
  getSecurityConfig(): Promise<any>;
}

export interface KeychainOptions {
  service?: string;
  touchID?: boolean;
  showModal?: boolean;
  accessControl?: string;
  accessible?: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  serverUrl: string;
  lastLoginAt?: string;
  tokenExpiresAt?: string;
}