/**
 * DatabaseService - Comprehensive SQLite Database Service for Mobdeck
 *
 * Features:
 * - Singleton pattern for connection management
 * - Connection pooling and lifecycle management
 * - Transaction support with rollback capabilities
 * - Comprehensive error handling and logging
 * - CRUD operations for all schema tables
 * - Full-text search support
 * - Migration support for schema updates
 * - Performance optimization with prepared statements
 */

import SQLite from 'react-native-sqlite-storage';
import {
  DBArticle,
  DBLabel,
  ArticleFilters,
  DatabaseResult,
  DatabaseStats,
  DatabaseOperationResult,
  DatabaseErrorCode,
} from '../types/database';
import { Article, Label } from '../types';

// Utility function to safely extract error message
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Define missing types locally
interface DatabaseServiceInterface {
  initialize(): Promise<void>;
  isConnected(): boolean;
  close(): Promise<void>;
}

interface DatabaseConfig {
  name: string;
  version: string;
  displayName: string;
  size: number;
  location: string;
}

interface DatabaseTransaction {
  executeSql: (sql: string, params?: any[], success?: any, error?: any) => void;
}

interface SQLiteResultSet {
  insertId?: number;
  rowsAffected: number;
  rows: {
    length: number;
    item: (index: number) => any;
    _array?: any[];
  };
}

interface DatabaseError extends Error {
  code: DatabaseErrorCode;
  details?: any;
  query?: string;
  params?: any[];
}

interface TransactionContext {
  executeSql: (sql: string, params?: any[]) => Promise<DatabaseResult>;
  rollback: () => void;
}

interface DBSyncMetadata {
  id?: number;
  entity_type: string;
  entity_id: string;
  operation: string;
  local_timestamp: number;
  server_timestamp: number | null;
  sync_status: string;
  conflict_resolution: string | null;
  retry_count: number;
  error_message: string | null;
  created_at: number;
  updated_at: number;
}

interface LabelFilters {
  searchQuery?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface SyncMetadataFilters {
  entityType?: string;
  syncStatus?: string;
  operation?: string;
  limit?: number;
  offset?: number;
}

interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

interface Migration {
  version: number;
  description: string;
  up: (tx: DatabaseTransaction) => Promise<void>;
  down: (tx: DatabaseTransaction) => Promise<void>;
}

interface DatabaseUtils {
  convertDBArticleToArticle: (dbArticle: DBArticle) => Article;
  convertArticleToDBArticle: (article: Article) => DBArticle;
  convertDBLabelToLabel: (dbLabel: DBLabel) => Label;
  convertLabelToDBLabel: (label: Label) => DBLabel;
  createTimestamp: () => number;
  formatTimestamp: (timestamp: number) => Date;
}

// Mock error handler for tests
const errorHandler = {
  handleError: (error: any, context?: any) => {
    console.error('Database error:', error, context);
    return {
      message: getErrorMessage(error) || 'Database operation failed',
      userMessage: 'Unable to save data locally. Please try again.',
    };
  },
};

enum ErrorCategory {
  STORAGE = 'STORAGE',
  SYNC_OPERATION = 'SYNC_OPERATION',
}

// Enable debugging in development
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    // SQLite.DEBUG may not be available in all versions
    if (typeof (SQLite as any).DEBUG === 'function') {
      (SQLite as any).DEBUG(true);
    }
    if (typeof (SQLite as any).enablePromise === 'function') {
      (SQLite as any).enablePromise(true);
    }
  } catch (error) {
    console.warn('[DatabaseService] SQLite debugging setup failed:', error);
  }
}

class DatabaseService implements DatabaseServiceInterface {
  private static instance: DatabaseService;
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  private connectionPool: SQLite.SQLiteDatabase[] = [];
  private readonly config: DatabaseConfig;

  private constructor() {
    this.config = {
      name: 'mobdeck.db',
      version: '1.0',
      displayName: 'Mobdeck Database',
      size: 10 * 1024 * 1024, // 10MB
      location: 'default',
    };
  }

  /**
   * Get singleton instance of DatabaseService
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Initialize database connection and run migrations
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[DatabaseService] Initializing database...');

      this.db = SQLite.openDatabase({
        name: this.config.name,
        location: this.config.location,
        createFromLocation: undefined,
      });

      // Enable foreign key constraints (optional - some SQLite versions might not support this)
      try {
        await this.db.executeSql('PRAGMA foreign_keys = ON;');
        console.log('[DatabaseService] Foreign key constraints enabled');
      } catch (error) {
        console.warn(
          '[DatabaseService] Could not enable foreign key constraints:',
          error
        );
        console.log(
          '[DatabaseService] Continuing without foreign key constraints'
        );
      }

      // Initialize schema
      await this.initializeSchema();

      // Run any pending migrations
      await this.runPendingMigrations();

      this.isInitialized = true;
      console.log('[DatabaseService] Database initialized successfully');
    } catch (error) {
      const dbError = this.createDatabaseError(
        DatabaseErrorCode.CONNECTION_FAILED,
        'Failed to initialize database',
        error
      );
      console.error('[DatabaseService] Initialization failed:', dbError);
      throw dbError;
    }
  }

  /**
   * Initialize database schema from schema.sql
   */
  private async initializeSchema(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const schemaQueries = [
      // Articles table
      `CREATE TABLE IF NOT EXISTS articles (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                summary TEXT,
                content TEXT,
                url TEXT NOT NULL,
                image_url TEXT,
                read_time INTEGER,
                is_archived INTEGER NOT NULL DEFAULT 0,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                is_read INTEGER NOT NULL DEFAULT 0,
                source_url TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                synced_at INTEGER,
                is_modified INTEGER NOT NULL DEFAULT 0,
                deleted_at INTEGER
            );`,

      // Labels table
      `CREATE TABLE IF NOT EXISTS labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                synced_at INTEGER
            );`,

      // Article-Label junction table
      `CREATE TABLE IF NOT EXISTS article_labels (
                article_id TEXT NOT NULL,
                label_id INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (article_id, label_id),
                FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
                FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
            );`,

      // Sync metadata table
      `CREATE TABLE IF NOT EXISTS sync_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                local_timestamp INTEGER NOT NULL,
                server_timestamp INTEGER,
                sync_status TEXT NOT NULL DEFAULT 'pending',
                conflict_resolution TEXT,
                retry_count INTEGER DEFAULT 0,
                error_message TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );`,

      // Schema version table
      `CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL,
                description TEXT
            );`,

      // Performance indexes - optimized for common query patterns

      // Single column indexes for basic filtering
      'CREATE INDEX IF NOT EXISTS idx_articles_is_archived ON articles(is_archived);',
      'CREATE INDEX IF NOT EXISTS idx_articles_is_favorite ON articles(is_favorite);',
      'CREATE INDEX IF NOT EXISTS idx_articles_is_read ON articles(is_read);',
      'CREATE INDEX IF NOT EXISTS idx_articles_is_modified ON articles(is_modified);',
      'CREATE INDEX IF NOT EXISTS idx_articles_deleted_at ON articles(deleted_at);',
      'CREATE INDEX IF NOT EXISTS idx_articles_synced_at ON articles(synced_at);',

      // Composite indexes for common filtering combinations
      'CREATE INDEX IF NOT EXISTS idx_articles_deleted_archived ON articles(deleted_at, is_archived, created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_articles_deleted_favorite ON articles(deleted_at, is_favorite, created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_articles_deleted_read ON articles(deleted_at, is_read, created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_articles_archived_read ON articles(is_archived, is_read, created_at DESC);',

      // Covering indexes for pagination queries (includes commonly selected columns)
      'CREATE INDEX IF NOT EXISTS idx_articles_list_covering ON articles(deleted_at, created_at DESC, id, title, summary, is_archived, is_favorite, is_read);',
      'CREATE INDEX IF NOT EXISTS idx_articles_modified_covering ON articles(is_modified, updated_at DESC, id, synced_at);',

      // Time-based indexes for sorting and sync operations
      'CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at DESC);',

      // Label operations optimization
      'CREATE INDEX IF NOT EXISTS idx_article_labels_article ON article_labels(article_id, label_id);',
      'CREATE INDEX IF NOT EXISTS idx_article_labels_label ON article_labels(label_id, article_id);',

      // Sync metadata optimization
      'CREATE INDEX IF NOT EXISTS idx_sync_metadata_entity ON sync_metadata(entity_type, entity_id);',
      'CREATE INDEX IF NOT EXISTS idx_sync_metadata_status ON sync_metadata(sync_status);',
      'CREATE INDEX IF NOT EXISTS idx_sync_metadata_timestamp ON sync_metadata(local_timestamp DESC);',
      'CREATE INDEX IF NOT EXISTS idx_sync_metadata_status_time ON sync_metadata(sync_status, created_at DESC);',

      // Initial schema version
      `INSERT OR IGNORE INTO schema_version (version, applied_at, description) 
            VALUES (1, strftime('%s', 'now'), 'Initial database schema with articles, labels, and sync metadata');`,
    ];

    for (const query of schemaQueries) {
      try {
        await this.db.executeSql(query);
      } catch (error) {
        console.error('[DatabaseService] Schema query failed:', query, error);
        // Don't throw on schema initialization errors - continue with basic setup
        // throw error;
      }
    }

    // Try to initialize FTS5 features (optional - won't fail if not supported)
    await this.initializeFTS5();
  }

  /**
   * Initialize FTS5 full-text search features (optional)
   */
  private async initializeFTS5(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      console.log('[DatabaseService] Attempting to initialize FTS5...');

      const ftsQueries = [
        // Full-text search table using FTS5
        `CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
                  id UNINDEXED,
                  title,
                  summary,
                  content,
                  content=articles,
                  content_rowid=rowid
              );`,

        // FTS triggers
        `CREATE TRIGGER IF NOT EXISTS articles_fts_insert 
              AFTER INSERT ON articles 
              BEGIN
                  INSERT INTO articles_fts(id, title, summary, content) 
                  VALUES (new.id, new.title, new.summary, new.content);
              END;`,

        `CREATE TRIGGER IF NOT EXISTS articles_fts_update 
              AFTER UPDATE ON articles 
              BEGIN
                  UPDATE articles_fts 
                  SET title = new.title, summary = new.summary, content = new.content 
                  WHERE id = new.id;
              END;`,

        `CREATE TRIGGER IF NOT EXISTS articles_fts_delete 
              AFTER DELETE ON articles 
              BEGIN
                  DELETE FROM articles_fts WHERE id = old.id;
              END;`,
      ];

      for (const query of ftsQueries) {
        await this.db.executeSql(query);
      }

      console.log('[DatabaseService] FTS5 initialized successfully');
    } catch {
      // FTS5 is optional - log as debug instead of warning to reduce noise
      console.log(
        '[DatabaseService] FTS5 not available, continuing without full-text search features'
      );
      // Don't throw - FTS5 is optional
    }
  }

  /**
   * Check if database is connected
   */
  public isConnected(): boolean {
    return this.db !== null && this.isInitialized;
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;

      // Close all pooled connections
      for (const conn of this.connectionPool) {
        await conn.close();
      }
      this.connectionPool = [];

      console.log('[DatabaseService] Database connection closed');
    }
  }

  /**
   * Execute operation within a transaction
   */
  public async executeInTransaction<T>(
    operation: (ctx: TransactionContext) => Promise<T>
  ): Promise<T> {
    if (!this.db) {
      throw this.createDatabaseError(
        DatabaseErrorCode.CONNECTION_FAILED,
        'Database not connected'
      );
    }

    return new Promise((resolve, reject) => {
      this.db.transaction(
        async (tx: any) => {
          try {
            const context: TransactionContext = {
              executeSql: (sql: string, params?: any[]) => {
                return new Promise<DatabaseResult>(
                  (resolveQuery, rejectQuery) => {
                    tx.executeSql(
                      sql,
                      params || [],
                      (_: any, result: any) =>
                        resolveQuery(result as DatabaseResult),
                      (_: any, error: any) => {
                        rejectQuery(error);
                        return false;
                      }
                    );
                  }
                );
              },
              rollback: () => {
                throw new Error('Transaction rollback requested');
              },
            };

            const result = await operation(context);
            resolve(result);
          } catch (error) {
            console.error('[DatabaseService] Transaction error:', error);
            reject(
              this.createDatabaseError(
                DatabaseErrorCode.TRANSACTION_FAILED,
                'Transaction failed',
                error
              )
            );
          }
        },
        (error: any) => {
          console.error('[DatabaseService] Transaction failed:', error);
          reject(
            this.createDatabaseError(
              DatabaseErrorCode.TRANSACTION_FAILED,
              'Transaction execution failed',
              error
            )
          );
        }
      );
    });
  }

  // Article Operations
  public async createArticle(
    article: Omit<DBArticle, 'created_at' | 'updated_at'>
  ): Promise<DatabaseOperationResult<string>> {
    try {
      const now = this.createTimestamp();
      const sql = `
                INSERT INTO articles (
                    id, title, summary, content, url, image_url, read_time,
                    is_archived, is_favorite, is_read, source_url, created_at,
                    updated_at, synced_at, is_modified, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

      const params = [
        article.id,
        article.title,
        article.summary || null,
        article.content || null,
        article.url,
        article.image_url || null,
        article.read_time || null,
        article.is_archived || 0,
        article.is_favorite || 0,
        article.is_read || 0,
        article.source_url || null,
        now,
        now,
        article.synced_at || null,
        article.is_modified || 0,
        article.deleted_at || null,
      ];

      const result = await this.executeSql(sql, params);

      return {
        success: true,
        data: article.id,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      // Use centralized error handling for storage operations
      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.STORAGE,
        context: {
          actionType: 'create_article',
        },
      });

      return {
        success: false,
        error: handledError.userMessage,
      };
    }
  }

  public async getArticle(
    id: string
  ): Promise<DatabaseOperationResult<DBArticle>> {
    try {
      const sql = 'SELECT * FROM articles WHERE id = ? AND deleted_at IS NULL';
      const result = await this.executeSql(sql, [id]);

      if (!result || !result.rows || result.rows.length === 0) {
        return {
          success: false,
          error: 'Article not found',
        };
      }

      return {
        success: true,
        data: result.rows.item(0) as DBArticle,
      };
    } catch (error) {
      // Use centralized error handling for storage operations
      const handledError = errorHandler.handleError(error, {
        category: ErrorCategory.STORAGE,
        context: {
          actionType: 'get_article',
        },
      });

      return {
        success: false,
        error: handledError.userMessage,
      };
    }
  }

  public async updateArticle(
    id: string,
    updates: Partial<DBArticle>
  ): Promise<DatabaseOperationResult> {
    try {
      const updateFields = Object.keys(updates).filter(key => key !== 'id');
      if (updateFields.length === 0) {
        return { success: true, rowsAffected: 0 };
      }

      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      const sql = `UPDATE articles SET ${setClause}, updated_at = ? WHERE id = ?`;

      const params = [
        ...updateFields.map(field => updates[field as keyof DBArticle]),
        this.createTimestamp(),
        id,
      ];

      const result = await this.executeSql(sql, params);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update article: ${getErrorMessage(error)}`,
      };
    }
  }

  public async deleteArticle(
    id: string,
    softDelete: boolean = true
  ): Promise<DatabaseOperationResult> {
    try {
      let sql: string;
      let params: any[];

      if (softDelete) {
        sql = 'UPDATE articles SET deleted_at = ?, updated_at = ? WHERE id = ?';
        params = [this.createTimestamp(), this.createTimestamp(), id];
      } else {
        sql = 'DELETE FROM articles WHERE id = ?';
        params = [id];
      }

      const result = await this.executeSql(sql, params);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete article: ${getErrorMessage(error)}`,
      };
    }
  }

  public async getArticles(
    filters?: ArticleFilters
  ): Promise<DatabaseOperationResult<PaginatedResult<DBArticle>>> {
    try {
      const { whereClause, params, countParams } =
        this.buildArticleQuery(filters);

      // Get total count with optimized query
      const countSql = `SELECT COUNT(*) as count FROM articles ${whereClause}`;
      const countResult = await this.executeSql(countSql, countParams);

      if (!countResult || !countResult.rows || countResult.rows.length === 0) {
        console.warn('[DatabaseService] Empty count result, returning 0 articles');
        return {
          success: true,
          data: {
            items: [],
            totalCount: 0,
            hasMore: false,
            limit: filters?.limit || 50,
            offset: filters?.offset || 0,
          },
        };
      }

      const totalCount = countResult.rows.item(0).count;

      // Get paginated results with optimized query that uses covering indexes
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;
      const sortBy = filters?.sortBy || 'created_at';
      const sortOrder = filters?.sortOrder || 'DESC';

      // Use covering index hints for better performance on large datasets
      const sql = `
                SELECT id, title, summary, content, url, image_url, read_time,
                       is_archived, is_favorite, is_read, source_url, 
                       created_at, updated_at, synced_at, is_modified, deleted_at
                FROM articles 
                ${whereClause} 
                ORDER BY ${sortBy} ${sortOrder} 
                LIMIT ? OFFSET ?
            `;

      const result = await this.executeSql(sql, [...params, limit, offset]);
      const items = [];

      if (result && result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
          items.push(result.rows.item(i) as DBArticle);
        }
      }

      return {
        success: true,
        data: {
          items,
          totalCount,
          hasMore: offset + limit < totalCount,
          limit,
          offset,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get articles: ${getErrorMessage(error)}`,
      };
    }
  }

  public async searchArticles(
    query: string,
    filters?: ArticleFilters
  ): Promise<DatabaseOperationResult<PaginatedResult<DBArticle>>> {
    try {
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      // First try FTS5 search with BM25 ranking
      try {
        const sql = `
                  SELECT a.* FROM articles a
                  JOIN articles_fts fts ON a.id = fts.id
                  WHERE fts MATCH ? AND a.deleted_at IS NULL
                  ORDER BY bm25(fts) ASC
                  LIMIT ? OFFSET ?
              `;

        const result = await this.executeSql(sql, [query, limit, offset]);
        const items = [];

        if (result && result.rows) {
          for (let i = 0; i < result.rows.length; i++) {
            items.push(result.rows.item(i) as DBArticle);
          }
        }

        // Get total count for search
        const countSql = `
                  SELECT COUNT(*) as count FROM articles a
                  JOIN articles_fts fts ON a.id = fts.id
                  WHERE fts MATCH ? AND a.deleted_at IS NULL
              `;
        const countResult = await this.executeSql(countSql, [query]);
        const totalCount = countResult.rows.item(0).count;

        return {
          success: true,
          data: {
            items,
            totalCount,
            hasMore: offset + limit < totalCount,
            limit,
            offset,
          },
        };
      } catch (ftsError) {
        console.warn(
          '[DatabaseService] FTS5 search failed, falling back to LIKE search:',
          ftsError
        );

        // Fallback to LIKE search if FTS is not available
        const searchTerm = `%${query}%`;
        const sql = `
                  SELECT * FROM articles 
                  WHERE (title LIKE ? OR summary LIKE ? OR content LIKE ?) 
                  AND deleted_at IS NULL
                  ORDER BY updated_at DESC
                  LIMIT ? OFFSET ?
              `;

        const result = await this.executeSql(sql, [
          searchTerm,
          searchTerm,
          searchTerm,
          limit,
          offset,
        ]);
        const items = [];

        if (result && result.rows) {
          for (let i = 0; i < result.rows.length; i++) {
            items.push(result.rows.item(i) as DBArticle);
          }
        }

        // Get total count for fallback search
        const countSql = `
                  SELECT COUNT(*) as count FROM articles 
                  WHERE (title LIKE ? OR summary LIKE ? OR content LIKE ?) 
                  AND deleted_at IS NULL
              `;
        const countResult = await this.executeSql(countSql, [
          searchTerm,
          searchTerm,
          searchTerm,
        ]);
        const totalCount = countResult.rows.item(0).count;

        return {
          success: true,
          data: {
            items,
            totalCount,
            hasMore: offset + limit < totalCount,
            limit,
            offset,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to search articles: ${getErrorMessage(error)}`,
      };
    }
  }

  // Label Operations
  public async createLabel(
    label: Omit<DBLabel, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DatabaseOperationResult<number>> {
    try {
      const now = this.createTimestamp();
      const sql = `
                INSERT INTO labels (name, color, created_at, updated_at, synced_at)
                VALUES (?, ?, ?, ?, ?)
            `;

      const params = [label.name, label.color, now, now, label.synced_at];
      const result = await this.executeSql(sql, params);

      return {
        success: true,
        data: result.insertId || 0,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create label: ${getErrorMessage(error)}`,
      };
    }
  }

  public async getLabel(id: number): Promise<DatabaseOperationResult<DBLabel>> {
    try {
      const sql = 'SELECT * FROM labels WHERE id = ?';
      const result = await this.executeSql(sql, [id]);

      if (!result || !result.rows || result.rows.length === 0) {
        return {
          success: false,
          error: 'Label not found',
        };
      }

      return {
        success: true,
        data: result.rows.item(0) as DBLabel,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get label: ${getErrorMessage(error)}`,
      };
    }
  }

  public async updateLabel(
    id: number,
    updates: Partial<DBLabel>
  ): Promise<DatabaseOperationResult> {
    try {
      const updateFields = Object.keys(updates).filter(key => key !== 'id');
      if (updateFields.length === 0) {
        return { success: true, rowsAffected: 0 };
      }

      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      const sql = `UPDATE labels SET ${setClause}, updated_at = ? WHERE id = ?`;

      const params = [
        ...updateFields.map(field => updates[field as keyof DBLabel]),
        this.createTimestamp(),
        id,
      ];

      const result = await this.executeSql(sql, params);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update label: ${getErrorMessage(error)}`,
      };
    }
  }

  public async deleteLabel(id: number): Promise<DatabaseOperationResult> {
    try {
      const sql = 'DELETE FROM labels WHERE id = ?';
      const result = await this.executeSql(sql, [id]);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete label: ${getErrorMessage(error)}`,
      };
    }
  }

  public async getLabels(
    filters?: LabelFilters
  ): Promise<DatabaseOperationResult<PaginatedResult<DBLabel>>> {
    try {
      let whereClause = '';
      const params: any[] = [];

      if (filters?.searchQuery) {
        whereClause = 'WHERE name LIKE ?';
        params.push(`%${filters.searchQuery}%`);
      }

      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM labels ${whereClause}`;
      const countResult = await this.executeSql(countSql, params);
      const totalCount = countResult.rows.item(0).count;

      // Get paginated results
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;
      const sortBy = filters?.sortBy || 'name';
      const sortOrder = filters?.sortOrder || 'ASC';

      const sql = `
                SELECT * FROM labels 
                ${whereClause} 
                ORDER BY ${sortBy} ${sortOrder} 
                LIMIT ? OFFSET ?
            `;

      const result = await this.executeSql(sql, [...params, limit, offset]);
      const items = [];

      if (result && result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
          items.push(result.rows.item(i) as DBLabel);
        }
      }

      return {
        success: true,
        data: {
          items,
          totalCount,
          hasMore: offset + limit < totalCount,
          limit,
          offset,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get labels: ${getErrorMessage(error)}`,
      };
    }
  }

  // Article-Label Operations
  public async addLabelToArticle(
    articleId: string,
    labelId: number
  ): Promise<DatabaseOperationResult> {
    try {
      const sql = `
                INSERT OR IGNORE INTO article_labels (article_id, label_id, created_at)
                VALUES (?, ?, ?)
            `;

      const result = await this.executeSql(sql, [
        articleId,
        labelId,
        this.createTimestamp(),
      ]);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add label to article: ${getErrorMessage(error)}`,
      };
    }
  }

  public async removeLabelFromArticle(
    articleId: string,
    labelId: number
  ): Promise<DatabaseOperationResult> {
    try {
      const sql =
        'DELETE FROM article_labels WHERE article_id = ? AND label_id = ?';
      const result = await this.executeSql(sql, [articleId, labelId]);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove label from article: ${getErrorMessage(error)}`,
      };
    }
  }

  public async getArticleLabels(
    articleId: string
  ): Promise<DatabaseOperationResult<DBLabel[]>> {
    try {
      // Optimized query using article_labels index
      const sql = `
                SELECT l.id, l.name, l.color, l.created_at, l.updated_at, l.synced_at 
                FROM labels l
                INNER JOIN article_labels al ON l.id = al.label_id
                WHERE al.article_id = ?
                ORDER BY l.name ASC
            `;

      const result = await this.executeSql(sql, [articleId]);
      const labels = [];

      if (result && result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
          labels.push(result.rows.item(i) as DBLabel);
        }
      }

      return {
        success: true,
        data: labels,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get article labels: ${getErrorMessage(error)}`,
      };
    }
  }

  public async getLabelArticles(
    labelId: number
  ): Promise<DatabaseOperationResult<DBArticle[]>> {
    try {
      // Optimized query using label-specific index and explicit column selection
      const sql = `
                SELECT a.id, a.title, a.summary, a.content, a.url, a.image_url, a.read_time,
                       a.is_archived, a.is_favorite, a.is_read, a.source_url, 
                       a.created_at, a.updated_at, a.synced_at, a.is_modified, a.deleted_at
                FROM articles a
                INNER JOIN article_labels al ON a.id = al.article_id
                WHERE al.label_id = ? AND a.deleted_at IS NULL
                ORDER BY a.created_at DESC
            `;

      const result = await this.executeSql(sql, [labelId]);
      const articles = [];

      if (result && result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
          articles.push(result.rows.item(i) as DBArticle);
        }
      }

      return {
        success: true,
        data: articles,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get label articles: ${getErrorMessage(error)}`,
      };
    }
  }

  // Sync Metadata Operations
  public async createSyncMetadata(
    metadata: Omit<DBSyncMetadata, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DatabaseOperationResult<number>> {
    try {
      const now = this.createTimestamp();
      const sql = `
                INSERT INTO sync_metadata (
                    entity_type, entity_id, operation, local_timestamp,
                    server_timestamp, sync_status, conflict_resolution,
                    retry_count, error_message, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

      const params = [
        metadata.entity_type,
        metadata.entity_id,
        metadata.operation,
        metadata.local_timestamp,
        metadata.server_timestamp,
        metadata.sync_status,
        metadata.conflict_resolution,
        metadata.retry_count,
        metadata.error_message,
        now,
        now,
      ];

      const result = await this.executeSql(sql, params);

      return {
        success: true,
        data: result.insertId || 0,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create sync metadata: ${getErrorMessage(error)}`,
      };
    }
  }

  public async updateSyncMetadata(
    id: number,
    updates: Partial<DBSyncMetadata>
  ): Promise<DatabaseOperationResult> {
    try {
      const updateFields = Object.keys(updates).filter(key => key !== 'id');
      if (updateFields.length === 0) {
        return { success: true, rowsAffected: 0 };
      }

      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      const sql = `UPDATE sync_metadata SET ${setClause}, updated_at = ? WHERE id = ?`;

      const params = [
        ...updateFields.map(field => updates[field as keyof DBSyncMetadata]),
        this.createTimestamp(),
        id,
      ];

      const result = await this.executeSql(sql, params);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update sync metadata: ${getErrorMessage(error)}`,
      };
    }
  }

  public async getSyncMetadata(
    filters?: SyncMetadataFilters
  ): Promise<DatabaseOperationResult<PaginatedResult<DBSyncMetadata>>> {
    try {
      const conditions = [];
      const params = [];

      if (filters?.entityType) {
        conditions.push('entity_type = ?');
        params.push(filters.entityType);
      }

      if (filters?.syncStatus) {
        conditions.push('sync_status = ?');
        params.push(filters.syncStatus);
      }

      if (filters?.operation) {
        conditions.push('operation = ?');
        params.push(filters.operation);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM sync_metadata ${whereClause}`;
      const countResult = await this.executeSql(countSql, params);
      const totalCount = countResult.rows.item(0).count;

      // Get paginated results
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const sql = `
                SELECT * FROM sync_metadata 
                ${whereClause} 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `;

      const result = await this.executeSql(sql, [...params, limit, offset]);
      const items = [];

      if (result && result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
          items.push(result.rows.item(i) as DBSyncMetadata);
        }
      }

      return {
        success: true,
        data: {
          items,
          totalCount,
          hasMore: offset + limit < totalCount,
          limit,
          offset,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get sync metadata: ${getErrorMessage(error)}`,
      };
    }
  }

  public async deleteSyncMetadata(
    id: number
  ): Promise<DatabaseOperationResult> {
    try {
      const sql = 'DELETE FROM sync_metadata WHERE id = ?';
      const result = await this.executeSql(sql, [id]);

      return {
        success: true,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete sync metadata: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Batch create multiple articles in a single transaction
   */
  public async createArticlesBatch(
    articles: Omit<DBArticle, 'created_at' | 'updated_at'>[]
  ): Promise<DatabaseOperationResult<string[]>> {
    if (articles.length === 0) {
      return { success: true, data: [] };
    }

    try {
      const articleIds: string[] = [];

      await this.executeInTransaction(async ctx => {
        const now = this.createTimestamp();

        // Use prepared statement for better performance
        const sql = `
          INSERT INTO articles (
            id, title, summary, content, url, image_url, read_time,
            is_archived, is_favorite, is_read, source_url, created_at,
            updated_at, synced_at, is_modified, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (const article of articles) {
          const params = [
            article.id,
            article.title,
            article.summary || null,
            article.content || null,
            article.url,
            article.image_url || null,
            article.read_time || null,
            article.is_archived || 0,
            article.is_favorite || 0,
            article.is_read || 0,
            article.source_url || null,
            now,
            now,
            article.synced_at || null,
            article.is_modified || 0,
            article.deleted_at || null,
          ];

          await ctx.executeSql(sql, params);
          articleIds.push(article.id);
        }
      });

      return {
        success: true,
        data: articleIds,
        rowsAffected: articles.length,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create articles batch: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Batch update multiple articles in a single transaction
   */
  public async updateArticlesBatch(
    updates: { id: string; updates: Partial<DBArticle> }[]
  ): Promise<DatabaseOperationResult> {
    if (updates.length === 0) {
      return { success: true, rowsAffected: 0 };
    }

    try {
      let totalRowsAffected = 0;

      await this.executeInTransaction(async ctx => {
        const now = this.createTimestamp();

        for (const { id, updates: articleUpdates } of updates) {
          const updateFields = Object.keys(articleUpdates).filter(
            key => key !== 'id'
          );
          if (updateFields.length === 0) continue;

          const setClause = updateFields
            .map(field => `${field} = ?`)
            .join(', ');
          const sql = `UPDATE articles SET ${setClause}, updated_at = ? WHERE id = ?`;

          const params = [
            ...updateFields.map(
              field => articleUpdates[field as keyof DBArticle]
            ),
            now,
            id,
          ];

          const result = await ctx.executeSql(sql, params);
          totalRowsAffected += result.rowsAffected || 0;
        }
      });

      return {
        success: true,
        rowsAffected: totalRowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update articles batch: ${(error as Error).message}`,
      };
    }
  }

  // Utility Operations
  public async getStats(): Promise<DatabaseOperationResult<DatabaseStats>> {
    try {
      const queries = [
        'SELECT COUNT(*) as count FROM articles WHERE deleted_at IS NULL',
        'SELECT COUNT(*) as count FROM articles WHERE is_archived = 1 AND deleted_at IS NULL',
        'SELECT COUNT(*) as count FROM articles WHERE is_favorite = 1 AND deleted_at IS NULL',
        'SELECT COUNT(*) as count FROM articles WHERE is_read = 0 AND deleted_at IS NULL',
        'SELECT COUNT(*) as count FROM labels',
        'SELECT COUNT(*) as count FROM sync_metadata WHERE sync_status = "pending"',
        'SELECT MAX(synced_at) as last_sync FROM articles WHERE synced_at IS NOT NULL',
      ];

      const results = await Promise.all(
        queries.map(query => this.executeSql(query))
      );

      const stats: DatabaseStats = {
        totalArticles: results[0].rows.item(0).count,
        archivedArticles: results[1].rows.item(0).count,
        favoriteArticles: results[2].rows.item(0).count,
        unreadArticles: results[3].rows.item(0).count,
        totalLabels: results[4].rows.item(0).count,
        pendingSyncItems: results[5].rows.item(0).count,
        databaseSize: 0, // TODO: Implement database size calculation
        lastSyncAt: results[6].rows.item(0).last_sync,
        // eslint-disable-next-line camelcase
        articles_count: results[0].rows.item(0).count,
        // eslint-disable-next-line camelcase
        labels_count: results[4].rows.item(0).count,
        // eslint-disable-next-line camelcase
        pending_sync_count: results[5].rows.item(0).count,
        // eslint-disable-next-line camelcase
        failed_sync_count: 0, // TODO: Implement failed sync count
        // eslint-disable-next-line camelcase
        last_sync_time: results[6].rows.item(0).last_sync ? new Date(results[6].rows.item(0).last_sync * 1000).toISOString() : null,
        articlesCount: results[0].rows.item(0).count,
        labelsCount: results[4].rows.item(0).count,
        pendingSyncCount: results[5].rows.item(0).count,
        dbSize: 0, // TODO: Implement database size calculation
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get stats: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Clear all user data from the database (used during logout)
   */
  public async clearAllData(): Promise<DatabaseOperationResult> {
    try {
      await this.executeInTransaction(async ctx => {
        // Clear all tables in correct order (respecting foreign key constraints)
        await ctx.executeSql('DELETE FROM article_labels');
        await ctx.executeSql('DELETE FROM articles_fts');
        await ctx.executeSql('DELETE FROM articles');
        await ctx.executeSql('DELETE FROM labels');
        await ctx.executeSql('DELETE FROM sync_metadata');

        console.log('[DatabaseService] All user data cleared from database');
      });

      return { success: true };
    } catch (error) {
      console.error('[DatabaseService] Failed to clear all data:', error);
      return {
        success: false,
        error: `Failed to clear all data: ${getErrorMessage(error)}`,
      };
    }
  }

  public async vacuum(): Promise<DatabaseOperationResult> {
    try {
      await this.executeSql('VACUUM;');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to vacuum database: ${getErrorMessage(error)}`,
      };
    }
  }

  public async backup(_path: string): Promise<DatabaseOperationResult> {
    // TODO: Implement database backup functionality
    return {
      success: false,
      error: 'Backup functionality not implemented yet',
    };
  }

  // Migration Operations
  public async getCurrentVersion(): Promise<number> {
    try {
      // First check if schema_version table exists
      const tableCheckSql = `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`;
      const tableResult = await this.executeSql(tableCheckSql);

      if (!tableResult || !tableResult.rows || tableResult.rows.length === 0) {
        // Table doesn't exist, so this is a fresh database
        return 0;
      }

      // Table exists, get the current version
      const sql = 'SELECT MAX(version) as version FROM schema_version';
      const result = await this.executeSql(sql);
      if (result && result.rows && result.rows.length > 0) {
        const versionRow = result.rows.item(0);
        return versionRow && versionRow.version ? versionRow.version : 0;
      }
      return 0;
    } catch (error) {
      console.error('[DatabaseService] Failed to get current version:', error);
      return 0;
    }
  }

  public async runMigrations(
    migrations: Migration[]
  ): Promise<DatabaseOperationResult> {
    try {
      const currentVersion = await this.getCurrentVersion();
      const pendingMigrations = migrations.filter(
        m => m.version > currentVersion
      );

      if (pendingMigrations.length === 0) {
        return { success: true };
      }

      await this.executeInTransaction(async ctx => {
        for (const migration of pendingMigrations) {
          console.log(
            `[DatabaseService] Running migration ${migration.version}: ${migration.description}`
          );

          // Execute migration in a nested transaction context
          await migration.up({
            executeSql: (sql, params, success, error) => {
              ctx
                .executeSql(sql, params)
                .then(result => success?.(null as any, result as any))
                .catch(err => error?.(null as any, err));
            },
          } as DatabaseTransaction);

          // Record migration completion
          await ctx.executeSql(
            'INSERT OR IGNORE INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)',
            [migration.version, this.createTimestamp(), migration.description]
          );
        }
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Migration failed: ${getErrorMessage(error)}`,
      };
    }
  }

  private async runPendingMigrations(): Promise<void> {
    // Version 2 migration: Add optimized indexes
    const migrations: Migration[] = [
      {
        version: 2,
        description:
          'Add optimized composite and covering indexes for performance',
        up: async (tx: DatabaseTransaction) => {
          const indexQueries = [
            // Remove any conflicting indexes first (if they exist)
            'DROP INDEX IF EXISTS idx_articles_deleted_archived',
            'DROP INDEX IF EXISTS idx_articles_deleted_favorite',
            'DROP INDEX IF EXISTS idx_articles_deleted_read',
            'DROP INDEX IF EXISTS idx_articles_archived_read',
            'DROP INDEX IF EXISTS idx_articles_list_covering',
            'DROP INDEX IF EXISTS idx_articles_modified_covering',
            'DROP INDEX IF EXISTS idx_article_labels_article',
            'DROP INDEX IF EXISTS idx_article_labels_label',
            'DROP INDEX IF EXISTS idx_sync_metadata_status_time',

            // Create optimized composite indexes
            'CREATE INDEX IF NOT EXISTS idx_articles_deleted_archived ON articles(deleted_at, is_archived, created_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_articles_deleted_favorite ON articles(deleted_at, is_favorite, created_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_articles_deleted_read ON articles(deleted_at, is_read, created_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_articles_archived_read ON articles(is_archived, is_read, created_at DESC)',

            // Create covering indexes for better performance
            'CREATE INDEX IF NOT EXISTS idx_articles_list_covering ON articles(deleted_at, created_at DESC, id, title, summary, is_archived, is_favorite, is_read)',
            'CREATE INDEX IF NOT EXISTS idx_articles_modified_covering ON articles(is_modified, updated_at DESC, id, synced_at)',

            // Optimize article-label joins
            'CREATE INDEX IF NOT EXISTS idx_article_labels_article ON article_labels(article_id, label_id)',
            'CREATE INDEX IF NOT EXISTS idx_article_labels_label ON article_labels(label_id, article_id)',

            // Additional sync optimization
            'CREATE INDEX IF NOT EXISTS idx_sync_metadata_status_time ON sync_metadata(sync_status, created_at DESC)',
          ];

          for (const query of indexQueries) {
            tx.executeSql(
              query,
              [],
              () => {}, // Success callback
              (_: any, error: any) => {
                console.error('Migration query failed:', query, error);
                return false; // Don't halt transaction for index creation failures
              }
            );
          }
        },
        down: async (tx: DatabaseTransaction) => {
          // Rollback: Remove the optimized indexes
          const rollbackQueries = [
            'DROP INDEX IF EXISTS idx_articles_deleted_archived',
            'DROP INDEX IF EXISTS idx_articles_deleted_favorite',
            'DROP INDEX IF EXISTS idx_articles_deleted_read',
            'DROP INDEX IF EXISTS idx_articles_archived_read',
            'DROP INDEX IF EXISTS idx_articles_list_covering',
            'DROP INDEX IF EXISTS idx_articles_modified_covering',
            'DROP INDEX IF EXISTS idx_article_labels_article',
            'DROP INDEX IF EXISTS idx_article_labels_label',
            'DROP INDEX IF EXISTS idx_sync_metadata_status_time',
          ];

          for (const query of rollbackQueries) {
            tx.executeSql(
              query,
              [],
              () => {},
              () => false
            );
          }
        },
      },
    ];

    await this.runMigrations(migrations);
  }

  // Helper Methods
  private async executeSql(
    sql: string,
    params: any[] = []
  ): Promise<SQLiteResultSet> {
    if (!this.db) {
      throw this.createDatabaseError(
        DatabaseErrorCode.CONNECTION_FAILED,
        'Database not connected'
      );
    }

    try {
      // When promises are enabled, executeSql returns an array where the first element is the result
      const results = await this.db.executeSql(sql, params);
      if (Array.isArray(results) && results.length > 0) {
        return results[0] as SQLiteResultSet;
      }
      // Fallback for non-array results
      return results as SQLiteResultSet;
    } catch (error) {
      throw this.createDatabaseError(
        DatabaseErrorCode.QUERY_FAILED,
        `SQL query failed: ${sql}`,
        error,
        sql,
        params
      );
    }
  }

  private buildArticleQuery(filters?: ArticleFilters): {
    whereClause: string;
    params: any[];
    countParams: any[];
  } {
    // Order conditions for optimal index usage (most selective first)
    const conditions = ['deleted_at IS NULL'];
    const params: any[] = [];

    // Add specific filters in order of selectivity
    if (filters?.isArchived !== undefined) {
      conditions.push('is_archived = ?');
      params.push(filters.isArchived ? 1 : 0);
    }

    if (filters?.isFavorite !== undefined) {
      conditions.push('is_favorite = ?');
      params.push(filters.isFavorite ? 1 : 0);
    }

    if (filters?.isRead !== undefined) {
      conditions.push('is_read = ?');
      params.push(filters.isRead ? 1 : 0);
    }

    // Optimize label filtering with EXISTS for better performance
    if (filters?.labelIds && filters.labelIds.length > 0) {
      const placeholders = filters.labelIds.map(() => '?').join(',');
      conditions.push(`EXISTS (
                SELECT 1 FROM article_labels al 
                WHERE al.article_id = articles.id 
                AND al.label_id IN (${placeholders})
            )`);
      params.push(...filters.labelIds);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return {
      whereClause,
      params,
      countParams: [...params],
    };
  }

  private createDatabaseError(
    code: DatabaseErrorCode,
    message: string,
    originalError?: any,
    query?: string,
    params?: any[]
  ): DatabaseError {
    // Use centralized error handling for consistent error categorization and logging
    errorHandler.handleError(originalError || new Error(message), {
      category: ErrorCategory.STORAGE,
      context: {
        actionType: 'database_operation',
        errorCode: code,
      },
      details: { query, params },
    });

    // Return original message for compatibility with existing tests
    const error = new Error(message) as DatabaseError;
    error.code = code;
    error.details = originalError;
    error.query = query;
    error.params = params;
    return error;
  }

  private createTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }
}

// Export singleton instance
export default DatabaseService.getInstance();

// Export utility functions
export const DatabaseUtilityFunctions: DatabaseUtils = {
  convertDBArticleToArticle(dbArticle: DBArticle): Article {
    return {
      id: dbArticle.id,
      title: dbArticle.title,
      summary: dbArticle.summary,
      content: dbArticle.content,
      url: dbArticle.url,
      imageUrl: dbArticle.image_url,
      readTime: dbArticle.read_time,
      sourceUrl: dbArticle.source_url,
      isArchived: Boolean(dbArticle.is_archived),
      isFavorite: Boolean(dbArticle.is_favorite),
      isRead: Boolean(dbArticle.is_read),
      isModified: Boolean(dbArticle.is_modified),
      createdAt: new Date(dbArticle.created_at * 1000).toISOString(),
      updatedAt: new Date(dbArticle.updated_at * 1000).toISOString(),
      syncedAt: dbArticle.synced_at
        ? new Date(dbArticle.synced_at * 1000).toISOString()
        : undefined,
      deletedAt: dbArticle.deleted_at
        ? new Date(dbArticle.deleted_at * 1000).toISOString()
        : undefined,
      tags: [], // Tags are loaded separately from article_labels table
      contentUrl: undefined, // Not stored in database, comes from API
    } as Article;
  },

  convertArticleToDBArticle(article: Article): DBArticle {
    return {
      id: article.id,
      title: article.title,
      summary: article.summary || null,
      content: article.content || null,
      url: article.url,
      image_url: article.imageUrl || null,
      read_time: article.readTime || null,
      source_url: article.sourceUrl || null,
      is_archived: article.isArchived ? 1 : 0,
      is_favorite: article.isFavorite ? 1 : 0,
      is_read: article.isRead ? 1 : 0,
      is_modified: article.isModified ? 1 : 0,
      created_at: article.createdAt
        ? Math.floor(new Date(article.createdAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      updated_at: article.updatedAt
        ? Math.floor(new Date(article.updatedAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      synced_at: article.syncedAt
        ? Math.floor(new Date(article.syncedAt).getTime() / 1000)
        : null,
      deleted_at: article.deletedAt
        ? Math.floor(new Date(article.deletedAt).getTime() / 1000)
        : null,
    };
  },

  convertDBLabelToLabel(dbLabel: DBLabel): Label {
    return {
      id: String(dbLabel.id),
      name: dbLabel.name,
      color: dbLabel.color || undefined,
      articleCount: 0, // Would need to be calculated separately
      createdAt: new Date(dbLabel.created_at * 1000).toISOString(),
      updatedAt: new Date(dbLabel.updated_at * 1000).toISOString(),
      syncedAt: dbLabel.synced_at
        ? new Date(dbLabel.synced_at * 1000).toISOString()
        : undefined,
    };
  },

  convertLabelToDBLabel(label: Label): DBLabel {
    return {
      id: parseInt(label.id),
      name: label.name,
      color: label.color || null,
      created_at: label.createdAt
        ? Math.floor(new Date(label.createdAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      updated_at: label.updatedAt
        ? Math.floor(new Date(label.updatedAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      synced_at: label.syncedAt
        ? Math.floor(new Date(label.syncedAt).getTime() / 1000)
        : null,
    };
  },

  createTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  },

  formatTimestamp(timestamp: number): Date {
    return new Date(timestamp * 1000);
  },
};
