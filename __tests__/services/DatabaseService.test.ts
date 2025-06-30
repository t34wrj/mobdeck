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

import DatabaseService, { DatabaseUtilityFunctions as DatabaseUtils } from '../../src/services/DatabaseService';
import { 
    DBArticle, 
    DBLabel, 
    DatabaseOperationResult, 
    DatabaseErrorCode,
    DatabaseStats
} from '../../src/types/database';

// Mock react-native-sqlite-storage
jest.mock('react-native-sqlite-storage', () => {
    const mockDatabase = {
        executeSql: jest.fn(),
        transaction: jest.fn(),
        readTransaction: jest.fn(),
        close: jest.fn(),
    };

    const mockResult = {
        rows: {
            length: 0,
            item: jest.fn(),
            raw: jest.fn().mockReturnValue([]),
        },
        rowsAffected: 1,
        insertId: 1,
    };

    return {
        DEBUG: jest.fn(),
        enablePromise: jest.fn(),
        openDatabase: jest.fn().mockResolvedValue(mockDatabase),
        SQLiteDatabase: mockDatabase,
        __esModule: true,
        default: {
            DEBUG: jest.fn(),
            enablePromise: jest.fn(),
            openDatabase: jest.fn().mockResolvedValue(mockDatabase),
        },
    };
});

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
    let dbService: typeof DatabaseService;

    beforeEach(() => {
        // Reset the singleton instance for each test
        dbService = DatabaseService;
        jest.clearAllMocks();
    });

    afterEach(async () => {
        if (dbService.isConnected()) {
            await dbService.close();
        }
    });

    describe('Connection Management', () => {
        it('should initialize database successfully', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = {
                executeSql: jest.fn().mockResolvedValue([{ rows: { length: 0 } }]),
                transaction: jest.fn(),
                close: jest.fn(),
            };
            SQLite.openDatabase.mockResolvedValue(mockDb);

            await dbService.initialize();
            expect(dbService.isConnected()).toBe(true);
            expect(SQLite.openDatabase).toHaveBeenCalledWith({
                name: 'mobdeck.db',
                location: 'default',
                createFromLocation: undefined,
            });
        });

        it('should handle initialization errors', async () => {
            const SQLite = require('react-native-sqlite-storage');
            SQLite.openDatabase.mockRejectedValue(new Error('Connection failed'));

            await expect(dbService.initialize()).rejects.toThrow('Failed to initialize database');
        });

        it('should close database connection', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = {
                executeSql: jest.fn().mockResolvedValue([{ rows: { length: 0 } }]),
                close: jest.fn().mockResolvedValue(undefined),
            };
            SQLite.openDatabase.mockResolvedValue(mockDb);

            await dbService.initialize();
            await dbService.close();
            
            expect(mockDb.close).toHaveBeenCalled();
            expect(dbService.isConnected()).toBe(false);
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
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = {
                executeSql: jest.fn().mockResolvedValue([{ 
                    rows: { length: 0 }, 
                    rowsAffected: 1,
                    insertId: 1 
                }]),
                transaction: jest.fn(),
                close: jest.fn(),
            };
            SQLite.openDatabase.mockResolvedValue(mockDb);
            await dbService.initialize();
        });

        it('should create article successfully', async () => {
            const result = await dbService.createArticle(mockArticle);
            
            expect(result.success).toBe(true);
            expect(result.data).toBe(mockArticle.id);
            expect(result.rowsAffected).toBe(1);
        });

        it('should get article by id', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = SQLite.openDatabase();
            mockDb.executeSql.mockResolvedValue([{
                rows: {
                    length: 1,
                    item: jest.fn().mockReturnValue({ ...mockArticle, created_at: 1640995200, updated_at: 1640995200 })
                }
            }]);

            const result = await dbService.getArticle('test-article-1');
            
            expect(result.success).toBe(true);
            expect(result.data?.id).toBe('test-article-1');
        });

        it('should return error when article not found', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = SQLite.openDatabase();
            mockDb.executeSql.mockResolvedValue([{
                rows: { length: 0 }
            }]);

            const result = await dbService.getArticle('non-existent');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Article not found');
        });

        it('should update article successfully', async () => {
            const updates = { title: 'Updated Title', is_favorite: 1 };
            const result = await dbService.updateArticle('test-article-1', updates);
            
            expect(result.success).toBe(true);
            expect(result.rowsAffected).toBe(1);
        });

        it('should delete article (soft delete)', async () => {
            const result = await dbService.deleteArticle('test-article-1', true);
            
            expect(result.success).toBe(true);
            expect(result.rowsAffected).toBe(1);
        });

        it('should get articles with filters', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = SQLite.openDatabase();
            mockDb.executeSql
                .mockResolvedValueOnce([{ rows: { item: jest.fn().mockReturnValue({ count: 5 }) } }]) // count query
                .mockResolvedValueOnce([{ 
                    rows: { 
                        length: 2,
                        item: jest.fn()
                            .mockReturnValueOnce({ ...mockArticle, id: 'article-1', created_at: 1640995200, updated_at: 1640995200 })
                            .mockReturnValueOnce({ ...mockArticle, id: 'article-2', created_at: 1640995200, updated_at: 1640995200 })
                    } 
                }]); // data query

            const result = await dbService.getArticles({ 
                limit: 10, 
                offset: 0, 
                isArchived: false 
            });
            
            expect(result.success).toBe(true);
            expect(result.data?.items).toHaveLength(2);
            expect(result.data?.totalCount).toBe(5);
            expect(result.data?.hasMore).toBe(true);
        });

        it('should search articles using FTS', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = SQLite.openDatabase();
            mockDb.executeSql
                .mockResolvedValueOnce([{ 
                    rows: { 
                        length: 1,
                        item: jest.fn().mockReturnValue({ ...mockArticle, id: 'found-article', created_at: 1640995200, updated_at: 1640995200 })
                    } 
                }]) // search query
                .mockResolvedValueOnce([{ rows: { item: jest.fn().mockReturnValue({ count: 1 }) } }]); // count query

            const result = await dbService.searchArticles('test query', { limit: 10 });
            
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
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = {
                executeSql: jest.fn().mockResolvedValue([{ 
                    rows: { length: 0 }, 
                    rowsAffected: 1,
                    insertId: 1 
                }]),
                transaction: jest.fn(),
                close: jest.fn(),
            };
            SQLite.openDatabase.mockResolvedValue(mockDb);
            await dbService.initialize();
        });

        it('should create label successfully', async () => {
            const result = await dbService.createLabel(mockLabel);
            
            expect(result.success).toBe(true);
            expect(result.data).toBe(1);
            expect(result.rowsAffected).toBe(1);
        });

        it('should get label by id', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = SQLite.openDatabase();
            mockDb.executeSql.mockResolvedValue([{
                rows: {
                    length: 1,
                    item: jest.fn().mockReturnValue({ 
                        ...mockLabel, 
                        id: 1, 
                        created_at: 1640995200, 
                        updated_at: 1640995200 
                    })
                }
            }]);

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
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = SQLite.openDatabase();
            mockDb.executeSql
                .mockResolvedValueOnce([{ rows: { item: jest.fn().mockReturnValue({ count: 3 }) } }]) // count query
                .mockResolvedValueOnce([{ 
                    rows: { 
                        length: 2,
                        item: jest.fn()
                            .mockReturnValueOnce({ ...mockLabel, id: 1, created_at: 1640995200, updated_at: 1640995200 })
                            .mockReturnValueOnce({ ...mockLabel, id: 2, name: 'Label 2', created_at: 1640995200, updated_at: 1640995200 })
                    } 
                }]); // data query

            const result = await dbService.getLabels({ limit: 2, offset: 0 });
            
            expect(result.success).toBe(true);
            expect(result.data?.items).toHaveLength(2);
            expect(result.data?.totalCount).toBe(3);
            expect(result.data?.hasMore).toBe(true);
        });
    });

    describe('Article-Label Relationships', () => {
        beforeEach(async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = {
                executeSql: jest.fn().mockResolvedValue([{ 
                    rows: { length: 0 }, 
                    rowsAffected: 1 
                }]),
                transaction: jest.fn(),
                close: jest.fn(),
            };
            SQLite.openDatabase.mockResolvedValue(mockDb);
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
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = SQLite.openDatabase();
            mockDb.executeSql.mockResolvedValue([{
                rows: {
                    length: 2,
                    item: jest.fn()
                        .mockReturnValueOnce({ id: 1, name: 'Label 1', color: '#FF0000', created_at: 1640995200, updated_at: 1640995200, synced_at: null })
                        .mockReturnValueOnce({ id: 2, name: 'Label 2', color: '#00FF00', created_at: 1640995200, updated_at: 1640995200, synced_at: null })
                }
            }]);

            const result = await dbService.getArticleLabels('article-1');
            
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(2);
        });

        it('should get label articles', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = SQLite.openDatabase();
            mockDb.executeSql.mockResolvedValue([{
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
                        deleted_at: null
                    })
                }
            }]);

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
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = {
                executeSql: jest.fn().mockResolvedValue([{ 
                    rows: { length: 0 }, 
                    rowsAffected: 1,
                    insertId: 1 
                }]),
                transaction: jest.fn(),
                close: jest.fn(),
            };
            SQLite.openDatabase.mockResolvedValue(mockDb);
            await dbService.initialize();
        });

        it('should create sync metadata successfully', async () => {
            const result = await dbService.createSyncMetadata(mockSyncMetadata);
            
            expect(result.success).toBe(true);
            expect(result.data).toBe(1);
            expect(result.rowsAffected).toBe(1);
        });

        it('should update sync metadata successfully', async () => {
            const updates = { sync_status: 'completed', server_timestamp: 1640995300 };
            const result = await dbService.updateSyncMetadata(1, updates);
            
            expect(result.success).toBe(true);
            expect(result.rowsAffected).toBe(1);
        });

        it('should get sync metadata with filters', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = SQLite.openDatabase();
            mockDb.executeSql
                .mockResolvedValueOnce([{ rows: { item: jest.fn().mockReturnValue({ count: 2 }) } }]) // count query
                .mockResolvedValueOnce([{ 
                    rows: { 
                        length: 1,
                        item: jest.fn().mockReturnValue({ 
                            ...mockSyncMetadata, 
                            id: 1, 
                            created_at: 1640995200, 
                            updated_at: 1640995200 
                        })
                    } 
                }]); // data query

            const result = await dbService.getSyncMetadata({ 
                entityType: 'article', 
                syncStatus: 'pending' 
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
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = {
                executeSql: jest.fn(),
                transaction: jest.fn(),
                close: jest.fn(),
            };
            SQLite.openDatabase.mockResolvedValue(mockDb);
            await dbService.initialize();
        });

        it('should get database statistics', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = SQLite.openDatabase();
            mockDb.executeSql
                .mockResolvedValueOnce([{ rows: { item: jest.fn().mockReturnValue({ count: 10 }) } }]) // total articles
                .mockResolvedValueOnce([{ rows: { item: jest.fn().mockReturnValue({ count: 2 }) } }]) // archived
                .mockResolvedValueOnce([{ rows: { item: jest.fn().mockReturnValue({ count: 5 }) } }]) // favorites
                .mockResolvedValueOnce([{ rows: { item: jest.fn().mockReturnValue({ count: 3 }) } }]) // unread
                .mockResolvedValueOnce([{ rows: { item: jest.fn().mockReturnValue({ count: 8 }) } }]) // labels
                .mockResolvedValueOnce([{ rows: { item: jest.fn().mockReturnValue({ count: 1 }) } }]) // pending sync
                .mockResolvedValueOnce([{ rows: { item: jest.fn().mockReturnValue({ last_sync: 1640995200 }) } }]); // last sync

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
            const result = await dbService.vacuum();
            
            expect(result.success).toBe(true);
        });
    });

    describe('Transaction Support', () => {
        beforeEach(async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = {
                executeSql: jest.fn().mockResolvedValue([{ rows: { length: 0 } }]),
                transaction: jest.fn((callback, errorCallback) => {
                    const mockTx = {
                        executeSql: jest.fn((sql, params, success) => {
                            success(mockTx, { rows: { length: 0 }, rowsAffected: 1 });
                        })
                    };
                    try {
                        callback(mockTx);
                    } catch (error) {
                        if (errorCallback) errorCallback(error);
                    }
                }),
                close: jest.fn(),
            };
            SQLite.openDatabase.mockResolvedValue(mockDb);
            await dbService.initialize();
        });

        it('should execute operations in transaction', async () => {
            const result = await dbService.executeInTransaction(async (ctx) => {
                await ctx.executeSql('INSERT INTO articles (id, title, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
                    ['test-1', 'Test', 'https://example.com', 1640995200, 1640995200]);
                await ctx.executeSql('INSERT INTO articles (id, title, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
                    ['test-2', 'Test 2', 'https://example.com/2', 1640995200, 1640995200]);
                return { success: true };
            });

            expect(result.success).toBe(true);
        });

        it('should rollback transaction on error', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = SQLite.openDatabase();
            mockDb.transaction.mockImplementation((callback, errorCallback) => {
                const mockTx = {
                    executeSql: jest.fn((sql, params, success, error) => {
                        if (sql.includes('FAIL')) {
                            error(mockTx, new Error('SQL Error'));
                        } else {
                            success(mockTx, { rows: { length: 0 }, rowsAffected: 1 });
                        }
                    })
                };
                try {
                    callback(mockTx);
                } catch (err) {
                    if (errorCallback) errorCallback(err);
                }
            });

            await expect(dbService.executeInTransaction(async (ctx) => {
                await ctx.executeSql('INSERT INTO articles (id, title, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
                    ['test-1', 'Test', 'https://example.com', 1640995200, 1640995200]);
                await ctx.executeSql('FAIL');
                return { success: true };
            })).rejects.toThrow('Transaction failed');
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors', async () => {
            const SQLite = require('react-native-sqlite-storage');
            SQLite.openDatabase.mockRejectedValue(new Error('Database connection failed'));

            await expect(dbService.initialize()).rejects.toThrow('Failed to initialize database');
        });

        it('should handle SQL execution errors', async () => {
            const SQLite = require('react-native-sqlite-storage');
            const mockDb = {
                executeSql: jest.fn().mockRejectedValue(new Error('SQL execution failed')),
                transaction: jest.fn(),
                close: jest.fn(),
            };
            SQLite.openDatabase.mockResolvedValue(mockDb);

            await dbService.initialize();
            const result = await dbService.getArticle('test-id');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to get article');
        });
    });
});

describe('DatabaseUtils', () => {
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
            expect(article.createdAt).toBeInstanceOf(Date);
            expect(article.updatedAt).toBeInstanceOf(Date);
            expect(article.syncedAt).toBeInstanceOf(Date);
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
    });
});