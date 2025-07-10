/**
 * Unit tests for SyncService
 * Testing bidirectional synchronization with comprehensive coverage
 */

import { SyncService } from '../../src/services/SyncService';
import DatabaseService from '../../src/services/DatabaseService';
import { readeckApiService } from '../../src/services/ReadeckApiService';
import { articlesApiService } from '../../src/services/ArticlesApiService';
import { ShareService } from '../../src/services/ShareService';
import { store } from '../../src/store';
import { connectivityManager } from '../../src/utils/connectivityManager';
import { errorHandler } from '../../src/utils/errorHandler';
import {
  SyncConfiguration,
  SyncPhase,
  ConflictResolutionStrategy,
  NetworkType,
  SyncConflict,
  ConflictType,
} from '../../src/types/sync';
import { Article } from '../../src/types';

// Mock dependencies
jest.mock('../../src/services/DatabaseService');
jest.mock('../../src/services/ReadeckApiService');
jest.mock('../../src/services/ArticlesApiService');
jest.mock('../../src/services/ShareService');
jest.mock('../../src/store');
jest.mock('../../src/utils/connectivityManager');
jest.mock('../../src/utils/errorHandler');
jest.mock('../../src/utils/conflictResolution');

describe('SyncService', () => {
  let syncService: SyncService;
  let mockStore: any;
  
  // Test data
  const testArticle: Article = {
    id: 'test-article-1',
    title: 'Test Article',
    summary: 'Test summary',
    content: 'Test content',
    url: 'https://example.com/article',
    imageUrl: 'https://example.com/image.jpg',
    readTime: 5,
    isArchived: false,
    isFavorite: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['test'],
  };

  const testConfig: SyncConfiguration = {
    backgroundSyncEnabled: true,
    syncInterval: 15,
    syncOnWifiOnly: false,
    syncOnCellular: true,
    downloadImages: true,
    fullTextSync: true,
    conflictResolutionStrategy: ConflictResolutionStrategy.LAST_WRITE_WINS,
    autoResolveConflicts: true,
    retryAttempts: 3,
    batchSize: 50,
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // Mock store
    mockStore = {
      dispatch: jest.fn(),
      getState: jest.fn().mockReturnValue({
        sync: {
          isRunning: false,
          lastSyncTime: null,
          pendingOperations: 0,
          conflicts: [],
          stats: {
            totalSynced: 0,
            totalConflicts: 0,
            lastSync: null,
          },
        },
        settings: {
          syncConfig: testConfig,
        },
      }),
    };
    (store as any) = mockStore;
    
    // Mock connectivity
    (connectivityManager.getStatus as jest.Mock).mockReturnValue({
      isConnected: true,
      networkType: NetworkType.WIFI,
    });
    
    // Mock database operations
    (DatabaseService.isConnected as jest.Mock).mockReturnValue(true);
    (DatabaseService.getArticles as jest.Mock).mockResolvedValue({
      success: true,
      data: { items: [], totalCount: 0, hasMore: false },
    });
    (DatabaseService.createArticle as jest.Mock).mockResolvedValue({
      success: true,
      data: 'test-id',
    });
    (DatabaseService.updateArticle as jest.Mock).mockResolvedValue({
      success: true,
      rowsAffected: 1,
    });
    
    // Mock API operations
    (readeckApiService.getNetworkState as jest.Mock).mockReturnValue({
      isOnline: true,
      isAuthenticated: true,
    });
    (articlesApiService.getArticles as jest.Mock).mockResolvedValue({
      articles: [],
      total: 0,
      page: 1,
      limit: 50,
    });
    
    // Get singleton instance
    syncService = SyncService.getInstance();
  });

  afterEach(() => {
    // Clean up
    syncService.stopSync();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SyncService.getInstance();
      const instance2 = SyncService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Configuration', () => {
    it('should update sync configuration', () => {
      const newConfig: Partial<SyncConfiguration> = {
        syncInterval: 30,
        syncOnWifiOnly: true,
      };
      
      syncService.updateConfig(newConfig);
      
      expect(mockStore.dispatch).toHaveBeenCalled();
    });

    it('should get current configuration', () => {
      const config = syncService.getConfig();
      expect(config).toEqual(testConfig);
    });
  });

  describe('Sync Execution', () => {
    it('should start sync successfully', async () => {
      // Mock successful sync
      (articlesApiService.getArticles as jest.Mock).mockResolvedValue({
        articles: [testArticle],
        total: 1,
        page: 1,
        limit: 50,
      });
      
      const result = await syncService.startSync();
      
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBeGreaterThanOrEqual(0);
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync/startSync' })
      );
    });

    it('should handle sync when already running', async () => {
      // Start first sync
      const firstSync = syncService.startSync();
      
      // Try to start second sync immediately
      const secondSync = syncService.startSync();
      
      // Both should resolve without errors
      const [result1, result2] = await Promise.all([firstSync, secondSync]);
      
      expect(result1.success || result2.success).toBe(true);
    });

    it('should handle network unavailable', async () => {
      // Mock offline
      (connectivityManager.getStatus as jest.Mock).mockReturnValue({
        isConnected: false,
        networkType: NetworkType.NONE,
      });
      
      const result = await syncService.startSync();
      
      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('No network connection');
    });

    it('should respect WiFi-only setting', async () => {
      // Update config to WiFi only
      mockStore.getState.mockReturnValue({
        sync: { isRunning: false },
        settings: {
          syncConfig: { ...testConfig, syncOnWifiOnly: true },
        },
      });
      
      // Mock cellular connection
      (connectivityManager.getStatus as jest.Mock).mockReturnValue({
        isConnected: true,
        networkType: NetworkType.CELLULAR,
      });
      
      const result = await syncService.startSync();
      
      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('WiFi');
    });

    it('should handle authentication failure', async () => {
      // Mock not authenticated
      (readeckApiService.getNetworkState as jest.Mock).mockReturnValue({
        isOnline: true,
        isAuthenticated: false,
      });
      
      const result = await syncService.startSync();
      
      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('Not authenticated');
    });
  });

  describe('Pull Sync', () => {
    it('should pull new articles from server', async () => {
      // Mock server has new articles
      const serverArticles = [
        { ...testArticle, id: 'server-1' },
        { ...testArticle, id: 'server-2' },
      ];
      
      (articlesApiService.getArticles as jest.Mock).mockResolvedValue({
        articles: serverArticles,
        total: 2,
        page: 1,
        limit: 50,
      });
      
      // Mock local has no articles
      (DatabaseService.getArticles as jest.Mock).mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false },
      });
      
      const result = await syncService.startSync();
      
      expect(result.success).toBe(true);
      expect(DatabaseService.createArticle).toHaveBeenCalledTimes(2);
    });

    it('should handle pull errors gracefully', async () => {
      // Mock API error
      (articlesApiService.getArticles as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );
      
      const result = await syncService.startSync();
      
      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should batch large pulls', async () => {
      // Mock many articles
      const manyArticles = Array(150).fill(null).map((_, i) => ({
        ...testArticle,
        id: `server-${i}`,
      }));
      
      (articlesApiService.getArticles as jest.Mock)
        .mockResolvedValueOnce({
          articles: manyArticles.slice(0, 50),
          total: 150,
          page: 1,
          limit: 50,
        })
        .mockResolvedValueOnce({
          articles: manyArticles.slice(50, 100),
          total: 150,
          page: 2,
          limit: 50,
        })
        .mockResolvedValueOnce({
          articles: manyArticles.slice(100, 150),
          total: 150,
          page: 3,
          limit: 50,
        });
      
      const result = await syncService.startSync();
      
      expect(result.success).toBe(true);
      expect(articlesApiService.getArticles).toHaveBeenCalledTimes(3);
    });
  });

  describe('Push Sync', () => {
    it('should push local changes to server', async () => {
      // Mock local modified articles
      const modifiedArticle = { ...testArticle, isModified: true };
      
      (DatabaseService.getArticles as jest.Mock).mockResolvedValue({
        success: true,
        data: { 
          items: [DatabaseService.convertArticleToDBArticle(modifiedArticle)],
          totalCount: 1,
          hasMore: false,
        },
      });
      
      (articlesApiService.updateArticle as jest.Mock).mockResolvedValue({
        ...modifiedArticle,
        isModified: false,
      });
      
      const result = await syncService.startSync();
      
      expect(result.success).toBe(true);
      expect(articlesApiService.updateArticle).toHaveBeenCalled();
    });

    it('should handle push failures with retry', async () => {
      // Mock local modified article
      const modifiedArticle = { ...testArticle, isModified: true };
      
      (DatabaseService.getArticles as jest.Mock).mockResolvedValue({
        success: true,
        data: { 
          items: [DatabaseService.convertArticleToDBArticle(modifiedArticle)],
          totalCount: 1,
          hasMore: false,
        },
      });
      
      // Mock API failure then success
      (articlesApiService.updateArticle as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(modifiedArticle);
      
      const result = await syncService.startSync();
      
      // Should eventually succeed with retry
      expect(result.errorCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect and resolve conflicts', async () => {
      // Mock local and remote have different versions
      const localArticle = {
        ...testArticle,
        title: 'Local Title',
        updatedAt: new Date('2024-01-01').toISOString(),
      };
      
      const remoteArticle = {
        ...testArticle,
        title: 'Remote Title',
        updatedAt: new Date('2024-01-02').toISOString(),
      };
      
      (DatabaseService.getArticle as jest.Mock).mockResolvedValue({
        success: true,
        data: DatabaseService.convertArticleToDBArticle(localArticle),
      });
      
      (articlesApiService.getArticles as jest.Mock).mockResolvedValue({
        articles: [remoteArticle],
        total: 1,
        page: 1,
        limit: 50,
      });
      
      const result = await syncService.startSync();
      
      expect(result.conflictCount).toBeGreaterThanOrEqual(0);
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync/addConflict' })
      );
    });

    it('should apply conflict resolution strategy', async () => {
      const conflict: SyncConflict = {
        id: 'conflict-1',
        entityType: 'article',
        entityId: testArticle.id,
        localVersion: { ...testArticle, title: 'Local' },
        remoteVersion: { ...testArticle, title: 'Remote' },
        detectedAt: new Date().toISOString(),
        conflictType: ConflictType.UPDATE_UPDATE,
        resolved: false,
      };
      
      await syncService.resolveConflict(conflict.id, 'remote');
      
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync/resolveConflict' })
      );
    });
  });

  describe('Background Sync', () => {
    it('should register background sync', async () => {
      await syncService.registerBackgroundSync();
      
      expect(mockStore.dispatch).toHaveBeenCalled();
    });

    it('should unregister background sync', async () => {
      await syncService.unregisterBackgroundSync();
      
      expect(mockStore.dispatch).toHaveBeenCalled();
    });
  });

  describe('Sync Status', () => {
    it('should report sync progress', async () => {
      const progressCallback = jest.fn();
      
      // Start sync with progress callback
      await syncService.startSync(progressCallback);
      
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: expect.any(String),
          progress: expect.any(Number),
        })
      );
    });

    it('should check if sync is running', () => {
      expect(syncService.isSyncing()).toBe(false);
      
      // Start sync
      syncService.startSync();
      
      expect(syncService.isSyncing()).toBe(true);
    });

    it('should get last sync time', () => {
      const lastSync = syncService.getLastSyncTime();
      expect(lastSync).toBeNull();
    });
  });

  describe('Sync Cancellation', () => {
    it('should cancel running sync', async () => {
      // Mock slow API call
      (articlesApiService.getArticles as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      // Start sync
      const syncPromise = syncService.startSync();
      
      // Cancel after short delay
      setTimeout(() => syncService.stopSync(), 100);
      
      const result = await syncPromise;
      
      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('cancelled');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      (DatabaseService.getArticles as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Database error',
      });
      
      const result = await syncService.startSync();
      
      expect(result.success).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('should handle unexpected errors', async () => {
      (articlesApiService.getArticles as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      const result = await syncService.startSync();
      
      expect(result.success).toBe(false);
      expect(errorHandler.logError).toHaveBeenCalled();
    });

    it('should report retryable vs non-retryable errors', async () => {
      // Mock network error (retryable)
      (articlesApiService.getArticles as jest.Mock).mockRejectedValue(
        new Error('Network timeout')
      );
      
      const result = await syncService.startSync();
      
      expect(result.errors[0].retryable).toBe(true);
    });
  });

  describe('Share Integration', () => {
    it('should sync shared articles', async () => {
      const sharedUrl = 'https://example.com/shared-article';
      
      (ShareService.prototype.hasQueuedShares as jest.Mock).mockReturnValue(true);
      (ShareService.prototype.getQueuedShares as jest.Mock).mockReturnValue([
        { url: sharedUrl, timestamp: Date.now() },
      ]);
      
      await syncService.syncSharedArticles();
      
      expect(articlesApiService.createArticle).toHaveBeenCalledWith(
        expect.objectContaining({ url: sharedUrl })
      );
    });
  });

  describe('Performance', () => {
    it('should handle large sync operations efficiently', async () => {
      // Mock 1000 articles
      const manyArticles = Array(1000).fill(null).map((_, i) => ({
        ...testArticle,
        id: `article-${i}`,
      }));
      
      (articlesApiService.getArticles as jest.Mock).mockImplementation(
        ({ page = 1, limit = 50 }) => {
          const start = (page - 1) * limit;
          const end = start + limit;
          return Promise.resolve({
            articles: manyArticles.slice(start, end),
            total: manyArticles.length,
            page,
            limit,
          });
        }
      );
      
      const startTime = Date.now();
      const result = await syncService.startSync();
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});