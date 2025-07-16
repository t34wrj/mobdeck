// Database Types - Simple SQLite Operations
export interface DBArticle {
  id: string;
  title: string;
  summary: string | null;
  content: string | null;
  url: string;
  image_url: string | null;
  read_time: number | null;
  is_archived: number;
  is_favorite: number;
  is_read: number;
  source_url: string | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
  is_modified: number;
  deleted_at: number | null;
}

export interface DBLabel {
  id: number;
  name: string;
  color: string | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
}

export interface DBArticleLabel {
  article_id: string;
  label_id: number;
  created_at: number;
}

export interface ArticleFilters {
  isArchived?: boolean;
  isFavorite?: boolean;
  isRead?: boolean;
  isModified?: boolean;
  labelIds?: number[];
  searchQuery?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rowsAffected?: number;
  insertId?: number;
}

export interface DatabaseOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rowsAffected?: number;
}

export enum DatabaseErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  STORAGE_FAILED = 'STORAGE_FAILED',
}

export interface DatabaseStats {
  totalArticles: number;
  archivedArticles: number;
  favoriteArticles: number;
  unreadArticles: number;
  totalLabels: number;
  pendingSyncItems: number;
  databaseSize: number;
  lastSyncAt: number | null;
}