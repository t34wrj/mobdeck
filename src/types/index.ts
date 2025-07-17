// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Core Entity Types
export interface Article {
  id: string;
  title: string;
  summary?: string;
  content: string;
  contentUrl?: string;
  url: string;
  imageUrl?: string;
  readTime?: number;
  sourceUrl?: string;
  source?: string;
  publishedAt?: string;
  isArchived: boolean;
  isFavorite: boolean;
  isRead: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  syncedAt?: string | null;
  isModified?: boolean;
  deletedAt?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  serverUrl: string;
  tokenExpiresAt?: string;
}

export interface Label {
  id: string;
  name: string;
  color?: string;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export interface AuthCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface AuthToken {
  token: string;
  expiresAt: string;
  issuedAt?: string;
}

// Redux State Types
export interface ArticlesState {
  articles: Article[];
  loading: boolean;
  error: string | null;
  lastSync: string | null;
  searchQuery: string;
  filters: {
    isArchived?: boolean;
    isFavorite?: boolean;
    isRead?: boolean;
    tags?: string[];
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface SyncState {
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncError: string | null;
}

export interface RootState {
  articles: ArticlesState;
  auth: AuthState;
  sync: SyncState;
}

// Component Props Types
export interface SearchProps {
  value: string;
  placeholder?: string;
  onSearch: (query: string) => void;
  onChange: (query: string) => void;
  onClear?: () => void;
}

export interface ArticleCardProps {
  article: Article;
  onPress: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
  onToggleArchive?: () => void;
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Article: { articleId: string };
  Settings: undefined;
  Search: { query?: string };
};

export type TabParamList = {
  Articles: undefined;
  Favorites: undefined;
  Archive: undefined;
  Settings: undefined;
};

// Service Types
export interface SyncOptions {
  fullSync?: boolean;
  force?: boolean;
}

// Database Types
export interface DatabaseArticle
  extends Omit<Article, 'createdAt' | 'updatedAt' | 'syncedAt'> {
  created_at: number;
  updated_at: number;
  synced_at?: number;
}

export interface DBArticle extends DatabaseArticle {}

export interface DBLabel {
  id: string;
  name: string;
  color?: string;
  article_count: number;
  created_at: number;
  updated_at: number;
}

export interface DBSyncMetadata {
  id: string;
  entity_type: string;
  entity_id: string;
  last_sync: number;
  checksum: string;
  created_at: number;
  updated_at: number;
}

export interface DatabaseStats {
  articles_count: number;
  labels_count: number;
  pending_sync_count: number;
  failed_sync_count: number;
  last_sync_time: string | null;
  db_size?: number;
}

export interface DatabaseOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ArticleFilters {
  isArchived?: boolean;
  isFavorite?: boolean;
  isRead?: boolean;
  tags?: string[];
  searchQuery?: string;
}

// Error Types
export interface AppErrorInterface {
  code: string;
  message: string;
  details?: any;
}

export class AppError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

// Share Intent Types
export interface SharedData {
  text: string;
  subject?: string;
  timestamp: number;
}

export interface ShareModuleInterface {
  getSharedData(): Promise<SharedData | null>;
  clearSharedData(): Promise<boolean>;
}

// Re-export all auth types
export type {
  TokenValidationResult,
  StorageError,
  IAuthStorageService,
  KeychainOptions,
  AuthenticatedUser,
} from './auth';

export { AuthErrorCode, StorageErrorCode } from './auth';

// Re-export all sync types
export type {
  SyncConfiguration,
  SyncProgress,
  SyncConflict,
  SyncStats,
  StartSyncPayload,
  SyncProgressPayload,
  SyncSuccessPayload,
  SyncErrorPayload,
  AddConflictPayload,
  ResolveConflictPayload,
  UpdateSyncConfigPayload,
  NetworkStatusPayload,
} from './sync';

export {
  SyncStatus,
  SyncPhase,
  ConflictType,
  ConflictResolutionStrategy,
  NetworkType,
} from './sync';
