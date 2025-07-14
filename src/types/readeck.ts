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
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Generic API response wrapper
export interface ReadeckApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  timestamp: string;
}

// Readeck Bookmark/Article types - Updated to match API documentation
export interface ReadeckArticle {
  id: string;                    // Bookmark's ID
  title: string;                 // Bookmark's title
  description?: string;          // Bookmark's short description
  url: string;                   // Bookmark's original URL
  site?: string;                 // Bookmark's site host name
  site_name?: string;           // Bookmark's site name
  authors?: string[];           // Author list
  lang?: string;                // Language Code
  type: 'article' | 'photo' | 'video';  // The bookmark type
  document_type?: string;       // The bookmark document type
  has_article: boolean;         // Indicates whether the bookmarks contains an article
  loaded: boolean;              // Becomes true when the bookmark is ready
  state: 0 | 1 | 2;            // 0: loaded, 1: error, 2: loading
  is_archived: boolean;         // true when the bookmark is in the archives
  is_marked: boolean;           // true when the bookmark is in the favorites
  is_deleted: boolean;          // true when the bookmark is scheduled for deletion
  labels?: string[];            // Bookmark's labels
  published?: string | null;    // Publication date. Can be null when unknown
  reading_time?: number;        // Duration of the article, in minutes
  read_progress: number;        // Reading progress percentage (0-100)
  word_count?: number;          // Number of words in the article
  text_direction?: 'rtl' | 'ltr'; // Direction of the article's text
  created: string;              // Creation date
  updated: string;              // Last update
  resources?: {                 // Resources associated with the bookmark
    article?: {
      src: string;              // URL of the article resource
    };
    icon?: {
      src: string;              // URL of the icon resource
      height?: number;
      width?: number;
    };
    image?: {
      src: string;              // URL of the image resource
      height?: number;
      width?: number;
    };
    thumbnail?: {
      src: string;              // URL of the thumbnail resource
      height?: number;
      width?: number;
    };
    log?: {
      src: string;              // URL of the log resource
    };
    props?: {
      src: string;              // URL of the props resource
    };
  };
  links?: Array<{               // Links collected in the article
    content_type: string;       // MIME type of the destination
    domain: string;             // Link's domain
    is_page: boolean;           // true when the destination is a web page
    title: string;              // Link's title
    url: string;                // Link URI
  }>;
  read_anchor?: string;         // CSS selector of the last seen element
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

// Article operations - Updated to match API documentation
export interface CreateArticleRequest {
  url: string;           // Required - URL to fetch
  title?: string;        // Optional - Title of the bookmark
  labels?: string[];     // Optional - List of labels to set to the bookmark
}

export interface UpdateArticleRequest {
  title?: string;                // New bookmark's title
  is_archived?: boolean;         // Archive state
  is_deleted?: boolean;          // If true, schedules for deletion, otherwise cancels deletion
  is_marked?: boolean;           // Favorite state
  labels?: string[];             // Replaces the bookmark's labels
  add_labels?: string[];         // Add the given labels to the bookmark
  remove_labels?: string[];      // Remove the given labels from the bookmark
  read_anchor?: string;          // CSS selector of the last seen element
  read_progress?: number;        // Reading progress percentage (0-100)
}

export interface ArticleFilters {
  limit?: number;                // Number of items per page
  offset?: number;               // Pagination offset
  sort?: string[];               // Sorting parameters: created, -created, domain, -domain, duration, -duration, published, -published, site, -site, title, -title
  search?: string;               // A full text search string
  title?: string;                // Bookmark title
  author?: string;               // Author's name
  site?: string;                 // Bookmark site name or domain
  type?: ('article' | 'photo' | 'video')[]; // Bookmark type
  labels?: string;               // One or several labels
  is_loaded?: boolean;           // Filter by loaded state
  has_errors?: boolean;          // Filter bookmarks with or without errors
  has_labels?: boolean;          // Filter bookmarks with or without labels
  is_marked?: boolean;           // Filter by marked (favorite) status
  is_archived?: boolean;         // Filter by archived status
  range_start?: string;          // Date range start
  range_end?: string;            // Date range end
  read_status?: ('unread' | 'reading' | 'read')[]; // Read progress status
  updated_since?: string;        // Retrieve bookmarks created after this date (date-time)
  id?: string;                   // One or more bookmark ID
  collection?: string;           // A collection ID
}

// Authentication types - Updated to match Readeck API documentation
export interface ReadeckLoginRequest {
  username: string;
  password: string;
}

export interface ReadeckAuthRequest {
  application: string;  // Required - Application name
  username: string;     // Required - Username  
  password: string;     // Required - Password
  roles?: string[];     // Optional - List of roles to restrict token access
}

export interface ReadeckLoginResponse {
  id: string;      // Token ID
  token: string;   // Authentication token - store this value
}

// User profile types - Updated to match Readeck API documentation
export interface ReadeckUser {
  id: string;
  username: string;
  email: string;
  created: string;    // Changed from created_at to match API
  updated: string;    // Changed from updated_at to match API
}

export interface ReadeckUserProfile {
  id?: string;             // Optional user ID for tests
  provider: {
    application: string;      // Registered application name
    id: string;              // Authentication provider ID (token ID)
    name: string;            // Provider name
    permissions: string[];   // Permissions granted for this session
    roles: string[];         // Roles granted for this session
  };
  user: {
    created: string;         // Creation date
    email: string;           // User email
    username: string;        // Username
    updated: string;         // Last update date
    settings: {
      debug_info: boolean;   // Enable debug information
    };
    reader_settings: {
      font: string;          // Font setting
      font_size: number;     // Font size
      line_height: number;   // Line height
    };
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
  last_sync?: string;
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
