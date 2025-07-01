/**
 * Readeck API type definitions
 * Comprehensive typing for Readeck REST API client operations
 */

// Base API configuration
export interface ReadeckApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

// API Error types
export interface ReadeckApiError {
  code: ReadeckErrorCode;
  message: string;
  statusCode?: number;
  details?: string;
  retryable: boolean;
  timestamp: string;
}

export enum ReadeckErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Generic API response wrapper
export interface ReadeckApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  timestamp: string;
}

// Readeck Article types
export interface ReadeckArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  image_url?: string;
  read_time?: number;
  is_archived: boolean;
  is_favorite: boolean;
  is_read: boolean;
  tags?: string[];
  source_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ReadeckArticleList {
  articles: ReadeckArticle[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
  };
}

// Article operations
export interface CreateArticleRequest {
  url: string;
  title?: string;
  tags?: string[];
  is_favorite?: boolean;
}

export interface UpdateArticleRequest {
  title?: string;
  is_archived?: boolean;
  is_favorite?: boolean;
  is_read?: boolean;
  tags?: string[];
}

export interface ArticleFilters {
  page?: number;
  per_page?: number;
  is_archived?: boolean;
  is_favorite?: boolean;
  is_read?: boolean;
  tags?: string[];
  search?: string;
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
}

// Authentication types
export interface ReadeckLoginRequest {
  username: string;
  password: string;
}

export interface ReadeckLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: ReadeckUser;
}

export interface ReadeckUser {
  id: string;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// User profile and settings
export interface ReadeckUserProfile {
  id: string;
  username: string;
  email: string;
  preferences: {
    theme: string;
    articles_per_page: number;
    auto_archive_read: boolean;
  };
  stats: {
    total_articles: number;
    read_articles: number;
    favorite_articles: number;
    archived_articles: number;
  };
}

// System information
export interface ReadeckSystemInfo {
  version: string;
  api_version: string;
  uptime: number;
  articles_count: number;
  users_count: number;
}

// Sync related types
export interface ReadeckSyncResponse {
  articles: ReadeckArticle[];
  last_updated: string;
  total_count: number;
  has_more: boolean;
}

export interface SyncRequest {
  since?: string;
  limit?: number;
  include_deleted?: boolean;
}

// Request configuration
export interface RequestConfig {
  timeout?: number;
  retryAttempts?: number;
  skipAuth?: boolean;
  skipRetry?: boolean;
}

// Network connectivity state
export interface NetworkState {
  isConnected: boolean;
  isWifiEnabled: boolean;
  isCellularEnabled: boolean;
  networkType: 'wifi' | 'cellular' | 'unknown' | 'none';
}

// Retry configuration
export interface RetryConfig {
  attempts: number;
  delay: number;
  backoffMultiplier: number;
  maxDelay: number;
  retryableStatusCodes: number[];
  retryableErrorCodes: ReadeckErrorCode[];
}

// Service interface for dependency injection
export interface IReadeckApiService {
  // Authentication
  login(
    credentials: ReadeckLoginRequest
  ): Promise<ReadeckApiResponse<ReadeckLoginResponse>>;
  validateToken(): Promise<ReadeckApiResponse<ReadeckUser>>;
  refreshToken(): Promise<ReadeckApiResponse<ReadeckLoginResponse>>;

  // Articles
  getArticles(
    filters?: ArticleFilters
  ): Promise<ReadeckApiResponse<ReadeckArticleList>>;
  getArticle(id: string): Promise<ReadeckApiResponse<ReadeckArticle>>;
  createArticle(
    article: CreateArticleRequest
  ): Promise<ReadeckApiResponse<ReadeckArticle>>;
  updateArticle(
    id: string,
    updates: UpdateArticleRequest
  ): Promise<ReadeckApiResponse<ReadeckArticle>>;
  deleteArticle(id: string): Promise<ReadeckApiResponse<void>>;

  // User
  getUserProfile(): Promise<ReadeckApiResponse<ReadeckUserProfile>>;
  updateUserProfile(
    updates: Partial<ReadeckUserProfile>
  ): Promise<ReadeckApiResponse<ReadeckUserProfile>>;

  // System
  getSystemInfo(): Promise<ReadeckApiResponse<ReadeckSystemInfo>>;

  // Sync
  syncArticles(
    request?: SyncRequest
  ): Promise<ReadeckApiResponse<ReadeckSyncResponse>>;

  // Configuration
  updateConfig(config: Partial<ReadeckApiConfig>): void;
  getNetworkState(): NetworkState;
}

// HTTP method types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Request options
export interface ApiRequestOptions {
  method: HttpMethod;
  url: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  config?: RequestConfig;
}

// Response interceptor result
export interface InterceptorResult<T> {
  data: T;
  proceed: boolean;
  error?: ReadeckApiError;
}
