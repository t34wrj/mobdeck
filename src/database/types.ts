// Database Entity Types for SQLite Storage
// These types map directly to the database schema

export interface DBArticle {
  id: string;
  title: string;
  summary: string | null;
  content: string | null;
  url: string;
  image_url: string | null;
  read_time: number | null;
  is_archived: number; // SQLite boolean (0/1)
  is_favorite: number; // SQLite boolean (0/1)
  is_read: number; // SQLite boolean (0/1)
  source_url: string | null;
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  synced_at: number | null; // Unix timestamp
  is_modified: number; // SQLite boolean (0/1)
  deleted_at: number | null; // Unix timestamp for soft delete
}

export interface DBLabel {
  id: number;
  name: string;
  color: string | null;
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  synced_at: number | null; // Unix timestamp
}

export interface DBArticleLabel {
  article_id: string;
  label_id: number;
  created_at: number; // Unix timestamp
}

export interface DBSyncMetadata {
  id: number;
  entity_type: 'article' | 'label' | 'article_label';
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  local_timestamp: number;
  server_timestamp: number | null;
  sync_status: 'pending' | 'syncing' | 'completed' | 'failed';
  conflict_resolution: 'local_wins' | 'server_wins' | 'merged' | null;
  retry_count: number;
  error_message: string | null;
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
}

export interface DBSchemaVersion {
  version: number;
  applied_at: number; // Unix timestamp
  description: string | null;
}

// Query result types
export interface ArticleQueryResult {
  rows: {
    length: number;
    item: (index: number) => DBArticle;
  };
}

export interface LabelQueryResult {
  rows: {
    length: number;
    item: (index: number) => DBLabel;
  };
}

// Database operation types
export interface InsertArticleParams {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  url: string;
  image_url?: string;
  read_time?: number;
  is_archived?: boolean;
  is_favorite?: boolean;
  is_read?: boolean;
  source_url?: string;
  created_at?: number;
  updated_at?: number;
}

export interface UpdateArticleParams {
  id: string;
  title?: string;
  summary?: string;
  content?: string;
  url?: string;
  image_url?: string;
  read_time?: number;
  is_archived?: boolean;
  is_favorite?: boolean;
  is_read?: boolean;
  source_url?: string;
  updated_at?: number;
}

export interface ArticleFilters {
  is_archived?: boolean;
  is_favorite?: boolean;
  is_read?: boolean;
  labels?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'ASC' | 'DESC';
}

// Utility types for conversion between DB and App types
export interface ArticleConversionUtils {
  dbToApp: (dbArticle: DBArticle) => import('../types').Article;
  appToDb: (article: import('../types').Article) => DBArticle;
  boolToInt: (value: boolean) => number;
  intToBool: (value: number) => boolean;
  timestampToDate: (timestamp: number) => string;
  dateToTimestamp: (date: string) => number;
}

// Sync operation types
export interface SyncOperation {
  entity_type: DBSyncMetadata['entity_type'];
  entity_id: string;
  operation: DBSyncMetadata['operation'];
  data?: any;
}

export interface BatchSyncParams {
  operations: SyncOperation[];
  conflict_resolution?: DBSyncMetadata['conflict_resolution'];
}

// Database statistics
export interface DatabaseStats {
  articles_count: number;
  labels_count: number;
  pending_sync_count: number;
  failed_sync_count: number;
  last_sync_time: number | null;
  db_size_mb?: number;
}

// Error types specific to database operations
export interface DatabaseError {
  code:
    | 'CONSTRAINT_VIOLATION'
    | 'TABLE_NOT_FOUND'
    | 'SYNTAX_ERROR'
    | 'CONNECTION_ERROR';
  message: string;
  sql?: string;
  params?: any[];
  originalError?: any;
}
