/**
 * Database Type Definitions for Mobdeck SQLite Operations
 * Provides comprehensive TypeScript interfaces for all database entities and operations
 */

// Raw database row interfaces (matching SQLite schema exactly)
export interface DBArticle {
    id: string;
    title: string;
    summary: string | null;
    content: string | null;
    url: string;
    image_url: string | null;
    read_time: number | null;
    is_archived: number; // SQLite boolean as integer
    is_favorite: number; // SQLite boolean as integer
    is_read: number; // SQLite boolean as integer
    source_url: string | null;
    created_at: number; // Unix timestamp
    updated_at: number; // Unix timestamp
    synced_at: number | null; // Unix timestamp
    is_modified: number; // SQLite boolean as integer
    deleted_at: number | null; // Unix timestamp for soft deletes
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
    entity_type: string; // 'article', 'label', etc.
    entity_id: string;
    operation: string; // 'create', 'update', 'delete'
    local_timestamp: number; // Unix timestamp
    server_timestamp: number | null; // Unix timestamp
    sync_status: string; // 'pending', 'syncing', 'completed', 'failed'
    conflict_resolution: string | null; // 'local_wins', 'server_wins', 'merged'
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

// Database operation interfaces
export interface DatabaseConnection {
    executeSql: (sql: string, params?: any[]) => Promise<DatabaseResult>;
    transaction: (fn: (tx: DatabaseTransaction) => void) => Promise<void>;
    readTransaction: (fn: (tx: DatabaseTransaction) => void) => Promise<void>;
    close: () => Promise<void>;
}

export interface DatabaseTransaction {
    executeSql: (sql: string, params?: any[], success?: (tx: DatabaseTransaction, result: DatabaseResult) => void, error?: (tx: DatabaseTransaction, error: Error) => void) => void;
}

export interface DatabaseResult {
    rows: {
        length: number;
        item: (index: number) => any;
        raw: () => any[];
    };
    rowsAffected: number;
    insertId?: number;
}

// Query filter interfaces
export interface ArticleFilters {
    isArchived?: boolean;
    isFavorite?: boolean;
    isRead?: boolean;
    labelIds?: number[];
    searchQuery?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'created_at' | 'updated_at' | 'title';
    sortOrder?: 'ASC' | 'DESC';
}

export interface LabelFilters {
    searchQuery?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'name' | 'created_at';
    sortOrder?: 'ASC' | 'DESC';
}

export interface SyncMetadataFilters {
    entityType?: string;
    syncStatus?: string;
    operation?: string;
    limit?: number;
    offset?: number;
}

// Database operation result types
export interface DatabaseOperationResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    rowsAffected?: number;
    insertId?: number;
}

export interface PaginatedResult<T> {
    items: T[];
    totalCount: number;
    hasMore: boolean;
    limit: number;
    offset: number;
}

// Database statistics and health
export interface DatabaseStats {
    totalArticles: number;
    archivedArticles: number;
    favoriteArticles: number;
    unreadArticles: number;
    totalLabels: number;
    pendingSyncItems: number;
    databaseSize: number; // in bytes
    lastSyncAt: number | null;
}

// Transaction context for batch operations
export interface TransactionContext {
    executeSql: (sql: string, params?: any[]) => Promise<DatabaseResult>;
    rollback: () => void;
}

// Database migration interface
export interface Migration {
    version: number;
    description: string;
    up: (tx: DatabaseTransaction) => Promise<void>;
    down?: (tx: DatabaseTransaction) => Promise<void>;
}

// Database configuration
export interface DatabaseConfig {
    name: string;
    version: string;
    displayName: string;
    size: number;
    location?: string;
}

// Error types for database operations
export enum DatabaseErrorCode {
    CONNECTION_FAILED = 'CONNECTION_FAILED',
    QUERY_FAILED = 'QUERY_FAILED',
    TRANSACTION_FAILED = 'TRANSACTION_FAILED',
    MIGRATION_FAILED = 'MIGRATION_FAILED',
    CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
    NOT_FOUND = 'NOT_FOUND',
    DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface DatabaseError extends Error {
    code: DatabaseErrorCode;
    details?: any;
    query?: string;
    params?: any[];
}

// Service method interfaces for type safety
export interface DatabaseServiceInterface {
    // Connection management
    initialize(): Promise<void>;
    close(): Promise<void>;
    isConnected(): boolean;
    
    // Transaction management
    executeInTransaction<T>(operation: (ctx: TransactionContext) => Promise<T>): Promise<T>;
    
    // Article operations
    createArticle(article: Omit<DBArticle, 'created_at' | 'updated_at'>): Promise<DatabaseOperationResult<string>>;
    getArticle(id: string): Promise<DatabaseOperationResult<DBArticle>>;
    updateArticle(id: string, updates: Partial<DBArticle>): Promise<DatabaseOperationResult>;
    deleteArticle(id: string, softDelete?: boolean): Promise<DatabaseOperationResult>;
    getArticles(filters?: ArticleFilters): Promise<DatabaseOperationResult<PaginatedResult<DBArticle>>>;
    searchArticles(query: string, filters?: ArticleFilters): Promise<DatabaseOperationResult<PaginatedResult<DBArticle>>>;
    
    // Label operations
    createLabel(label: Omit<DBLabel, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseOperationResult<number>>;
    getLabel(id: number): Promise<DatabaseOperationResult<DBLabel>>;
    updateLabel(id: number, updates: Partial<DBLabel>): Promise<DatabaseOperationResult>;
    deleteLabel(id: number): Promise<DatabaseOperationResult>;
    getLabels(filters?: LabelFilters): Promise<DatabaseOperationResult<PaginatedResult<DBLabel>>>;
    
    // Article-Label relationship operations
    addLabelToArticle(articleId: string, labelId: number): Promise<DatabaseOperationResult>;
    removeLabelFromArticle(articleId: string, labelId: number): Promise<DatabaseOperationResult>;
    getArticleLabels(articleId: string): Promise<DatabaseOperationResult<DBLabel[]>>;
    getLabelArticles(labelId: number): Promise<DatabaseOperationResult<DBArticle[]>>;
    
    // Sync metadata operations
    createSyncMetadata(metadata: Omit<DBSyncMetadata, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseOperationResult<number>>;
    updateSyncMetadata(id: number, updates: Partial<DBSyncMetadata>): Promise<DatabaseOperationResult>;
    getSyncMetadata(filters?: SyncMetadataFilters): Promise<DatabaseOperationResult<PaginatedResult<DBSyncMetadata>>>;
    deleteSyncMetadata(id: number): Promise<DatabaseOperationResult>;
    
    // Utility operations
    getStats(): Promise<DatabaseOperationResult<DatabaseStats>>;
    vacuum(): Promise<DatabaseOperationResult>;
    backup(path: string): Promise<DatabaseOperationResult>;
    
    // Migration operations
    getCurrentVersion(): Promise<number>;
    runMigrations(migrations: Migration[]): Promise<DatabaseOperationResult>;
}

// Helper type for converting SQLite boolean integers to JavaScript booleans
export type BooleanFields<T> = {
    [K in keyof T]: T[K] extends number 
        ? K extends 'is_archived' | 'is_favorite' | 'is_read' | 'is_modified' 
            ? boolean 
            : T[K]
        : T[K];
};

// Converted article type with proper boolean fields
export type Article = BooleanFields<DBArticle> & {
    createdAt: Date;
    updatedAt: Date;
    syncedAt?: Date;
    deletedAt?: Date;
};

// Converted label type
export type Label = DBLabel & {
    createdAt: Date;
    updatedAt: Date;
    syncedAt?: Date;
};

// Helper functions type definitions
export interface DatabaseUtils {
    convertDBArticleToArticle(dbArticle: DBArticle): Article;
    convertArticleToDBArticle(article: Article): DBArticle;
    convertDBLabelToLabel(dbLabel: DBLabel): Label;
    convertLabelToDBLabel(label: Label): DBLabel;
    createTimestamp(): number;
    formatTimestamp(timestamp: number): Date;
}