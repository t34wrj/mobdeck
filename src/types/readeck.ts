// Readeck API Types - Essential Client Operations
export interface ReadeckApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface ReadeckApiResponse<T> {
  data: T;
  status: number;
  timestamp: string;
  headers?: Record<string, string>;
  items?: T[];
  message?: string;
}

export interface ReadeckArticle {
  id: string;
  title: string;
  description?: string;
  url: string;
  site?: string;
  has_article: boolean;
  loaded: boolean;
  is_archived: boolean;
  is_marked: boolean;
  labels?: string[];
  published?: string;
  reading_time?: number;
  read_progress: number;
  created: string;
  updated: string;
  resources?: {
    article?: { src: string };
    image?: { src: string };
  };
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

export interface ReadeckLoginRequest {
  username: string;
  password: string;
}

export interface ReadeckLoginResponse {
  id: string;
  token: string;
}

export interface ReadeckUser {
  id: string;
  username: string;
  email: string;
  created: string;
  updated: string;
}

export interface CreateArticleRequest {
  url: string;
  title?: string;
  labels?: string[];
}

export interface UpdateArticleRequest {
  title?: string;
  is_archived?: boolean;
  is_marked?: boolean;
  labels?: string[];
  read_progress?: number;
}

export interface ArticleFilters {
  limit?: number;
  offset?: number;
  search?: string;
  is_archived?: boolean;
  is_marked?: boolean;
  labels?: string;
}

export enum ReadeckErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface IReadeckApiService {
  testConnection(): Promise<ReadeckApiResponse<any>>;
  login(
    credentials: ReadeckLoginRequest
  ): Promise<ReadeckApiResponse<ReadeckLoginResponse>>;
  getArticles(
    filters?: ArticleFilters
  ): Promise<ReadeckApiResponse<ReadeckArticleList>>;
  createArticle(
    request: CreateArticleRequest
  ): Promise<ReadeckApiResponse<ReadeckArticle>>;
  updateArticle(
    id: string,
    request: UpdateArticleRequest
  ): Promise<ReadeckApiResponse<ReadeckArticle>>;
  deleteArticle(id: string): Promise<ReadeckApiResponse<void>>;
}

export interface ReadeckApiError {
  code: ReadeckErrorCode;
  message: string;
  details?: any;
}

export interface ReadeckUserProfile {
  id: string;
  username: string;
  email: string;
  created: string;
  updated: string;
}

export interface ReadeckSystemInfo {
  version: string;
  name: string;
}

export interface ReadeckSyncResponse {
  success: boolean;
  message?: string;
}

export interface SyncRequest {
  articles?: ReadeckArticle[];
}

export interface RequestConfig {
  timeout?: number;
  retryAttempts?: number;
  headers?: Record<string, string>;
}

export interface NetworkState {
  isOnline: boolean;
  type: string;
}

export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoff: number;
}

export interface ApiRequestOptions {
  timeout?: number;
  retryAttempts?: number;
  headers?: Record<string, string>;
}
