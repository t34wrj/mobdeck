import SQLite from 'react-native-sqlite-storage';
import { ErrorCode, AppError } from '../types';

// Enable debugging in development
if (typeof globalThis !== 'undefined' && globalThis.__DEV__) {
  SQLite.DEBUG(true);
}

// Enable promise-based API
SQLite.enablePromise(true);

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: SQLite.SQLiteDatabase | null = null;
  private readonly DB_NAME = 'mobdeck.db';
  private readonly DB_VERSION = 1;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (this.db) {
        console.log('Database already initialized');
        return;
      }

      console.log('Initializing SQLite database...');

      this.db = await SQLite.openDatabase({
        name: this.DB_NAME,
        location: 'default',
        createFromLocation: undefined,
      });

      await this.runMigrations();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        'Failed to initialize database',
        error
      );
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }

  getDatabase(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        'Database not initialized. Call initialize() first.'
      );
    }
    return this.db;
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    try {
      // Check current schema version
      let currentVersion = 0;
      try {
        const versionResults = await this.db.executeSql(
          'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
        );
        
        if (Array.isArray(versionResults) && versionResults.length > 0) {
          const versionResult = versionResults[0];
          if (versionResult.rows && versionResult.rows.length > 0) {
            currentVersion = versionResult.rows.item(0).version || 0;
          }
        }
      } catch {
        // Table doesn't exist yet, start with version 0
        console.log('Schema version table does not exist, starting with version 0');
        currentVersion = 0;
      }

      if (currentVersion < this.DB_VERSION) {
        console.log(
          `Running migrations from version ${currentVersion} to ${this.DB_VERSION}`
        );

        // Read and execute schema
        const schemaSQL = await this.loadSchemaSQL();

        // Split by semicolon and execute each statement
        const statements = schemaSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
          try {
            await this.db.executeSql(statement);
          } catch (err) {
            // Log but don't fail on expected errors (like table already exists)
            console.warn('SQL statement warning:', statement, err);
          }
        }

        console.log('Database migrations completed successfully');
      } else {
        console.log('Database schema is up to date');
      }
    } catch (error) {
      console.error('Migration failed:', error);
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        'Database migration failed',
        error
      );
    }
  }

  private async loadSchemaSQL(): Promise<string> {
    // In a real implementation, you would load this from the schema.sql file
    // For React Native, we'll embed it directly or use a bundler plugin
    return `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS articles (
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
      );

      CREATE TABLE IF NOT EXISTS labels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        synced_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS article_labels (
        article_id TEXT NOT NULL,
        label_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (article_id, label_id),
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sync_metadata (
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
      );

      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL,
        description TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_articles_is_archived ON articles(is_archived);
      CREATE INDEX IF NOT EXISTS idx_articles_is_favorite ON articles(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_articles_is_read ON articles(is_read);
      CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_articles_is_modified ON articles(is_modified);
      CREATE INDEX IF NOT EXISTS idx_articles_deleted_at ON articles(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_articles_synced_at ON articles(synced_at);
      CREATE INDEX IF NOT EXISTS idx_sync_metadata_entity ON sync_metadata(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_sync_metadata_status ON sync_metadata(sync_status);
      CREATE INDEX IF NOT EXISTS idx_sync_metadata_timestamp ON sync_metadata(local_timestamp DESC);

      INSERT OR IGNORE INTO schema_version (version, applied_at, description) 
      VALUES (1, strftime('%s', 'now'), 'Initial database schema with articles, labels, and sync metadata');
    `;
  }

  // Utility methods for common database operations
  async transaction<T>(
    operation: (tx: any) => Promise<T>
  ): Promise<T> {
    const db = this.getDatabase();

    return new Promise((resolve, reject) => {
      db.transaction(
        async (tx: any) => {
          try {
            const result = await operation(tx);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
        (error: any) => {
          console.error('Transaction failed:', error);
          reject(
            new AppError(
              ErrorCode.DATABASE_ERROR,
              'Database transaction failed',
              error
            )
          );
        }
      );
    });
  }

  async executeSql(sql: string, params: any[] = []): Promise<SQLite.ResultSet> {
    try {
      const db = this.getDatabase();
      const results = await db.executeSql(sql, params);
      if (Array.isArray(results) && results.length > 0) {
        return results[0];
      }
      throw new Error('No results returned from SQL execution');
    } catch (error) {
      console.error('SQL execution failed:', sql, params, error);
      throw new AppError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'SQL execution failed',
        details: { sql, params, error },
      });
    }
  }

  // Database health check
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.executeSql('SELECT 1 as test');
      return result.rows.length > 0;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  // Get database statistics
  async getStats(): Promise<{
    articlesCount: number;
    labelsCount: number;
    pendingSyncCount: number;
    dbSize?: number;
  }> {
    try {
      const [articlesResult, labelsResult, syncResult] = await Promise.all([
        this.executeSql(
          'SELECT COUNT(*) as count FROM articles WHERE deleted_at IS NULL'
        ),
        this.executeSql('SELECT COUNT(*) as count FROM labels'),
        this.executeSql(
          'SELECT COUNT(*) as count FROM sync_metadata WHERE sync_status = "pending"'
        ),
      ]);

      return {
        articlesCount: articlesResult.rows.item(0).count,
        labelsCount: labelsResult.rows.item(0).count,
        pendingSyncCount: syncResult.rows.item(0).count,
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw new AppError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to retrieve database statistics',
        details: error,
      });
    }
  }

  // Clean up old sync metadata
  async cleanupSyncMetadata(olderThanDays: number = 30): Promise<void> {
    const cutoffTimestamp = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    try {
      await this.executeSql(
        'DELETE FROM sync_metadata WHERE sync_status = "completed" AND updated_at < ?',
        [cutoffTimestamp]
      );
      console.log(`Cleaned up sync metadata older than ${olderThanDays} days`);
    } catch (error) {
      console.error('Failed to cleanup sync metadata:', error);
      throw new AppError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to cleanup old sync metadata',
        details: error,
      });
    }
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();
