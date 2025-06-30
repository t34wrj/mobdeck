import syncReducer, {
  startSync,
  syncProgress,
  syncSuccess,
  syncError,
  addConflict,
  resolveConflict,
  updateSyncConfig,
  clearSyncError,
  resetSyncState,
} from '../../src/store/slices/syncSlice';
import {
  SyncStatus,
  SyncPhase,
  ConflictType,
  ConflictResolutionStrategy,
} from '../../src/types/sync';

describe('syncSlice', () => {
  const initialState = {
    status: SyncStatus.IDLE,
    lastSyncTime: null,
    progress: {
      phase: SyncPhase.INITIALIZING,
      totalItems: 0,
      processedItems: 0,
      currentItem: null,
      estimatedTimeRemaining: null,
    },
    isOnline: true,
    networkType: null,
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
    error: null,
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
  };

  it('should return the initial state', () => {
    expect(syncReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle startSync', () => {
    const action = startSync({ fullSync: true });
    const state = syncReducer(initialState, action);

    expect(state.status).toBe(SyncStatus.SYNCING);
    expect(state.error).toBe(null);
    expect(state.stats.totalSyncs).toBe(1);
  });

  it('should handle syncProgress', () => {
    const syncingState = { ...initialState, status: SyncStatus.SYNCING };
    const action = syncProgress({
      phase: SyncPhase.DOWNLOADING_UPDATES,
      totalItems: 100,
      processedItems: 25,
      currentItem: 'article-123',
    });
    const state = syncReducer(syncingState, action);

    expect(state.progress.phase).toBe(SyncPhase.DOWNLOADING_UPDATES);
    expect(state.progress.totalItems).toBe(100);
    expect(state.progress.processedItems).toBe(25);
    expect(state.progress.currentItem).toBe('article-123');
  });

  it('should handle syncSuccess', () => {
    const syncingState = { ...initialState, status: SyncStatus.SYNCING };
    const action = syncSuccess({
      syncDuration: 5000,
      itemsProcessed: 50,
      conflictsDetected: 0,
      syncTime: '2023-12-01T10:00:00Z',
    });
    const state = syncReducer(syncingState, action);

    expect(state.status).toBe(SyncStatus.SUCCESS);
    expect(state.lastSyncTime).toBe('2023-12-01T10:00:00Z');
    expect(state.stats.successfulSyncs).toBe(1);
    expect(state.stats.lastSyncDuration).toBe(5000);
  });

  it('should handle syncError', () => {
    const syncingState = { ...initialState, status: SyncStatus.SYNCING };
    const action = syncError({
      error: 'Network timeout',
      errorCode: 'TIMEOUT',
      phase: SyncPhase.UPLOADING_CHANGES,
    });
    const state = syncReducer(syncingState, action);

    expect(state.status).toBe(SyncStatus.ERROR);
    expect(state.error).toBe('Network timeout');
    expect(state.stats.failedSyncs).toBe(1);
  });

  it('should handle addConflict', () => {
    const action = addConflict({
      articleId: 'article-123',
      type: ConflictType.CONTENT_MODIFIED,
      localVersion: { title: 'Local Title' },
      remoteVersion: { title: 'Remote Title' },
    });
    const state = syncReducer(initialState, action);

    expect(state.conflicts).toHaveLength(1);
    expect(state.conflicts[0].articleId).toBe('article-123');
    expect(state.conflicts[0].type).toBe(ConflictType.CONTENT_MODIFIED);
  });

  it('should handle resolveConflict', () => {
    const conflictState = {
      ...initialState,
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
      ],
    };

    const action = resolveConflict({
      conflictId: 'conflict-1',
      resolution: ConflictResolutionStrategy.LAST_WRITE_WINS,
    });
    const state = syncReducer(conflictState, action);

    expect(state.conflicts).toHaveLength(0);
    expect(state.stats.itemsSynced.conflictsResolved).toBe(1);
  });

  it('should handle updateSyncConfig', () => {
    const action = updateSyncConfig({
      config: {
        syncInterval: 30,
        syncOnWifiOnly: true,
      },
    });
    const state = syncReducer(initialState, action);

    expect(state.config.syncInterval).toBe(30);
    expect(state.config.syncOnWifiOnly).toBe(true);
    expect(state.config.backgroundSyncEnabled).toBe(true); // Should preserve existing values
  });

  it('should handle clearSyncError', () => {
    const errorState = { ...initialState, status: SyncStatus.ERROR, error: 'Test error' };
    const action = clearSyncError();
    const state = syncReducer(errorState, action);

    expect(state.error).toBe(null);
    expect(state.status).toBe(SyncStatus.IDLE);
  });

  it('should handle resetSyncState', () => {
    const modifiedState = {
      ...initialState,
      status: SyncStatus.ERROR,
      error: 'Test error',
      lastSyncTime: '2023-12-01T10:00:00Z',
      conflicts: [
        {
          id: 'conflict-1',
          articleId: 'article-123',
          type: ConflictType.CONTENT_MODIFIED,
          localVersion: {},
          remoteVersion: {},
          createdAt: '2023-12-01T09:00:00Z',
          resolvedAt: null,
          resolution: null,
        },
      ],
      stats: {
        ...initialState.stats,
        totalSyncs: 5,
        successfulSyncs: 3,
      },
    };

    const action = resetSyncState();
    const state = syncReducer(modifiedState, action);

    expect(state.status).toBe(SyncStatus.IDLE);
    expect(state.error).toBe(null);
    expect(state.lastSyncTime).toBe(null);
    expect(state.conflicts).toHaveLength(0);
    // Should preserve stats and config
    expect(state.stats.totalSyncs).toBe(5);
    expect(state.config).toEqual(modifiedState.config);
  });
});