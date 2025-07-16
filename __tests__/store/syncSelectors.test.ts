import * as syncSelectors from '../../src/store/selectors/syncSelectors';
import {
  SyncStatus,
  SyncPhase,
  ConflictType,
  ConflictResolutionStrategy,
} from '../../src/types/sync';

describe('syncSelectors', () => {
  const mockState = {
    sync: {
      status: SyncStatus.SYNCING,
      lastSyncTime: '2023-12-01T10:00:00Z',
      progress: {
        phase: SyncPhase.DOWNLOADING_UPDATES,
        totalItems: 100,
        processedItems: 25,
        currentItem: 'article-123',
        estimatedTimeRemaining: 5000,
      },
      isOnline: true,
      networkType: 'wifi' as const,
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
      conflicts: [
        {
          id: 'conflict-1',
          articleId: 'article-123',
          type: ConflictType.CONTENT_MODIFIED,
          localVersion: { title: 'Local' },
          remoteVersion: { title: 'Remote' },
          createdAt: '2023-12-01T09:00:00Z',
          resolvedAt: null,
          resolution: null,
        },
        {
          id: 'conflict-2',
          articleId: 'article-456',
          type: ConflictType.STATUS_CHANGED,
          localVersion: { isRead: true },
          remoteVersion: { isRead: false },
          createdAt: '2023-12-01T09:30:00Z',
          resolvedAt: null,
          resolution: null,
        },
      ],
      error: null,
      stats: {
        totalSyncs: 10,
        successfulSyncs: 8,
        failedSyncs: 2,
        lastSyncDuration: 3000,
        averageSyncDuration: 3500,
        itemsSynced: {
          articlesCreated: 5,
          articlesUpdated: 15,
          articlesDeleted: 2,
          conflictsResolved: 3,
        },
        dataTransfer: {
          bytesUploaded: 1024,
          bytesDownloaded: 2048,
          requestCount: 25,
          cacheHits: 5,
        },
      },
    },
    articles: {}, // Mock articles state
    auth: {}, // Mock auth state
  };

  describe('basic selectors', () => {
    it('should select sync status', () => {
      const result = syncSelectors.selectSyncStatus(mockState);
      expect(result).toBe(SyncStatus.SYNCING);
    });

    it('should select last sync time', () => {
      const result = syncSelectors.selectLastSyncTime(mockState);
      expect(result).toBe('2023-12-01T10:00:00Z');
    });

    it('should select sync error', () => {
      const result = syncSelectors.selectSyncError(mockState);
      expect(result).toBe(null);
    });

    it('should select online status', () => {
      const result = syncSelectors.selectIsOnline(mockState);
      expect(result).toBe(true);
    });

    it('should select network type', () => {
      const result = syncSelectors.selectNetworkType(mockState);
      expect(result).toBe('wifi');
    });
  });

  describe('progress selectors', () => {
    it('should select sync progress', () => {
      const result = syncSelectors.selectSyncProgress(mockState);
      expect(result).toEqual(mockState.sync.progress);
    });

    it('should calculate sync progress percentage', () => {
      const result = syncSelectors.selectSyncProgressPercentage(mockState);
      expect(result).toBe(25); // 25/100 * 100
    });

    it('should handle zero total items', () => {
      const stateWithZeroItems = {
        ...mockState,
        sync: {
          ...mockState.sync,
          progress: { ...mockState.sync.progress, totalItems: 0 },
        },
      };
      const result =
        syncSelectors.selectSyncProgressPercentage(stateWithZeroItems);
      expect(result).toBe(0);
    });

    it('should select current sync item', () => {
      const result = syncSelectors.selectCurrentSyncItem(mockState);
      expect(result).toBe('article-123');
    });

    it('should select estimated time remaining', () => {
      const result = syncSelectors.selectEstimatedTimeRemaining(mockState);
      expect(result).toBe(5000);
    });
  });

  describe('configuration selectors', () => {
    it('should select sync config', () => {
      const result = syncSelectors.selectSyncConfig(mockState);
      expect(result).toEqual(mockState.sync.config);
    });

    it('should select background sync enabled', () => {
      const result = syncSelectors.selectBackgroundSyncEnabled(mockState);
      expect(result).toBe(true);
    });

    it('should select sync interval', () => {
      const result = syncSelectors.selectSyncInterval(mockState);
      expect(result).toBe(15);
    });

    it('should select sync on wifi only', () => {
      const result = syncSelectors.selectSyncOnWifiOnly(mockState);
      expect(result).toBe(false);
    });

    it('should select conflict resolution strategy', () => {
      const result = syncSelectors.selectConflictResolutionStrategy(mockState);
      expect(result).toBe(ConflictResolutionStrategy.LAST_WRITE_WINS);
    });
  });

  describe('conflict selectors', () => {
    it('should select sync conflicts', () => {
      const result = syncSelectors.selectSyncConflicts(mockState);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('conflict-1');
    });

    it('should select conflict count', () => {
      const result = syncSelectors.selectConflictCount(mockState);
      expect(result).toBe(2);
    });

    it('should select unresolved conflicts', () => {
      const result = syncSelectors.selectUnresolvedConflicts(mockState);
      expect(result).toHaveLength(2); // Both conflicts are unresolved
    });

    it('should group conflicts by type', () => {
      const result = syncSelectors.selectConflictsByType(mockState);
      expect(result[ConflictType.CONTENT_MODIFIED]).toHaveLength(1);
      expect(result[ConflictType.STATUS_CHANGED]).toHaveLength(1);
    });

    it('should group conflicts by article', () => {
      const result = syncSelectors.selectConflictsByArticle(mockState);
      expect(result['article-123']).toHaveLength(1);
      expect(result['article-456']).toHaveLength(1);
    });
  });

  describe('statistics selectors', () => {
    it('should select sync stats', () => {
      const result = syncSelectors.selectSyncStats(mockState);
      expect(result).toEqual(mockState.sync.stats);
    });

    it('should select total syncs', () => {
      const result = syncSelectors.selectTotalSyncs(mockState);
      expect(result).toBe(10);
    });

    it('should select successful syncs', () => {
      const result = syncSelectors.selectSuccessfulSyncs(mockState);
      expect(result).toBe(8);
    });

    it('should select failed syncs', () => {
      const result = syncSelectors.selectFailedSyncs(mockState);
      expect(result).toBe(2);
    });

    it('should calculate sync success rate', () => {
      const result = syncSelectors.selectSyncSuccessRate(mockState);
      expect(result).toBe(80); // 8/10 * 100
    });

    it('should handle zero total syncs for success rate', () => {
      const stateWithZeroSyncs = {
        ...mockState,
        sync: {
          ...mockState.sync,
          stats: { ...mockState.sync.stats, totalSyncs: 0, successfulSyncs: 0 },
        },
      };
      const result = syncSelectors.selectSyncSuccessRate(stateWithZeroSyncs);
      expect(result).toBe(0);
    });

    it('should calculate total data transferred', () => {
      const result = syncSelectors.selectTotalDataTransferred(mockState);
      expect(result).toBe(3072); // 1024 + 2048
    });
  });

  describe('boolean selectors', () => {
    it('should detect if syncing', () => {
      const result = syncSelectors.selectIsSyncing(mockState);
      expect(result).toBe(true);
    });

    it('should detect if sync is idle', () => {
      const result = syncSelectors.selectIsSyncIdle(mockState);
      expect(result).toBe(false);
    });

    it('should detect if has conflicts', () => {
      const result = syncSelectors.selectHasConflicts(mockState);
      expect(result).toBe(true);
    });

    it('should detect if has sync error', () => {
      const result = syncSelectors.selectHasSyncError(mockState);
      expect(result).toBe(false);
    });

    it('should determine if can sync', () => {
      const result = syncSelectors.selectCanSync(mockState);
      expect(result).toBe(false); // Currently syncing, so can't start another sync
    });
  });

  describe('complex selectors', () => {
    it('should create sync status summary', () => {
      const result = syncSelectors.selectSyncStatusSummary(mockState);
      expect(result).toEqual({
        status: SyncStatus.SYNCING,
        lastSyncTime: '2023-12-01T10:00:00Z',
        error: null,
        conflictCount: 2,
        progressPercentage: 25,
        currentItem: 'article-123',
        hasIssues: true, // Has conflicts
      });
    });

    it('should create sync health metrics', () => {
      const result = syncSelectors.selectSyncHealthMetrics(mockState);
      expect(result).toEqual({
        successRate: 80,
        avgDuration: 3500,
        conflicts: 2,
        dataTransferred: 3072,
        isOnline: true,
        healthScore: expect.any(Number),
      });
      expect(result.healthScore).toBeGreaterThan(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
    });
  });

  describe('timing selectors', () => {
    it('should calculate next sync time', () => {
      const result = syncSelectors.selectNextSyncTime(mockState);
      expect(result).toBeTruthy();
      expect(new Date(result as string).getTime()).toBeGreaterThan(
        new Date('2023-12-01T10:00:00Z').getTime()
      );
    });

    it('should handle null last sync time', () => {
      const stateWithoutLastSync = {
        ...mockState,
        sync: { ...mockState.sync, lastSyncTime: null },
      };
      const result = syncSelectors.selectNextSyncTime(stateWithoutLastSync);
      expect(result).toBe(null);
    });
  });
});
