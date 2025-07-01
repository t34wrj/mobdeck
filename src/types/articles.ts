/**
 * Articles API type definitions
 * Comprehensive typing for article operations and state management
 */

import { Article, PaginatedResponse } from './index';

// API Service interfaces
export interface IArticlesApiService {
  fetchArticles(
    params: FetchArticlesParams
  ): Promise<PaginatedResponse<Article>>;
  createArticle(params: CreateArticleParams): Promise<Article>;
  updateArticle(params: UpdateArticleParams): Promise<Article>;
  deleteArticle(params: DeleteArticleParams): Promise<void>;
  syncArticles(params: SyncArticlesParams): Promise<ArticleSyncResult>;
  getArticle(id: string): Promise<Article>;
  batchUpdateArticles(updates: BatchUpdateParams[]): Promise<Article[]>;
  batchDeleteArticles(ids: string[]): Promise<void>;
  getArticleStats(): Promise<ArticleStats>;
}

// Request parameters for article operations
export interface FetchArticlesParams {
  page?: number;
  limit?: number;
  searchQuery?: string;
  filters?: ArticleFilterOptions;
  forceRefresh?: boolean;
}

export interface CreateArticleParams {
  title: string;
  url: string;
  summary?: string;
  content?: string;
  tags?: string[];
}

export interface UpdateArticleParams {
  id: string;
  updates: Partial<Omit<Article, 'id' | 'createdAt' | 'updatedAt'>>;
}

export interface DeleteArticleParams {
  id: string;
  permanent?: boolean;
}

export interface SyncArticlesParams {
  fullSync?: boolean;
  articlesOnly?: boolean;
}

export interface BatchUpdateParams {
  id: string;
  updates: Partial<Article>;
}

// Filter and search options
export interface ArticleFilterOptions {
  isArchived?: boolean;
  isFavorite?: boolean;
  isRead?: boolean;
  tags?: string[];
  dateRange?: {
    from?: string;
    to?: string;
  };
  readTimeRange?: {
    min?: number;
    max?: number;
  };
}

export interface ArticleSearchOptions {
  query: string;
  searchFields?: ('title' | 'summary' | 'content' | 'tags')[];
  matchMode?: 'exact' | 'partial' | 'fuzzy';
  caseSensitive?: boolean;
}

// Response types
export interface ArticleSyncResult {
  syncedCount: number;
  conflictCount: number;
  lastSyncTime?: string;
  errors?: ArticleSyncError[];
}

export interface ArticleStats {
  total: number;
  read: number;
  favorite: number;
  archived: number;
  unread: number;
  recentlyAdded: number;
  averageReadTime?: number;
  topTags?: TagStat[];
}

export interface TagStat {
  tag: string;
  count: number;
}

// Error types specific to article operations
export interface ArticleApiError {
  code: ArticleErrorCode;
  message: string;
  articleId?: string;
  statusCode?: number;
  details?: any;
  retryable: boolean;
  timestamp: string;
}

export enum ArticleErrorCode {
  ARTICLE_NOT_FOUND = 'ARTICLE_NOT_FOUND',
  INVALID_URL = 'INVALID_URL',
  FETCH_FAILED = 'FETCH_FAILED',
  DUPLICATE_ARTICLE = 'DUPLICATE_ARTICLE',
  INVALID_UPDATE = 'INVALID_UPDATE',
  DELETE_FAILED = 'DELETE_FAILED',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  OFFLINE_ERROR = 'OFFLINE_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNKNOWN_ARTICLE_ERROR = 'UNKNOWN_ARTICLE_ERROR',
}

export interface ArticleSyncError {
  articleId: string;
  error: ArticleApiError;
  conflictData?: {
    local: Partial<Article>;
    remote: Partial<Article>;
  };
}

// Optimistic update types
export interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  timestamp: string;
  originalData?: Article;
  pendingData?: Partial<Article>;
  status: 'pending' | 'success' | 'failed';
  error?: ArticleApiError;
}

// Bulk operations
export interface BulkOperationRequest {
  operation:
    | 'archive'
    | 'unarchive'
    | 'favorite'
    | 'unfavorite'
    | 'read'
    | 'unread'
    | 'delete';
  articleIds: string[];
  options?: {
    permanent?: boolean; // for delete operation
    tags?: string[]; // for tagging operations
  };
}

export interface BulkOperationResult {
  successful: string[];
  failed: Array<{
    articleId: string;
    error: ArticleApiError;
  }>;
  totalProcessed: number;
}

// Content extraction and processing
export interface ArticleContentMetadata {
  wordCount: number;
  readingTime: number;
  language?: string;
  primaryImage?: string;
  excerpt?: string;
  publishedDate?: string;
  author?: string;
  siteName?: string;
}

export interface ContentExtractionResult {
  title: string;
  content: string;
  summary: string;
  metadata: ArticleContentMetadata;
  success: boolean;
  error?: string;
}

// Cache and offline types
export interface ArticleCacheEntry {
  article: Article;
  cachedAt: string;
  expiresAt?: string;
  accessCount: number;
  lastAccessed: string;
  priority: 'high' | 'normal' | 'low';
}

export interface OfflineQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete' | 'sync';
  payload: any;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: ArticleApiError;
}

// Export and import types
export interface ArticleExportOptions {
  format: 'json' | 'csv' | 'html' | 'epub' | 'pdf';
  includeContent: boolean;
  includeMetadata: boolean;
  filters?: ArticleFilterOptions;
  dateRange?: {
    from: string;
    to: string;
  };
}

export interface ArticleExportResult {
  success: boolean;
  filePath?: string;
  downloadUrl?: string;
  fileSize?: number;
  articleCount: number;
  error?: string;
}

export interface ArticleImportOptions {
  source: 'json' | 'csv' | 'opml' | 'bookmarks' | 'pocket' | 'instapaper';
  filePath?: string;
  data?: any;
  options?: {
    skipDuplicates?: boolean;
    autoTag?: string[];
    markAsRead?: boolean;
    importContent?: boolean;
  };
}

export interface ArticleImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors?: Array<{
    item: any;
    error: string;
  }>;
}

// Validation types
export interface ArticleValidationRules {
  title: {
    required: boolean;
    minLength?: number;
    maxLength?: number;
  };
  url: {
    required: boolean;
    validProtocols?: string[];
    allowedDomains?: string[];
    blockedDomains?: string[];
  };
  tags: {
    maxCount?: number;
    maxLength?: number;
    allowedCharacters?: RegExp;
  };
  content: {
    maxLength?: number;
  };
}

export interface ArticleValidationResult {
  valid: boolean;
  errors: Array<{
    field: keyof Article;
    message: string;
    code: string;
  }>;
  warnings?: Array<{
    field: keyof Article;
    message: string;
    code: string;
  }>;
}

// Service configuration
export interface ArticlesServiceConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  cacheSize: number;
  cacheTTL: number;
  offlineQueueSize: number;
  syncInterval: number;
  contentExtractionTimeout: number;
  batchSize: number;
}

// Hooks and component types for React integration
export interface UseArticlesOptions {
  page?: number;
  limit?: number;
  filters?: ArticleFilterOptions;
  search?: ArticleSearchOptions;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseArticlesResult {
  articles: Article[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
    hasMore: boolean;
  };
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseArticleResult {
  article: Article | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  update: (updates: Partial<Article>) => Promise<void>;
  delete: () => Promise<void>;
}

// Advanced search and filtering
export interface ArticleSearchFilters extends ArticleFilterOptions {
  search?: ArticleSearchOptions;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'readTime' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  groupBy?: 'none' | 'tags' | 'date' | 'readStatus' | 'source';
}

export interface SearchResultGroup {
  key: string;
  label: string;
  articles: Article[];
  count: number;
}

export interface GroupedSearchResult {
  groups: SearchResultGroup[];
  totalCount: number;
  searchQuery: string;
  appliedFilters: ArticleSearchFilters;
  executionTime: number;
}

// Analytics and metrics
export interface ArticleMetrics {
  readingSpeed: number; // words per minute
  completionRate: number; // percentage of articles read to completion
  favoriteRate: number; // percentage of articles marked as favorite
  archiveRate: number; // percentage of articles archived
  averageSessionTime: number; // minutes spent reading
  topReadingTimes: string[]; // preferred reading hours
  deviceUsage: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

export interface ReadingSession {
  articleId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  progress: number; // percentage read (0-100)
  scrollPosition: number;
  device: 'mobile' | 'tablet' | 'desktop';
  completed: boolean;
}

// Real-time updates and websocket types
export interface ArticleUpdateEvent {
  type: 'created' | 'updated' | 'deleted' | 'archived' | 'favorited';
  articleId: string;
  article?: Article;
  changes?: Partial<Article>;
  timestamp: string;
  userId: string;
}

export interface SyncStatusEvent {
  type: 'sync_started' | 'sync_progress' | 'sync_completed' | 'sync_failed';
  progress?: number;
  totalItems?: number;
  currentItem?: number;
  error?: ArticleApiError;
  timestamp: string;
}

// Type guards and utility types
export type ArticleField = keyof Article;
export type RequiredArticleFields =
  | 'id'
  | 'title'
  | 'url'
  | 'createdAt'
  | 'updatedAt';
export type OptionalArticleFields = Exclude<
  ArticleField,
  RequiredArticleFields
>;

export interface CreateArticleDTO extends Pick<Article, 'title' | 'url'> {
  summary?: string;
  content?: string;
  tags?: string[];
  isFavorite?: boolean;
}

export interface UpdateArticleDTO
  extends Partial<Omit<Article, RequiredArticleFields>> {}

// Re-export commonly used types from main types file
export type { Article, PaginatedResponse, ApiResponse } from './index';
