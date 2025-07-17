/**
 * Unit tests for SyncService - Simplified sync service
 * Tests sync operations without background task complexity
 */

import { syncService } from '../../src/services/SyncService';
import { SyncPhase } from '../../src/types/sync';

// Mock the dependencies
jest.mock('../../src/services/ReadeckApiService', () => ({
  readeckApiService: {
    fetchArticlesWithFilters: jest.fn().mockResolvedValue({
      items: [
        {
          id: 'remote-1',
          title: 'Remote Article',
          url: 'https://example.com/remote',
          updatedAt: new Date().toISOString(),
        },
      ],
    }),
    createArticleWithMetadata: jest.fn().mockResolvedValue({
      id: 'created-1',
      title: 'Created Article',
      url: 'https://example.com/created',
    }),
    updateArticleWithMetadata: jest.fn().mockResolvedValue({
      id: 'updated-1',
      title: 'Updated Article',
      url: 'https://example.com/updated',
    }),
    getArticleWithContent: jest.fn().mockResolvedValue({
      id: 'article-1',
      title: 'Article with Content',
      content: 'Full content here',
    }),
  },
}));

jest.mock('../../src/services/LocalStorageService', () => ({
  localStorageService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getArticles: jest.fn().mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 'local-1',
            title: 'Local Article',
            url: 'https://example.com/local',
            is_modified: 1,
            updated_at: Date.now() / 1000,
          },
        ],
      },
    }),
    updateArticle: jest.fn().mockResolvedValue({ success: true }),
    deleteArticle: jest.fn().mockResolvedValue({ success: true }),
    createArticleFromAppFormat: jest.fn().mockResolvedValue('new-id'),
    updateArticleFromAppFormat: jest.fn().mockResolvedValue(true),
    getArticleAsAppFormat: jest.fn().mockResolvedValue(null),
    getStats: jest.fn().mockResolvedValue({
      success: true,
      data: {
        lastSyncAt: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      },
    }),
  },
}));

jest.mock('../../src/services/ShareService', () => ({
  ShareService: {
    getPendingSharedUrls: jest.fn().mockResolvedValue([]),
    removeFromQueue: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/store', () => ({
  store: {
    getState: jest.fn().mockReturnValue({
      auth: { isAuthenticated: true },
      sync: {
        config: {
          backgroundSyncEnabled: true,
          syncInterval: 30,
          batchSize: 25,
          conflictResolutionStrategy: 'LAST_WRITE_WINS',
        },
        conflicts: [],
        stats: {
          totalSyncs: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          lastSyncDuration: null,
          averageSyncDuration: null,
          itemsSynced: {
            articlesCreated: 0,
            articlesUpdated: 0,
            articlesDeleted: 0,
            conflictsResolved: 0,
          },
          dataTransfer: {
            bytesUploaded: 0,
            bytesDownloaded: 0,
            requestCount: 0,
            cacheHits: 0,
          },
        },
      },
    }),
    dispatch: jest.fn(),
  },
}));

jest.mock('../../src/utils/connectivityManager', () => ({
  connectivityManager: {
    checkNetworkStatus: jest.fn().mockResolvedValue({
      isConnected: true,
      isWifi: true,
      isCellular: false,
    }),
    isOnline: jest.fn().mockReturnValue(true),
    getCurrentNetworkStatus: jest.fn().mockReturnValue({
      isConnected: true,
      isWifi: true,
      isCellular: false,
    }),
  },
  ConnectivityStatus: {
    ONLINE: 'ONLINE',
    OFFLINE: 'OFFLINE',
  },
}));

jest.mock('../../src/utils/errorHandler', () => ({
  errorHandler: {
    handleError: jest.fn().mockImplementation((error, context) => ({
      message: error.message || 'Unknown error',
      code: 'TEST_ERROR',
      category: context?.category || 'TEST',
      userMessage: 'Test error occurred',
      retryable: true,
    })),
    getNetworkErrorHandler: jest.fn().mockReturnValue((error) => ({
      message: error.message || 'Network error',
      userMessage: 'Network error occurred',
      type: 'NETWORK',
      retryable: true,
    })),
  },
  ErrorCategory: {
    SYNC_OPERATION: 'SYNC_OPERATION',
    NETWORK: 'NETWORK',
    STORAGE: 'STORAGE',
  },
}));

// Mock Redux actions
jest.mock('../../src/store/slices/syncSlice', () => ({
  startSync: jest.fn().mockReturnValue({ type: 'sync/startSync' }),
  syncProgress: jest.fn().mockReturnValue({ type: 'sync/syncProgress' }),
  syncSuccess: jest.fn().mockReturnValue({ type: 'sync/syncSuccess' }),
  syncError: jest.fn().mockReturnValue({ type: 'sync/syncError' }),
  updateSyncStats: jest.fn().mockReturnValue({ type: 'sync/updateSyncStats' }),
  updateNetworkStatus: jest
    .fn()
    .mockReturnValue({ type: 'sync/updateNetworkStatus' }),
  addConflict: jest.fn().mockReturnValue({ type: 'sync/addConflict' }),
  resolveConflict: jest.fn().mockReturnValue({ type: 'sync/resolveConflict' }),
}));

// Mock utility functions
jest.mock('../../src/utils/conflictResolution', () => ({
  resolveConflict: jest.fn().mockImplementation((local, remote) => ({
    ...remote,
    id: local.id,
  })),
}));

jest.mock('../../src/services/DatabaseService', () => ({
  DatabaseUtilityFunctions: {
    convertDBArticleToArticle: jest.fn().mockImplementation(dbArticle => ({
      id: dbArticle.id,
      title: dbArticle.title,
      url: dbArticle.url,
      isModified: Boolean(dbArticle.is_modified),
      updatedAt: new Date(dbArticle.updated_at * 1000).toISOString(),
    })),
  },
}));

describe('SyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(syncService.initialize()).resolves.toBeUndefined();
    });

    it('should get configuration', () => {
      const config = syncService.getConfiguration();
      expect(config).toHaveProperty('backgroundSyncEnabled');
      expect(config).toHaveProperty('syncInterval');
      expect(config).toHaveProperty('batchSize');
    });

    it('should update configuration', () => {
      const newConfig = { syncInterval: 60 };
      expect(() => {
        syncService.updateConfiguration(newConfig);
      }).not.toThrow();
    });
  });

  describe('Sync Status', () => {
    it('should check if sync is running', () => {
      const isRunning = syncService.isSyncRunning();
      expect(typeof isRunning).toBe('boolean');
    });

    it('should get sync stats', async () => {
      const stats = await syncService.getSyncStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Full Sync Operation', () => {
    it('should perform full sync successfully', async () => {
      const result = await syncService.startFullSync();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('syncedCount');
      expect(result).toHaveProperty('conflictCount');
      expect(result).toHaveProperty('errorCount');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('phase');
      expect(result).toHaveProperty('errors');
    });

    it('should handle sync errors gracefully', async () => {
      // Mock connectivity check to simulate unreachable server
      const mockConnectivity = require('../../src/utils/connectivityManager');

      // Mock connectivity to be offline to force sync failure
      mockConnectivity.connectivityManager.checkNetworkStatus.mockResolvedValueOnce({
        isConnected: false,
        isWifi: false,
        isCellular: false,
      });

      // This should throw an error when server is unreachable
      await expect(syncService.startFullSync()).rejects.toThrow(
        'Server is unreachable'
      );
    });

    it('should prevent concurrent syncs', async () => {
      // Mock connectivity for the first sync
      const mockConnectivity = require('../../src/utils/connectivityManager');
      mockConnectivity.connectivityManager.checkNetworkStatus.mockResolvedValue({
        isConnected: true,
        isWifi: true,
        isCellular: false,
      });

      // Manually set the service to running state
      (syncService as any).isRunning = true;

      // Try to start second sync while running
      await expect(syncService.startFullSync()).rejects.toThrow(
        'Sync already in progress'
      );

      // Reset running state
      (syncService as any).isRunning = false;
    });

    it('should allow forced sync even when running', async () => {
      // Mock connectivity
      const mockConnectivity = require('../../src/utils/connectivityManager');
      mockConnectivity.connectivityManager.checkNetworkStatus.mockResolvedValue({
        isConnected: true,
        isWifi: true,
        isCellular: false,
      });

      // Start first sync (don't await)
      const syncPromise1 = syncService.startFullSync();

      // Force a second sync
      const result = await syncService.startFullSync(true);
      expect(result).toHaveProperty('success');

      // Wait for first sync to complete
      await syncPromise1;
    });
  });

  describe('Sync Up Operation', () => {
    it('should sync local changes to remote', async () => {
      const result = await syncService.syncUp();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('syncedCount');
      expect(result.phase).toBe(SyncPhase.UPLOADING_CHANGES);
    });
  });

  describe('Sync Down Operation', () => {
    it('should sync remote changes to local', async () => {
      const result = await syncService.syncDown();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('syncedCount');
      expect(result.phase).toBe(SyncPhase.DOWNLOADING_UPDATES);
    });
  });

  describe('Manual Sync', () => {
    it('should trigger manual sync', async () => {
      await expect(syncService.triggerManualSync()).resolves.toBeUndefined();
    });
  });

  describe('Sync Control', () => {
    it('should stop sync operation', async () => {
      await expect(syncService.stopSync()).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle network connectivity issues', async () => {
      const mockConnectivity = require('../../src/utils/connectivityManager');
      mockConnectivity.connectivityManager.checkNetworkStatus.mockResolvedValueOnce({
        isConnected: false,
        isWifi: false,
        isCellular: false,
      });

      await expect(syncService.startFullSync()).rejects.toThrow(
        'Server is unreachable. Please check your connection.'
      );
    });
  });
});
