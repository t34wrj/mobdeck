// API Response Types

/**
 * Generic API response wrapper
 * @template T - Type of the response data
 */
export interface ApiResponse<T> {
  /** Response payload data */
  data: T;
  /** Optional success message */
  message?: string;
  /** Optional error message */
  error?: string;
}

/**
 * Paginated API response for list endpoints
 * @template T - Type of individual items in the list
 */
export interface PaginatedResponse<T> {
  /** Array of items in the current page */
  items: T[];
  /** Current page number (1-based) */
  page: number;
  /** Total number of pages available */
  totalPages: number;
  /** Total number of items across all pages */
  totalItems: number;
}

// Entity Types

/**
 * Core Article entity representing a saved article/bookmark
 */
export interface Article {
  /** Unique identifier for the article */
  id: string;
  /** Article title */
  title: string;
  /** Brief summary or excerpt (can be null/undefined if not available) */
  summary?: string;
  /** Full article content */
  content: string;
  /** Original article URL */
  url: string;
  /** Optional featured image URL (can be null/undefined if not available) */
  imageUrl?: string;
  /** Estimated reading time in minutes (can be null/undefined if not calculated) */
  readTime?: number;
  /** Whether article is archived */
  isArchived: boolean;
  /** Whether article is marked as favorite */
  isFavorite: boolean;
  /** Whether article has been read */
  isRead: boolean;
  /** Optional array of tag strings */
  tags?: string[];
  /** Original source URL if different from url (can be null/undefined) */
  sourceUrl?: string;
  /** ISO timestamp when article was created */
  createdAt: string;
  /** ISO timestamp when article was last updated */
  updatedAt: string;
  /** ISO timestamp when article was last synced */
  syncedAt?: string;
  /** URL to fetch full article content */
  contentUrl?: string;
  /** Flag to track local modifications for sync */
  isModified?: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  serverUrl: string;
}

export interface AuthCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface AuthToken {
  token: string;
  expiresAt: string;
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
  pendingChanges: number;
}

export interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  syncInterval: number; // in minutes
  syncOnWifiOnly: boolean;
  offlineMode: boolean;
  articleCacheSize: number;
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: string;
}

export interface RootState {
  articles: ArticlesState;
  auth: AuthState;
  sync: SyncState;
  settings: SettingsState;
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
  articlesOnly?: boolean;
  force?: boolean;
}

export interface DatabaseArticle
  extends Omit<Article, 'createdAt' | 'updatedAt' | 'syncedAt'> {
  created_at: number;
  updated_at: number;
  synced_at?: number;
}

// Enhanced database types (re-export from database module)
export type {
  DBArticle,
  DBLabel,
  DBArticleLabel,
  DBSyncMetadata,
  ArticleFilters,
  DatabaseStats,
} from '../database/types';

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
}

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncAction<T> = {
  pending: boolean;
  error: string | null;
  data: T | null;
};

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
