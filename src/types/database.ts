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
  created_at: number;
  updated_at: number;
  synced_at: number | null;
  is_modified: number;
}

export interface DBLabel {
  id: number;
  name: string;
  color: string | null;
  created_at: number;
  updated_at: number;
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
  labelIds?: number[];
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DatabaseStats {
  totalArticles: number;
  totalLabels: number;
  storageUsed: number;
  lastSync: string | null;
}