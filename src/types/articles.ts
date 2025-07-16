// Article Types - Essential Mobile Client Operations
import { Article, PaginatedResponse } from './index';

export interface ArticleFilters {
  isArchived?: boolean;
  isFavorite?: boolean;
  isRead?: boolean;
  tags?: string[];
  searchQuery?: string;
  page?: number;
  limit?: number;
}

export interface CreateArticleRequest {
  url: string;
  title?: string;
  tags?: string[];
}

export interface UpdateArticleRequest {
  id: string;
  title?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
  isRead?: boolean;
  tags?: string[];
  readProgress?: number;
}

export interface ArticleResponse extends PaginatedResponse<Article> {}

export interface ArticleStats {
  total: number;
  read: number;
  favorite: number;
  archived: number;
}

export interface SyncResult {
  success: boolean;
  articlesUpdated: number;
  error?: string;
}

export enum ArticleErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  INVALID_URL = 'INVALID_URL',
  FETCH_FAILED = 'FETCH_FAILED',
  SYNC_ERROR = 'SYNC_ERROR',
}
