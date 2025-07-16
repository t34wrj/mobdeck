/**
 * Unit Tests for DatabaseService
 *
 * Tests cover:
 * - Connection management
 * - CRUD operations for all entities
 * - Transaction handling
 * - Error scenarios
 * - Search functionality
 * - Utility operations
 */

// Set __DEV__ global before importing DatabaseService
(global as any).__DEV__ = false;

// Mock react-native-sqlite-storage before any imports
jest.mock('react-native-sqlite-storage', () => {
  return {
    DEBUG: jest.fn(),
    enablePromise: jest.fn(),
    openDatabase: jest.fn(),
    default: {
      DEBUG: jest.fn(),
      enablePromise: jest.fn(),
      openDatabase: jest.fn(),
    },
  };
});

import {
  DBArticle,
  DBLabel,
} from '../../src/types/database';

// Mock console methods to avoid noise in tests
const originalConsole = console;
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
});

describe('DatabaseService', () => {
  let DatabaseService: any;
  let dbService: any;
  let SQLite: any;
  let mockDb: any;

  beforeEach(() => {
    // Clear module cache to reset singleton
    jest.resetModules();

    // Re-require modules
    SQLite = require('react-native-sqlite-storage');

    // Set up default mock database
    mockDb = {
      executeSql: jest.fn().mockResolvedValue([
        {
          rows: { length: 0 },
          rowsAffected: 1,
          insertId: 1,
        },
      ]),
      transaction: jest.fn((callback, errorCallback, successCallback) => {
        const mockTx = {
          executeSql: jest.fn((sql, params, success, _error) => {
            if (success) {
              success(mockTx, {
                rows: { length: 0 },
                rowsAffected: 1,
              });
            }
          }),
        };
        try {
          callback(mockTx);
          if (successCallback) successCallback();
        } catch (err) {
          if (errorCallback) errorCallback(err);
        }
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };

    SQLite.openDatabase.mockResolvedValue(mockDb);

    // Import DatabaseService after mocks are set up
    const module = require('../../src/services/DatabaseService');
    DatabaseService = module.default;
    dbService = DatabaseService;

    jest.clearAllMocks();
  });

  afterEach(async () => {
    try {
      if (dbService && dbService.isConnected()) {
        await dbService.close();
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Connection Management', () => {
    it('should initialize database successfully', async () => {
      await dbService.initialize();

      expect(dbService.isConnected()).toBe(true);
      expect(SQLite.openDatabase).toHaveBeenCalledWith({
        name: 'mobdeck.db',
        location: 'default',
        createFromLocation: undefined,
      });
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        'PRAGMA foreign_keys = ON;'
      );
    });

    it('should handle initialization errors', async () => {
      SQLite.openDatabase.mockRejectedValue(new Error('Connection failed'));

      await expect(dbService.initialize()).rejects.toThrow(
        'Failed to initialize database'
      );
    });

    it('should close database connection', async () => {
      await dbService.initialize();
      await dbService.close();

      expect(mockDb.close).toHaveBeenCalled();
      expect(dbService.isConnected()).toBe(false);
    });

    it('should handle multiple initialization calls', async () => {
      await dbService.initialize();
      await dbService.initialize(); // Should not throw

      expect(SQLite.openDatabase).toHaveBeenCalledTimes(1);
    });
  });

  describe('Article Operations', () => {
    const mockArticle: Omit<DBArticle, 'created_at' | 'updated_at'> = {
      id: 'test-article-1',
      title: 'Test Article',
      summary: 'Test summary',
      content: 'Test content',
      url: 'https://example.com/article',
      image_url: null,
      read_time: 5,
      is_archived: 0,
      is_favorite: 0,
      is_read: 0,
      source_url: null,
      synced_at: null,
      is_modified: 0,
      deleted_at: null,
    };

    beforeEach(async () => {
      await dbService.initialize();
    });

    it('should create article successfully', async () => {
      const result = await dbService.createArticle(mockArticle);

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockArticle.id);
      expect(result.rowsAffected).toBe(1);
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO articles'),
        expect.arrayContaining([mockArticle.id, mockArticle.title])
      );
    });

    it('should get article by id', async () => {
      mockDb.executeSql.mockResolvedValueOnce([
        {
          rows: {
            length: 1,
            item: jest.fn().mockReturnValue({
              ...mockArticle,
              created_at: 1640995200,
              updated_at: 1640995200,
            }),
          },
        },
      ]);

      const result = await dbService.getArticle('test-article-1');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-article-1');
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM articles WHERE id = ?'),
        ['test-article-1']
      );
    });

    it('should return error when article not found', async () => {
      mockDb.executeSql.mockResolvedValueOnce([
        {
          rows: { length: 0 },
        },
      ]);

      const result = await dbService.getArticle('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Article not found');
    });

    it('should update article successfully', async () => {
      const updates = { title: 'Updated Title', is_favorite: 1 };
      const result = await dbService.updateArticle('test-article-1', updates);

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE articles SET'),
        expect.arrayContaining(['Updated Title', 1])
      );
    });

    it('should delete article (soft delete)', async () => {
      const result = await dbService.deleteArticle('test-article-1', true);

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE articles SET deleted_at = ?'),
        expect.any(Array)
      );
    });

    it('should delete article (hard delete)', async () => {
      const result = await dbService.deleteArticle('test-article-1', false);

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
      expect(mockDb.executeSql).toHaveBeenCalledWith(
        'DELETE FROM articles WHERE id = ?',
        ['test-article-1']
      );
    });

    it('should get articles with filters', async () => {
      mockDb.executeSql
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({ count: 5 }),
            },
          },
        ]) // count query
        .mockResolvedValueOnce([
          {
            rows: {
              length: 2,
              item: jest
                .fn()
                .mockReturnValueOnce({
                  ...mockArticle,
                  id: 'article-1',
                  created_at: 1640995200,
                  updated_at: 1640995200,
                })
                .mockReturnValueOnce({
                  ...mockArticle,
                  id: 'article-2',
                  created_at: 1640995200,
                  updated_at: 1640995200,
                }),
            },
          },
        ]); // data query

      const result = await dbService.getArticles({
        limit: 10,
        offset: 0,
        isArchived: false,
      });

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(2);
      expect(result.data?.totalCount).toBe(5);
      expect(result.data?.hasMore).toBe(false);
    });

    it('should search articles using FTS', async () => {
      mockDb.executeSql
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({
                ...mockArticle,
                id: 'found-article',
                created_at: 1640995200,
                updated_at: 1640995200,
              }),
            },
          },
        ]) // search query
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({ count: 1 }),
            },
          },
        ]); // count query

      const result = await dbService.searchArticles('test query', {
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.totalCount).toBe(1);
    });
  });

  describe('Label Operations', () => {
    const mockLabel: Omit<DBLabel, 'id' | 'created_at' | 'updated_at'> = {
      name: 'Test Label',
      color: '#FF0000',
      synced_at: null,
    };

    beforeEach(async () => {
      await dbService.initialize();
    });

    it('should create label successfully', async () => {
      const result = await dbService.createLabel(mockLabel);

      expect(result.success).toBe(true);
      expect(result.data).toBe(1);
      expect(result.rowsAffected).toBe(1);
    });

    it('should get label by id', async () => {
      mockDb.executeSql.mockResolvedValueOnce([
        {
          rows: {
            length: 1,
            item: jest.fn().mockReturnValue({
              ...mockLabel,
              id: 1,
              created_at: 1640995200,
              updated_at: 1640995200,
            }),
          },
        },
      ]);

      const result = await dbService.getLabel(1);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(1);
      expect(result.data?.name).toBe('Test Label');
    });

    it('should update label successfully', async () => {
      const updates = { name: 'Updated Label', color: '#00FF00' };
      const result = await dbService.updateLabel(1, updates);

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });

    it('should delete label successfully', async () => {
      const result = await dbService.deleteLabel(1);

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });

    it('should get labels with pagination', async () => {
      mockDb.executeSql
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({ count: 3 }),
            },
          },
        ]) // count query
        .mockResolvedValueOnce([
          {
            rows: {
              length: 2,
              item: jest
                .fn()
                .mockReturnValueOnce({
                  ...mockLabel,
                  id: 1,
                  created_at: 1640995200,
                  updated_at: 1640995200,
                })
                .mockReturnValueOnce({
                  ...mockLabel,
                  id: 2,
                  name: 'Label 2',
                  created_at: 1640995200,
                  updated_at: 1640995200,
                }),
            },
          },
        ]); // data query

      const result = await dbService.getLabels({ limit: 2, offset: 0 });

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(2);
      expect(result.data?.totalCount).toBe(3);
      expect(result.data?.hasMore).toBe(true);
    });
  });

  describe('Article-Label Relationships', () => {
    beforeEach(async () => {
      await dbService.initialize();
    });

    it('should add label to article', async () => {
      const result = await dbService.addLabelToArticle('article-1', 1);

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });

    it('should remove label from article', async () => {
      const result = await dbService.removeLabelFromArticle('article-1', 1);

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });

    it('should get article labels', async () => {
      mockDb.executeSql.mockResolvedValueOnce([
        {
          rows: {
            length: 2,
            item: jest
              .fn()
              .mockReturnValueOnce({
                id: 1,
                name: 'Label 1',
                color: '#FF0000',
                created_at: 1640995200,
                updated_at: 1640995200,
                synced_at: null,
              })
              .mockReturnValueOnce({
                id: 2,
                name: 'Label 2',
                color: '#00FF00',
                created_at: 1640995200,
                updated_at: 1640995200,
                synced_at: null,
              }),
          },
        },
      ]);

      const result = await dbService.getArticleLabels('article-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should get label articles', async () => {
      mockDb.executeSql.mockResolvedValueOnce([
        {
          rows: {
            length: 1,
            item: jest.fn().mockReturnValue({
              id: 'article-1',
              title: 'Test Article',
              summary: 'Test summary',
              content: 'Test content',
              url: 'https://example.com',
              image_url: null,
              read_time: 5,
              is_archived: 0,
              is_favorite: 0,
              is_read: 0,
              source_url: null,
              created_at: 1640995200,
              updated_at: 1640995200,
              synced_at: null,
              is_modified: 0,
              deleted_at: null,
            }),
          },
        },
      ]);

      const result = await dbService.getLabelArticles(1);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('Sync Metadata Operations', () => {
    const mockSyncMetadata = {
      entity_type: 'article',
      entity_id: 'article-1',
      operation: 'create',
      local_timestamp: 1640995200,
      server_timestamp: null,
      sync_status: 'pending',
      conflict_resolution: null,
      retry_count: 0,
      error_message: null,
    };

    beforeEach(async () => {
      await dbService.initialize();
    });

    it('should create sync metadata successfully', async () => {
      const result = await dbService.createSyncMetadata(mockSyncMetadata);

      expect(result.success).toBe(true);
      expect(result.data).toBe(1);
      expect(result.rowsAffected).toBe(1);
    });

    it('should update sync metadata successfully', async () => {
      const updates = {
        sync_status: 'completed',
        server_timestamp: 1640995300,
      };
      const result = await dbService.updateSyncMetadata(1, updates);

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });

    it('should get sync metadata with filters', async () => {
      mockDb.executeSql
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({ count: 2 }),
            },
          },
        ]) // count query
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({
                ...mockSyncMetadata,
                id: 1,
                created_at: 1640995200,
                updated_at: 1640995200,
              }),
            },
          },
        ]); // data query

      const result = await dbService.getSyncMetadata({
        entityType: 'article',
        syncStatus: 'pending',
      });

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.totalCount).toBe(2);
    });

    it('should delete sync metadata successfully', async () => {
      const result = await dbService.deleteSyncMetadata(1);

      expect(result.success).toBe(true);
      expect(result.rowsAffected).toBe(1);
    });
  });

  describe('Utility Operations', () => {
    beforeEach(async () => {
      await dbService.initialize();
    });

    it('should get database statistics', async () => {
      mockDb.executeSql
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({ count: 10 }),
            },
          },
        ]) // total articles
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({ count: 2 }),
            },
          },
        ]) // archived
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({ count: 5 }),
            },
          },
        ]) // favorites
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({ count: 3 }),
            },
          },
        ]) // unread
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({ count: 8 }),
            },
          },
        ]) // labels
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({ count: 1 }),
            },
          },
        ]) // pending sync
        .mockResolvedValueOnce([
          {
            rows: {
              length: 1,
              item: jest.fn().mockReturnValue({ last_sync: 1640995200 }), // eslint-disable-line camelcase
            },
          },
        ]); // last sync

      const result = await dbService.getStats();

      expect(result.success).toBe(true);
      expect(result.data?.totalArticles).toBe(10);
      expect(result.data?.archivedArticles).toBe(2);
      expect(result.data?.favoriteArticles).toBe(5);
      expect(result.data?.unreadArticles).toBe(3);
      expect(result.data?.totalLabels).toBe(8);
      expect(result.data?.pendingSyncItems).toBe(1);
      expect(result.data?.lastSyncAt).toBe(1640995200);
    });

    it('should vacuum database successfully', async () => {
      // Clear previous calls from initialization
      mockDb.executeSql.mockClear();

      const result = await dbService.vacuum();

      expect(result.success).toBe(true);
      expect(mockDb.executeSql).toHaveBeenCalledWith('VACUUM;', []);
    });

    it('should get current database version', async () => {
      const result = await dbService.getCurrentVersion();

      // Since there's no schema_version data in our mock, it returns 0
      expect(result).toBe(0);
    });
  });

  describe('Transaction Support', () => {
    beforeEach(async () => {
      await dbService.initialize();
    });

    it('should execute operations in transaction', async () => {
      mockDb.transaction.mockImplementation(
        (callback: any, errorCallback: any, successCallback: any) => {
          const mockTx = {
            executeSql: jest.fn((sql, params, success) => {
              success(mockTx, { rows: { length: 0 }, rowsAffected: 1 });
            }),
          };
          callback(mockTx);
          if (successCallback) successCallback();
        }
      );

      const result = await dbService.executeInTransaction(async (ctx: any) => {
        await ctx.executeSql(
          'INSERT INTO articles (id, title, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          ['test-1', 'Test', 'https://example.com', 1640995200, 1640995200]
        );
        await ctx.executeSql(
          'INSERT INTO articles (id, title, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          ['test-2', 'Test 2', 'https://example.com/2', 1640995200, 1640995200]
        );
        return { success: true };
      });

      expect(result.success).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      mockDb.transaction.mockImplementation(
        (callback: any, errorCallback: any) => {
          const mockTx = {
            executeSql: jest.fn((sql, params, success, _error) => {
              if (sql.includes('FAIL')) {
                const sqlError = new Error('SQL Error');
                if (error) error(mockTx, sqlError);
                return;
              } else {
                if (success) success(mockTx, { rows: { length: 0 }, rowsAffected: 1 });
              }
            }),
          };
          try {
            callback(mockTx);
          } catch (err) {
            if (errorCallback) errorCallback(err);
          }
        }
      );

      await expect(
        dbService.executeInTransaction(async (ctx: any) => {
          await ctx.executeSql(
            'INSERT INTO articles (id, title, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            ['test-1', 'Test', 'https://example.com', 1640995200, 1640995200]
          );
          await ctx.executeSql('FAIL');
          return { success: true };
        })
      ).rejects.toThrow('Transaction failed');
    }, 15000);
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      SQLite.openDatabase.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(dbService.initialize()).rejects.toThrow(
        'Failed to initialize database'
      );
    });

    it('should handle SQL execution errors', async () => {
      await dbService.initialize();

      mockDb.executeSql.mockRejectedValue(new Error('SQL execution failed'));

      const result = await dbService.getArticle('test-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unable to save data locally');
    });

    it('should handle constraint violations', async () => {
      await dbService.initialize();

      mockDb.executeSql.mockRejectedValue(
        new Error('UNIQUE constraint failed')
      );

      const result = await dbService.createLabel({
        name: 'Duplicate',
        color: '#000000',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create label');
    });
  });

  describe('Additional Coverage Tests', () => {
    beforeEach(async () => {
      await dbService.initialize();
    });

    describe('Schema Initialization', () => {
      it('should handle FTS5 initialization failure gracefully', async () => {
        // Mock executeSql to fail on FTS5 queries
        const originalMock = mockDb.executeSql;
        mockDb.executeSql = jest.fn().mockImplementation(sql => {
          if (sql.includes('FTS5') || sql.includes('fts5')) {
            return Promise.reject(new Error('FTS5 not supported'));
          }
          return originalMock(sql);
        });

        // Should not throw even if FTS5 fails
        await expect(dbService.initialize()).resolves.not.toThrow();
      });
    });

    describe('Search Fallback', () => {
      it('should fallback to LIKE search when FTS5 search fails', async () => {
        // First call will fail (FTS5 search)
        mockDb.executeSql
          .mockRejectedValueOnce(new Error('no such table: articles_fts'))
          // Then succeed with LIKE search
          .mockResolvedValueOnce([
            {
              rows: {
                length: 1,
                item: jest.fn().mockReturnValue({
                  id: 'article-1',
                  title: 'Test Article',
                  created_at: 1640995200,
                  updated_at: 1640995200,
                }),
              },
            },
          ])
          .mockResolvedValueOnce([
            {
              rows: {
                item: jest.fn().mockReturnValue({ count: 1 }),
              },
            },
          ]);

        const result = await dbService.searchArticles('test');

        expect(result.success).toBe(true);
        expect(result.data?.items).toHaveLength(1);
        // Verify LIKE query was used
        expect(mockDb.executeSql).toHaveBeenCalledWith(
          expect.stringContaining('LIKE ?'),
          expect.arrayContaining(['%test%'])
        );
      });
    });

    describe('clearAllData', () => {
      it('should clear all data from database tables', async () => {
        const result = await dbService.clearAllData();

        expect(result.success).toBe(true);
        expect(mockDb.transaction).toHaveBeenCalled();
      });

      it('should handle clearAllData errors', async () => {
        mockDb.transaction.mockImplementation((_callback: any, error: any) => {
          error(new Error('Clear data failed'));
        });

        const result = await dbService.clearAllData();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to clear all data');
      });
    });

    describe('Migration Error Handling', () => {
      it('should handle migration errors', async () => {
        mockDb.executeSql.mockResolvedValueOnce([
          {
            rows: { item: () => ({ version: 1 }) },
          },
        ]);

        // Mock transaction to immediately call error callback
        mockDb.transaction.mockImplementation((callback: any, errorCallback: any) => {
          try {
            const mockTx = {
              executeSql: jest.fn().mockImplementation(() => {
                throw new Error('Migration failed');
              }),
            };
            callback(mockTx);
          } catch (err) {
            if (errorCallback) errorCallback(err);
          }
        });

        const failingMigration = {
          version: 2,
          description: 'Failing migration',
          up: jest.fn().mockImplementation(() => {
            throw new Error('Migration failed');
          }),
          down: jest.fn(),
        };

        const result = await dbService.runMigrations([failingMigration]);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Migration failed');
      }, 15000);

      it('should handle getCurrentVersion error', async () => {
        mockDb.executeSql.mockRejectedValueOnce(new Error('Table not found'));

        const version = await dbService.getCurrentVersion();

        expect(version).toBe(0);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty label filters', async () => {
        mockDb.executeSql
          .mockResolvedValueOnce([{ rows: { item: () => ({ count: 0 }) } }])
          .mockResolvedValueOnce([{ rows: { length: 0 } }]);

        const result = await dbService.getLabels({});

        expect(result.success).toBe(true);
        expect(result.data?.items).toHaveLength(0);
      });

      it('should handle article updates with no changes', async () => {
        // Clear any previous SQL calls (like schema initialization)
        mockDb.executeSql.mockClear();

        const result = await dbService.updateArticle('test-id', {});

        expect(result.success).toBe(true);
        expect(result.rowsAffected).toBe(0);
        // Should not execute any SQL
        expect(mockDb.executeSql).not.toHaveBeenCalled();
      });

      it('should handle label updates with no changes', async () => {
        const result = await dbService.updateLabel(1, {});

        expect(result.success).toBe(true);
        expect(result.rowsAffected).toBe(0);
      });

      it('should handle sync metadata updates with no changes', async () => {
        const result = await dbService.updateSyncMetadata(1, {});

        expect(result.success).toBe(true);
        expect(result.rowsAffected).toBe(0);
      });
    });

    describe('Database Operations without connection', () => {
      beforeEach(async () => {
        await dbService.close();
      });

      it('should handle executeInTransaction without connection', async () => {
        await expect(
          dbService.executeInTransaction(async () => {})
        ).rejects.toThrow();
      });
    });

    describe('Backup functionality', () => {
      it('should return not implemented for backup', async () => {
        const result = await dbService.backup('/test/path');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not implemented');
      });
    });
  });
});

describe('DatabaseUtils', () => {
  // Re-import to get the utility functions
  const {
    DatabaseUtilityFunctions: DatabaseUtils,
  } = require('../../src/services/DatabaseService');

  describe('Article Conversion', () => {
    it('should convert DBArticle to Article', () => {
      const dbArticle: DBArticle = {
        id: 'test-1',
        title: 'Test Article',
        summary: 'Test summary',
        content: 'Test content',
        url: 'https://example.com',
        image_url: null,
        read_time: 5,
        is_archived: 1,
        is_favorite: 0,
        is_read: 1,
        source_url: null,
        created_at: 1640995200,
        updated_at: 1640995300,
        synced_at: 1640995400,
        is_modified: 0,
        deleted_at: null,
      };

      const article = DatabaseUtils.convertDBArticleToArticle(dbArticle);

      expect(article.id).toBe('test-1');
      expect(article.isArchived).toBe(true);
      expect(article.isFavorite).toBe(false);
      expect(article.isRead).toBe(true);
      expect(article.isModified).toBe(false);
      expect(article.createdAt).toBe('2022-01-01T00:00:00.000Z');
      expect(article.updatedAt).toBe('2022-01-01T00:01:40.000Z');
      expect(article.syncedAt).toBe('2022-01-01T00:03:20.000Z');
      expect(article.deletedAt).toBeUndefined();
    });

    it('should convert Article to DBArticle', () => {
      const article = {
        id: 'test-1',
        title: 'Test Article',
        summary: 'Test summary',
        content: 'Test content',
        url: 'https://example.com',
        image_url: null,
        read_time: 5,
        isArchived: true,
        isFavorite: false,
        isRead: true,
        isModified: false,
        source_url: null,
        createdAt: new Date(1640995200000),
        updatedAt: new Date(1640995300000),
        syncedAt: new Date(1640995400000),
        deletedAt: undefined,
      } as any;

      const dbArticle = DatabaseUtils.convertArticleToDBArticle(article);

      expect(dbArticle.id).toBe('test-1');
      expect(dbArticle.is_archived).toBe(1);
      expect(dbArticle.is_favorite).toBe(0);
      expect(dbArticle.is_read).toBe(1);
      expect(dbArticle.is_modified).toBe(0);
      expect(dbArticle.created_at).toBe(1640995200);
      expect(dbArticle.updated_at).toBe(1640995300);
      expect(dbArticle.synced_at).toBe(1640995400);
      expect(dbArticle.deleted_at).toBeNull();
    });
  });

  describe('Label Conversion', () => {
    it('should convert DBLabel to Label', () => {
      const dbLabel: DBLabel = {
        id: 1,
        name: 'Test Label',
        color: '#FF0000',
        created_at: 1640995200,
        updated_at: 1640995300,
        synced_at: 1640995400,
      };

      const label = DatabaseUtils.convertDBLabelToLabel(dbLabel);

      expect(label.id).toBe(1);
      expect(label.name).toBe('Test Label');
      expect(label.color).toBe('#FF0000');
      expect(label.createdAt).toBeInstanceOf(Date);
      expect(label.updatedAt).toBeInstanceOf(Date);
      expect(label.syncedAt).toBeInstanceOf(Date);
    });

    it('should convert Label to DBLabel', () => {
      const label = {
        id: 1,
        name: 'Test Label',
        color: '#FF0000',
        createdAt: new Date(1640995200000),
        updatedAt: new Date(1640995300000),
        syncedAt: new Date(1640995400000),
      } as any;

      const dbLabel = DatabaseUtils.convertLabelToDBLabel(label);

      expect(dbLabel.id).toBe(1);
      expect(dbLabel.name).toBe('Test Label');
      expect(dbLabel.color).toBe('#FF0000');
      expect(dbLabel.created_at).toBe(1640995200);
      expect(dbLabel.updated_at).toBe(1640995300);
      expect(dbLabel.synced_at).toBe(1640995400);
    });
  });

  describe('Utility Functions', () => {
    it('should create current timestamp', () => {
      const timestamp = DatabaseUtils.createTimestamp();
      const now = Math.floor(Date.now() / 1000);

      expect(timestamp).toBeCloseTo(now, -1); // Within 10 seconds
    });

    it('should format timestamp to date', () => {
      const timestamp = 1640995200;
      const date = DatabaseUtils.formatTimestamp(timestamp);

      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBe(1640995200000);
    });

    it('should handle zero timestamps', () => {
      const date = DatabaseUtils.formatTimestamp(0);
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBe(0);
    });
  });
});
