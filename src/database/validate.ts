// Database schema validation utilities
import { DatabaseManager, databaseManager } from './init';
import { DatabaseStats } from './types';

export class DatabaseValidator {
  private db: DatabaseManager;

  constructor() {
    this.db = databaseManager;
  }

  async validateSchema(): Promise<{
    isValid: boolean;
    errors: string[];
    tables: string[];
  }> {
    const errors: string[] = [];
    const tables: string[] = [];

    try {
      // Check if database is initialized
      const isHealthy = await this.db.healthCheck();
      if (!isHealthy) {
        errors.push('Database health check failed');
        return { isValid: false, errors, tables };
      }

      // Validate table existence
      const expectedTables = [
        'articles',
        'labels',
        'article_labels',
        'sync_metadata',
        'schema_version',
        'articles_fts',
      ];

      for (const tableName of expectedTables) {
        try {
          const result = await this.db.executeSql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [tableName]
          );

          if (result.rows.length > 0) {
            tables.push(tableName);
          } else {
            errors.push(`Table '${tableName}' not found`);
          }
        } catch (error) {
          errors.push(`Error checking table '${tableName}': ${error}`);
        }
      }

      // Validate schema version
      try {
        const versionResult = await this.db.executeSql(
          'SELECT version, description FROM schema_version ORDER BY version DESC LIMIT 1'
        );

        if (versionResult.rows.length === 0) {
          errors.push('No schema version found');
        } else {
          const version = versionResult.rows.item(0);
          console.log(
            `Current schema version: ${version.version} - ${version.description}`
          );
        }
      } catch (error) {
        errors.push(`Error checking schema version: ${error}`);
      }

      // Validate indexes
      const expectedIndexes = [
        'idx_articles_is_archived',
        'idx_articles_is_favorite',
        'idx_articles_is_read',
        'idx_articles_created_at',
        'idx_sync_metadata_status',
      ];

      for (const indexName of expectedIndexes) {
        try {
          const result = await this.db.executeSql(
            "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
            [indexName]
          );

          if (result.rows.length === 0) {
            errors.push(`Index '${indexName}' not found`);
          }
        } catch (error) {
          errors.push(`Error checking index '${indexName}': ${error}`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        tables,
      };
    } catch (error) {
      errors.push(`Schema validation failed: ${error}`);
      return { isValid: false, errors, tables };
    }
  }

  async validateConstraints(): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Test foreign key constraints
      await this.db.executeSql('PRAGMA foreign_keys');

      // Test article insertion constraints
      try {
        await this.db.executeSql(
          'INSERT INTO articles (id, title, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [
            'test-id',
            'Test Article',
            'https://example.com',
            Date.now(),
            Date.now(),
          ]
        );

        // Clean up test data
        await this.db.executeSql('DELETE FROM articles WHERE id = ?', [
          'test-id',
        ]);
      } catch (error) {
        errors.push(`Article insertion constraint test failed: ${error}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Constraint validation failed: ${error}`);
      return { isValid: false, errors };
    }
  }

  async getTableInfo(tableName: string): Promise<any[]> {
    try {
      const result = await this.db.executeSql(
        `PRAGMA table_info(${tableName})`
      );
      const columns = [];

      for (let i = 0; i < result.rows.length; i++) {
        columns.push(result.rows.item(i));
      }

      return columns;
    } catch (error) {
      console.error(`Error getting table info for ${tableName}:`, error);
      return [];
    }
  }

  async performFullValidation(): Promise<{
    schema: { isValid: boolean; errors: string[]; tables: string[] };
    constraints: { isValid: boolean; errors: string[] };
    stats: DatabaseStats | null;
  }> {
    console.log('Starting comprehensive database validation...');

    const schema = await this.validateSchema();
    const constraints = await this.validateConstraints();

    let stats: DatabaseStats | null = null;
    try {
      stats = await this.db.getStats();
    } catch (error) {
      console.warn('Could not retrieve database stats:', error);
    }

    return { schema, constraints, stats };
  }
}

export const validator = new DatabaseValidator();
