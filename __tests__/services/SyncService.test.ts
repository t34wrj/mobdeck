/**
 * SyncService Unit Tests
 * 
 * Comprehensive tests for the SyncService including:
 * - Bidirectional sync operations
 * - Conflict resolution strategies
 * - Error handling and recovery
 * - Network awareness
 * - Batch processing
 */

import SyncService, { syncService } from '../../src/services/SyncService';
import DatabaseService from '../../src/services/DatabaseService';
import { articlesApiService } from '../../src/services/ArticlesApiService';
import { store } from '../../src/store';
import { ConflictResolutionStrategy, SyncPhase, SyncStatus } from '../../src/types/sync';
import { Article } from '../../src/types';

// Mock dependencies
jest.mock('../../src/services/DatabaseService');
jest.mock('../../src/services/ArticlesApiService');
jest.mock('../../src/store', () => ({
  store: {
    dispatch: jest.fn(),
    getState: jest.fn(),
  },
}));

// Mock data
const mockLocalArticle: Article = {
  id: 'local-article-1',
  title: 'Local Article',
  summary: 'Local summary',
  content: 'Local content',
  url: 'https://example.com/local',
  imageUrl: undefined,
  readTime: 5,
  isArchived: false,
  isFavorite: true,
  isRead: false,
  tags: ['local', 'test'],
  sourceUrl: 'https://example.com',
  createdAt: new Date('2023-01-01T10:00:00Z'),
  updatedAt: new Date('2023-01-02T10:00:00Z'),
  syncedAt: new Date('2023-01-01T12:00:00Z'),
  isModified: true,
};

const mockRemoteArticle: Article = {
  id: 'remote-article-1',
  title: 'Remote Article',
  summary: 'Remote summary',
  content: 'Remote content',
  url: 'https://example.com/remote',
  imageUrl: undefined,
  readTime: 7,
  isArchived: true,
  isFavorite: false,
  isRead: true,
  tags: ['remote', 'test'],
  sourceUrl: 'https://example.com',
  createdAt: new Date('2023-01-01T11:00:00Z'),
  updatedAt: new Date('2023-01-03T10:00:00Z'),
  syncedAt: new Date('2023-01-02T12:00:00Z'),
  isModified: false,
};

const mockConflictingLocalArticle: Article = {
  ...mockLocalArticle,
  id: 'conflict-article-1',
  title: 'Conflicting Local Title',
  updatedAt: new Date('2023-01-03T08:00:00Z'),
  isModified: true,
};

const mockConflictingRemoteArticle: Article = {
  ...mockRemoteArticle,
  id: 'conflict-article-1',
  title: 'Conflicting Remote Title',
  updatedAt: new Date('2023-01-03T10:00:00Z'),
  isModified: false,
};

describe('SyncService', () => {
  let syncServiceInstance: SyncService;
  let mockDatabaseService: jest.Mocked<typeof DatabaseService>;
  let mockArticlesApiService: jest.Mocked<typeof articlesApiService>;
  let mockStore: jest.Mocked<typeof store>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock implementations
    mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;
    mockArticlesApiService = articlesApiService as jest.Mocked<typeof articlesApiService>;
    mockStore = store as jest.Mocked<typeof store>;

    // Setup default mock store state
    mockStore.getState.mockReturnValue({
      sync: {
        status: SyncStatus.IDLE,
        config: {
          backgroundSyncEnabled: true,
          syncInterval: 15,
          syncOnWifiOnly: false,
          syncOnCellular: true,
          downloadImages: true,
          fullTextSync: true,
          conflictResolutionStrategy: ConflictResolutionStrategy.LAST_WRITE_WINS,
          batchSize: 50,
        },
        conflicts: [],
        stats: {
          totalSyncs: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
        },
      },
    } as any);

    // Get fresh instance for each test
    syncServiceInstance = SyncService.getInstance();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockDatabaseService.getSyncMetadata.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 100, offset: 0 },
      });

      await expect(syncServiceInstance.initialize()).resolves.not.toThrow();
      expect(mockStore.dispatch).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      mockDatabaseService.getSyncMetadata.mockRejectedValue(new Error('Database error'));

      // Should not throw, but log error
      await expect(syncServiceInstance.initialize()).resolves.not.toThrow();
    });
  });

  describe('Full Sync', () => {
    it('should complete full sync successfully', async () => {
      // Mock database responses
      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
      });
      
      mockDatabaseService.getStats.mockResolvedValue({
        success: true,
        data: {
          totalArticles: 10,
          archivedArticles: 2,
          favoriteArticles: 3,
          unreadArticles: 5,
          totalLabels: 5,
          pendingSyncItems: 0,
          databaseSize: 1024,
          lastSyncAt: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        },
      });

      // Mock API responses
      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [],
        page: 1,
        totalPages: 1,
        totalItems: 0,
      });

      const result = await syncServiceInstance.startFullSync();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBeGreaterThanOrEqual(0);
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('sync/startSync'),
        })
      );
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('sync/syncSuccess'),
        })
      );
    });

    it('should handle sync errors and dispatch error actions', async () => {
      mockDatabaseService.getArticles.mockRejectedValue(new Error('Database connection failed'));

      const result = await syncServiceInstance.startFullSync();

      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('sync/syncError'),
        })
      );
    });

    it('should prevent concurrent sync operations', async () => {
      // Start first sync (will be long running due to mocks)
      const syncPromise1 = syncServiceInstance.startFullSync();
      
      // Try to start second sync immediately
      await expect(syncServiceInstance.startFullSync()).rejects.toThrow('Sync already in progress');
      
      // Clean up
      await syncServiceInstance.stopSync();
    });
  });

  describe('Sync Up (Local to Remote)', () => {
    it('should upload locally modified articles', async () => {
      const modifiedArticles = [
        { ...mockLocalArticle, is_modified: 1 },
      ];

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: modifiedArticles, totalCount: 1, hasMore: false, limit: 50, offset: 0 },
      });

      mockArticlesApiService.getArticle.mockRejectedValue(new Error('Not found'));
      mockArticlesApiService.createArticle.mockResolvedValue(mockLocalArticle);
      mockDatabaseService.updateArticle.mockResolvedValue({ success: true, rowsAffected: 1 });

      const result = await syncServiceInstance.syncUp();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(1);
      expect(mockArticlesApiService.createArticle).toHaveBeenCalledWith({
        title: mockLocalArticle.title,
        url: mockLocalArticle.url,
        summary: mockLocalArticle.summary,
        content: mockLocalArticle.content,
        tags: mockLocalArticle.tags,
      });
    });

    it('should update existing articles on server', async () => {
      const modifiedArticles = [
        { ...mockLocalArticle, is_modified: 1 },
      ];

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: modifiedArticles, totalCount: 1, hasMore: false, limit: 50, offset: 0 },
      });

      mockArticlesApiService.getArticle.mockResolvedValue(mockLocalArticle);
      mockArticlesApiService.updateArticle.mockResolvedValue(mockLocalArticle);
      mockDatabaseService.updateArticle.mockResolvedValue({ success: true, rowsAffected: 1 });

      const result = await syncServiceInstance.syncUp();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(1);
      expect(mockArticlesApiService.updateArticle).toHaveBeenCalledWith({
        id: mockLocalArticle.id,
        updates: {
          title: mockLocalArticle.title,
          isArchived: mockLocalArticle.isArchived,
          isFavorite: mockLocalArticle.isFavorite,
          isRead: mockLocalArticle.isRead,
          tags: mockLocalArticle.tags,
        },
      });
    });

    it('should handle upload errors gracefully', async () => {
      const modifiedArticles = [
        { ...mockLocalArticle, is_modified: 1 },
      ];

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: modifiedArticles, totalCount: 1, hasMore: false, limit: 50, offset: 0 },
      });

      mockArticlesApiService.getArticle.mockRejectedValue(new Error('Network error'));

      const result = await syncServiceInstance.syncUp();

      expect(result.success).toBe(true); // Should continue despite errors
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].retryable).toBe(false);
    });
  });

  describe('Sync Down (Remote to Local)', () => {
    it('should download and store new remote articles', async () => {
      mockDatabaseService.getStats.mockResolvedValue({
        success: true,
        data: {
          totalArticles: 10,
          archivedArticles: 2,
          favoriteArticles: 3,
          unreadArticles: 5,
          totalLabels: 5,
          pendingSyncItems: 0,
          databaseSize: 1024,
          lastSyncAt: Math.floor(new Date('2023-01-01T00:00:00Z').getTime() / 1000),
        },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [mockRemoteArticle],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      });

      mockDatabaseService.getArticle.mockResolvedValue({
        success: false,
        error: 'Article not found',
      });

      mockDatabaseService.createArticle.mockResolvedValue({
        success: true,
        data: mockRemoteArticle.id,
        rowsAffected: 1,
      });

      const result = await syncServiceInstance.syncDown();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(1);
      expect(mockDatabaseService.createArticle).toHaveBeenCalled();
    });

    it('should update existing local articles with remote changes', async () => {
      mockDatabaseService.getStats.mockResolvedValue({
        success: true,
        data: {
          totalArticles: 10,
          archivedArticles: 2,
          favoriteArticles: 3,
          unreadArticles: 5,
          totalLabels: 5,
          pendingSyncItems: 0,
          databaseSize: 1024,
          lastSyncAt: Math.floor(new Date('2023-01-01T00:00:00Z').getTime() / 1000),
        },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [mockRemoteArticle],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      });

      mockDatabaseService.getArticle.mockResolvedValue({
        success: true,
        data: { ...mockRemoteArticle, is_modified: 0 }, // Not modified locally
      });

      mockDatabaseService.updateArticle.mockResolvedValue({
        success: true,
        rowsAffected: 1,
      });

      const result = await syncServiceInstance.syncDown();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(1);
      expect(mockDatabaseService.updateArticle).toHaveBeenCalled();
    });

    it('should detect and handle conflicts', async () => {
      mockDatabaseService.getStats.mockResolvedValue({
        success: true,
        data: {
          totalArticles: 10,
          archivedArticles: 2,
          favoriteArticles: 3,
          unreadArticles: 5,
          totalLabels: 5,
          pendingSyncItems: 0,
          databaseSize: 1024,
          lastSyncAt: Math.floor(new Date('2023-01-01T00:00:00Z').getTime() / 1000),
        },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [mockConflictingRemoteArticle],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      });

      mockDatabaseService.getArticle.mockResolvedValue({
        success: true,
        data: { ...mockConflictingLocalArticle, is_modified: 1 }, // Modified locally
      });

      mockDatabaseService.updateArticle.mockResolvedValue({
        success: true,
        rowsAffected: 1,
      });

      const result = await syncServiceInstance.syncDown();

      expect(result.success).toBe(true);
      expect(result.conflictCount).toBe(1);
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('sync/addConflict'),
        })
      );
    });
  });

  describe('Conflict Resolution', () => {
    beforeEach(() => {
      // Mock store to return Last-Write-Wins strategy
      mockStore.getState.mockReturnValue({
        sync: {
          status: SyncStatus.IDLE,
          config: {
            conflictResolutionStrategy: ConflictResolutionStrategy.LAST_WRITE_WINS,
            batchSize: 50,
          },
          conflicts: [
            {
              id: 'conflict-1',
              articleId: 'conflict-article-1',
              localVersion: mockConflictingLocalArticle,
              remoteVersion: mockConflictingRemoteArticle,
            },
          ],
          stats: {},
        },
      } as any);
    });

    it('should resolve conflicts using Last-Write-Wins strategy', async () => {
      mockDatabaseService.updateArticle.mockResolvedValue({
        success: true,
        rowsAffected: 1,
      });

      // Since remote article has later timestamp, it should win
      const resolved = await (syncServiceInstance as any).handleConflict(
        mockConflictingLocalArticle,
        mockConflictingRemoteArticle
      );

      expect(resolved).toBe(true);
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('sync/resolveConflict'),
        })
      );
    });

    it('should handle Local-Wins strategy', async () => {
      // Update store to use Local-Wins strategy
      mockStore.getState.mockReturnValue({
        sync: {
          config: {
            conflictResolutionStrategy: ConflictResolutionStrategy.LOCAL_WINS,
          },
        },
      } as any);

      mockDatabaseService.updateArticle.mockResolvedValue({
        success: true,
        rowsAffected: 1,
      });

      const resolved = await (syncServiceInstance as any).handleConflict(
        mockConflictingLocalArticle,
        mockConflictingRemoteArticle
      );

      expect(resolved).toBe(true);
      expect(mockDatabaseService.updateArticle).toHaveBeenCalledWith(
        mockConflictingLocalArticle.id,
        expect.objectContaining({
          is_modified: 1, // Should remain modified for later upload
        })
      );
    });

    it('should handle Remote-Wins strategy', async () => {
      // Update store to use Remote-Wins strategy
      mockStore.getState.mockReturnValue({
        sync: {
          config: {
            conflictResolutionStrategy: ConflictResolutionStrategy.REMOTE_WINS,
          },
        },
      } as any);

      mockDatabaseService.updateArticle.mockResolvedValue({
        success: true,
        rowsAffected: 1,
      });

      const resolved = await (syncServiceInstance as any).handleConflict(
        mockConflictingLocalArticle,
        mockConflictingRemoteArticle
      );

      expect(resolved).toBe(true);
      expect(mockDatabaseService.updateArticle).toHaveBeenCalledWith(
        mockConflictingRemoteArticle.id,
        expect.objectContaining({
          is_modified: 0, // Should not be marked as modified
        })
      );
    });

    it('should handle Manual resolution strategy', async () => {
      // Update store to use Manual strategy
      mockStore.getState.mockReturnValue({
        sync: {
          config: {
            conflictResolutionStrategy: ConflictResolutionStrategy.MANUAL,
          },
        },
      } as any);

      const resolved = await (syncServiceInstance as any).handleConflict(
        mockConflictingLocalArticle,
        mockConflictingRemoteArticle
      );

      expect(resolved).toBe(false); // Manual resolution should not auto-resolve
    });
  });

  describe('Batch Processing', () => {
    it('should process articles in batches', async () => {
      const articles = Array.from({ length: 25 }, (_, i) => ({
        ...mockLocalArticle,
        id: `article-${i}`,
        is_modified: 1,
      }));

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: articles, totalCount: 25, hasMore: false, limit: 50, offset: 0 },
      });

      mockArticlesApiService.getArticle.mockRejectedValue(new Error('Not found'));
      mockArticlesApiService.createArticle.mockResolvedValue(mockLocalArticle);
      mockDatabaseService.updateArticle.mockResolvedValue({ success: true, rowsAffected: 1 });

      // Update config to use smaller batch size
      syncServiceInstance.updateConfig({ batchSize: 10 });

      const result = await syncServiceInstance.syncUp();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(25);
      // Should have made 25 create calls (one for each article)
      expect(mockArticlesApiService.createArticle).toHaveBeenCalledTimes(25);
    });
  });

  describe('Error Handling', () => {
    it('should distinguish between retryable and non-retryable errors', () => {
      const networkError = new Error('Network request failed');
      (networkError as any).code = 'NETWORK_ERROR';
      
      const authError = new Error('Unauthorized');
      (authError as any).status = 401;
      
      const serverError = new Error('Internal Server Error');
      (serverError as any).status = 500;

      expect((syncServiceInstance as any).isRetryableError(networkError)).toBe(true);
      expect((syncServiceInstance as any).isRetryableError(authError)).toBe(false);
      expect((syncServiceInstance as any).isRetryableError(serverError)).toBe(true);
    });

    it('should handle abort signals during sync', async () => {
      // Mock a long-running operation
      mockDatabaseService.getArticles.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
        }), 100))
      );

      // Start sync and immediately stop it
      const syncPromise = syncServiceInstance.startFullSync();
      await syncServiceInstance.stopSync();

      const result = await syncPromise;
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.error.includes('aborted'))).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        batchSize: 25,
        conflictResolutionStrategy: ConflictResolutionStrategy.REMOTE_WINS,
      };

      syncServiceInstance.updateConfig(newConfig);

      // Configuration should be applied to internal config
      expect((syncServiceInstance as any).config.batchSize).toBe(25);
      expect((syncServiceInstance as any).config.conflictResolutionStrategy).toBe(ConflictResolutionStrategy.REMOTE_WINS);
    });
  });

  describe('Status and Statistics', () => {
    it('should report correct running status', async () => {
      expect(syncServiceInstance.isRunning()).toBe(false);

      // Mock a long-running sync
      mockDatabaseService.getArticles.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
        }), 50))
      );

      const syncPromise = syncServiceInstance.startFullSync();
      
      // Check status during sync
      expect(syncServiceInstance.isRunning()).toBe(true);
      
      await syncPromise;
      expect(syncServiceInstance.isRunning()).toBe(false);
    });

    it('should provide sync statistics', async () => {
      const mockStats = {
        totalSyncs: 5,
        successfulSyncs: 4,
        failedSyncs: 1,
      };

      mockStore.getState.mockReturnValue({
        sync: { stats: mockStats },
      } as any);

      const stats = await syncServiceInstance.getSyncStats();
      expect(stats).toEqual(mockStats);
    });
  });
});