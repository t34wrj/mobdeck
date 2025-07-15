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