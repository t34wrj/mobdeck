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
  DatabaseServiceInterface,
  DatabaseConfig,
  DatabaseTransaction,
  DatabaseResult,
  DatabaseOperationResult,
  DatabaseError,
  DatabaseErrorCode,
  TransactionContext,
  DBArticle,
  DBLabel,
  DBSyncMetadata,
  ArticleFilters,
  LabelFilters,
  SyncMetadataFilters,
  PaginatedResult,
  DatabaseStats,
  Migration,
  Article,
  Label,
  DatabaseUtils,
} from '../types/database';

// Enable debugging in development
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  SQLite.DEBUG(true);
  SQLite.enablePromise(true);
}

class DatabaseService implements DatabaseServiceInterface {
  private static instance: DatabaseService;
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  private connectionPool: SQLite.SQLiteDatabase[] = [];
  private readonly maxConnections = 5;
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

      this.db = await SQLite.openDatabase({
        name: this.config.name,
        location: this.config.location,
        createFromLocation: undefined,
      });

      // Enable foreign key constraints (optional - some SQLite versions might not support this)
      try {
        await this.db.executeSql('PRAGMA foreign_keys = ON;');
        console.log('[DatabaseService] Foreign key constraints enabled');
      } catch (error) {
        console.warn('[DatabaseService] Could not enable foreign key constraints:', error);
        console.log('[DatabaseService] Continuing without foreign key constraints');
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

      // Performance indexes
      'CREATE INDEX IF NOT EXISTS idx_articles_is_archived ON articles(is_archived);',
      'CREATE INDEX IF NOT EXISTS idx_articles_is_favorite ON articles(is_favorite);',
      'CREATE INDEX IF NOT EXISTS idx_articles_is_read ON articles(is_read);',
      'CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_articles_is_modified ON articles(is_modified);',
      'CREATE INDEX IF NOT EXISTS idx_articles_deleted_at ON articles(deleted_at);',
      'CREATE INDEX IF NOT EXISTS idx_articles_synced_at ON articles(synced_at);',
      'CREATE INDEX IF NOT EXISTS idx_sync_metadata_entity ON sync_metadata(entity_type, entity_id);',
      'CREATE INDEX IF NOT EXISTS idx_sync_metadata_status ON sync_metadata(sync_status);',
      'CREATE INDEX IF NOT EXISTS idx_sync_metadata_timestamp ON sync_metadata(local_timestamp DESC);',


      // Initial schema version
      `INSERT OR IGNORE INTO schema_version (version, applied_at, description) 
            VALUES (1, strftime('%s', 'now'), 'Initial database schema with articles, labels, and sync metadata');`,
    ];

    for (const query of schemaQueries) {
      try {
        await this.db.executeSql(query);
      } catch (error) {
        console.error('[DatabaseService] Schema query failed:', query, error);
        throw error;
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
    } catch (error) {
      // FTS5 is optional - log as debug instead of warning to reduce noise
      console.log('[DatabaseService] FTS5 not available, continuing without full-text search features');
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
      this.db!.transaction(
        async tx => {
          try {
            const context: TransactionContext = {
              executeSql: (sql: string, params?: any[]) => {
                return new Promise<DatabaseResult>(
                  (resolveQuery, rejectQuery) => {
                    tx.executeSql(
                      sql,
                      params || [],
                      (_, result) => resolveQuery(result as DatabaseResult),
                      (_, error) => {
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
        error => {
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
      return {
        success: false,
        error: `Failed to create article: ${error.message}`,
      };
    }
  }

  public async getArticle(
    id: string
  ): Promise<DatabaseOperationResult<DBArticle>> {
    try {
      const sql = 'SELECT * FROM articles WHERE id = ? AND deleted_at IS NULL';
      const result = await this.executeSql(sql, [id]);

      if (result.rows.length === 0) {
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
      return {
        success: false,
        error: `Failed to get article: ${error.message}`,
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
        error: `Failed to update article: ${error.message}`,
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
        error: `Failed to delete article: ${error.message}`,
      };
    }
  }

  public async getArticles(
    filters?: ArticleFilters
  ): Promise<DatabaseOperationResult<PaginatedResult<DBArticle>>> {
    try {
      const { whereClause, params, countParams } =
        this.buildArticleQuery(filters);

      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM articles ${whereClause}`;
      const countResult = await this.executeSql(countSql, countParams);
      const totalCount = countResult.rows.item(0).count;

      // Get paginated results
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;
      const sortBy = filters?.sortBy || 'created_at';
      const sortOrder = filters?.sortOrder || 'DESC';

      const sql = `
                SELECT * FROM articles 
                ${whereClause} 
                ORDER BY ${sortBy} ${sortOrder} 
                LIMIT ? OFFSET ?
            `;

      const result = await this.executeSql(sql, [...params, limit, offset]);
      const items = [];

      for (let i = 0; i < result.rows.length; i++) {
        items.push(result.rows.item(i) as DBArticle);
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
        error: `Failed to get articles: ${error.message}`,
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

        for (let i = 0; i < result.rows.length; i++) {
          items.push(result.rows.item(i) as DBArticle);
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
        console.warn('[DatabaseService] FTS5 search failed, falling back to LIKE search:', ftsError);
        
        // Fallback to LIKE search if FTS is not available
        const searchTerm = `%${query}%`;
        const sql = `
                  SELECT * FROM articles 
                  WHERE (title LIKE ? OR summary LIKE ? OR content LIKE ?) 
                  AND deleted_at IS NULL
                  ORDER BY updated_at DESC
                  LIMIT ? OFFSET ?
              `;

        const result = await this.executeSql(sql, [searchTerm, searchTerm, searchTerm, limit, offset]);
        const items = [];

        for (let i = 0; i < result.rows.length; i++) {
          items.push(result.rows.item(i) as DBArticle);
        }

        // Get total count for fallback search
        const countSql = `
                  SELECT COUNT(*) as count FROM articles 
                  WHERE (title LIKE ? OR summary LIKE ? OR content LIKE ?) 
                  AND deleted_at IS NULL
              `;
        const countResult = await this.executeSql(countSql, [searchTerm, searchTerm, searchTerm]);
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
        error: `Failed to search articles: ${error.message}`,
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
        data: result.insertId!,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create label: ${error.message}`,
      };
    }
  }

  public async getLabel(id: number): Promise<DatabaseOperationResult<DBLabel>> {
    try {
      const sql = 'SELECT * FROM labels WHERE id = ?';
      const result = await this.executeSql(sql, [id]);

      if (result.rows.length === 0) {
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
        error: `Failed to get label: ${error.message}`,
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
        error: `Failed to update label: ${error.message}`,
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
        error: `Failed to delete label: ${error.message}`,
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

      for (let i = 0; i < result.rows.length; i++) {
        items.push(result.rows.item(i) as DBLabel);
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
        error: `Failed to get labels: ${error.message}`,
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
        error: `Failed to add label to article: ${error.message}`,
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
        error: `Failed to remove label from article: ${error.message}`,
      };
    }
  }

  public async getArticleLabels(
    articleId: string
  ): Promise<DatabaseOperationResult<DBLabel[]>> {
    try {
      const sql = `
                SELECT l.* FROM labels l
                JOIN article_labels al ON l.id = al.label_id
                WHERE al.article_id = ?
                ORDER BY l.name ASC
            `;

      const result = await this.executeSql(sql, [articleId]);
      const labels = [];

      for (let i = 0; i < result.rows.length; i++) {
        labels.push(result.rows.item(i) as DBLabel);
      }

      return {
        success: true,
        data: labels,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get article labels: ${error.message}`,
      };
    }
  }

  public async getLabelArticles(
    labelId: number
  ): Promise<DatabaseOperationResult<DBArticle[]>> {
    try {
      const sql = `
                SELECT a.* FROM articles a
                JOIN article_labels al ON a.id = al.article_id
                WHERE al.label_id = ? AND a.deleted_at IS NULL
                ORDER BY a.created_at DESC
            `;

      const result = await this.executeSql(sql, [labelId]);
      const articles = [];

      for (let i = 0; i < result.rows.length; i++) {
        articles.push(result.rows.item(i) as DBArticle);
      }

      return {
        success: true,
        data: articles,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get label articles: ${error.message}`,
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
        data: result.insertId!,
        rowsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create sync metadata: ${error.message}`,
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
        error: `Failed to update sync metadata: ${error.message}`,
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

      for (let i = 0; i < result.rows.length; i++) {
        items.push(result.rows.item(i) as DBSyncMetadata);
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
        error: `Failed to get sync metadata: ${error.message}`,
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
        error: `Failed to delete sync metadata: ${error.message}`,
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
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get stats: ${error.message}`,
      };
    }
  }

  /**
   * Clear all user data from the database (used during logout)
   */
  public async clearAllData(): Promise<DatabaseOperationResult> {
    try {
      await this.executeInTransaction(async (ctx) => {
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
        error: `Failed to clear all data: ${error.message}`,
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
        error: `Failed to vacuum database: ${error.message}`,
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
      const sql = 'SELECT MAX(version) as version FROM schema_version';
      const result = await this.executeSql(sql);
      return result.rows.item(0).version || 0;
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
            'INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)',
            [migration.version, this.createTimestamp(), migration.description]
          );
        }
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Migration failed: ${error.message}`,
      };
    }
  }

  private async runPendingMigrations(): Promise<void> {
    // No pending migrations for initial version
    // Future migrations will be added here
  }

  // Helper Methods
  private async executeSql(
    sql: string,
    params: any[] = []
  ): Promise<DatabaseResult> {
    if (!this.db) {
      throw this.createDatabaseError(
        DatabaseErrorCode.CONNECTION_FAILED,
        'Database not connected'
      );
    }

    try {
      const [result] = await this.db.executeSql(sql, params);
      return result as DatabaseResult;
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
    const conditions = ['deleted_at IS NULL'];
    const params: any[] = [];

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

    if (filters?.labelIds && filters.labelIds.length > 0) {
      const placeholders = filters.labelIds.map(() => '?').join(',');
      conditions.push(`id IN (
                SELECT article_id FROM article_labels 
                WHERE label_id IN (${placeholders})
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
      summary: article.summary,
      content: article.content,
      url: article.url,
      image_url: article.imageUrl,
      read_time: article.readTime,
      source_url: article.sourceUrl,
      is_archived: article.isArchived ? 1 : 0,
      is_favorite: article.isFavorite ? 1 : 0,
      is_read: article.isRead ? 1 : 0,
      is_modified: article.isModified ? 1 : 0,
      created_at: Math.floor(new Date(article.createdAt).getTime() / 1000),
      updated_at: Math.floor(new Date(article.updatedAt).getTime() / 1000),
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
      ...dbLabel,
      createdAt: new Date(dbLabel.created_at * 1000),
      updatedAt: new Date(dbLabel.updated_at * 1000),
      syncedAt: dbLabel.synced_at
        ? new Date(dbLabel.synced_at * 1000)
        : undefined,
    };
  },

  convertLabelToDBLabel(label: Label): DBLabel {
    return {
      ...label,
      created_at: Math.floor(label.createdAt.getTime() / 1000),
      updated_at: Math.floor(label.updatedAt.getTime() / 1000),
      synced_at: label.syncedAt
        ? Math.floor(label.syncedAt.getTime() / 1000)
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
