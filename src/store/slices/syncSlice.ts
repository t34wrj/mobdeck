import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  SyncState,
  SyncStatus,
  SyncPhase,
  NetworkType,
  ConflictResolutionStrategy,
  StartSyncPayload,
  SyncProgressPayload,
  SyncSuccessPayload,
  SyncErrorPayload,
  AddConflictPayload,
  ResolveConflictPayload,
  UpdateSyncConfigPayload,
  NetworkStatusPayload,
} from '../../types/sync';

const initialState: SyncState = {
  // Sync status tracking
  status: SyncStatus.IDLE,
  lastSyncTime: null,

  // Progress tracking
  progress: {
    phase: SyncPhase.INITIALIZING,
    totalItems: 0,
    processedItems: 0,
    currentItem: null,
    estimatedTimeRemaining: null,
  },

  // Network and connectivity
  isOnline: true,
  networkType: null,

  // Configuration
  config: {
    backgroundSyncEnabled: true,
    syncInterval: 15, // 15 minutes
    syncOnWifiOnly: false,
    syncOnCellular: true,
    downloadImages: true,
    fullTextSync: true,
    conflictResolutionStrategy: ConflictResolutionStrategy.LAST_WRITE_WINS,
    batchSize: 50,
  },

  // Conflict resolution
  conflicts: [],

  // Error handling
  error: null,

  // Statistics
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

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    // Sync lifecycle actions
    startSync: (state, action: PayloadAction<StartSyncPayload>) => {
      state.status = SyncStatus.SYNCING;
      state.error = null;
      state.progress = {
        phase: SyncPhase.INITIALIZING,
        totalItems: 0,
        processedItems: 0,
        currentItem: null,
        estimatedTimeRemaining: null,
      };

      // Apply any sync options
      if (action.payload.syncOptions) {
        state.config = { ...state.config, ...action.payload.syncOptions };
      }

      // Increment total sync count
      state.stats.totalSyncs += 1;
    },

    syncProgress: (state, action: PayloadAction<SyncProgressPayload>) => {
      if (state.status === SyncStatus.SYNCING) {
        state.progress = {
          ...state.progress,
          ...action.payload,
        };
      }
    },

    syncSuccess: (state, action: PayloadAction<SyncSuccessPayload>) => {
      state.status = SyncStatus.SUCCESS;
      state.error = null;
      state.lastSyncTime = action.payload.syncTime;

      // Update statistics
      state.stats.successfulSyncs += 1;
      state.stats.lastSyncDuration = action.payload.syncDuration;

      // Calculate average sync duration
      const totalDuration =
        (state.stats.averageSyncDuration || 0) *
          (state.stats.successfulSyncs - 1) +
        action.payload.syncDuration;
      state.stats.averageSyncDuration =
        totalDuration / state.stats.successfulSyncs;

      // Reset progress
      state.progress = {
        phase: SyncPhase.FINALIZING,
        totalItems: action.payload.itemsProcessed,
        processedItems: action.payload.itemsProcessed,
        currentItem: null,
        estimatedTimeRemaining: 0,
      };
    },

    syncError: (state, action: PayloadAction<SyncErrorPayload>) => {
      state.status = SyncStatus.ERROR;
      state.error = action.payload.error;
      state.stats.failedSyncs += 1;

      // Reset progress on error
      state.progress = {
        ...state.progress,
        currentItem: null,
        estimatedTimeRemaining: null,
      };
    },

    pauseSync: state => {
      if (state.status === SyncStatus.SYNCING) {
        state.status = SyncStatus.PAUSED;
      }
    },

    resumeSync: state => {
      if (state.status === SyncStatus.PAUSED) {
        state.status = SyncStatus.SYNCING;
      }
    },

    // Conflict resolution actions
    addConflict: (state, action: PayloadAction<AddConflictPayload>) => {
      const conflictId = `${action.payload.articleId}_${Date.now()}`;
      const conflict = {
        id: conflictId,
        articleId: action.payload.articleId,
        type: action.payload.type,
        localVersion: action.payload.localVersion,
        remoteVersion: action.payload.remoteVersion,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        resolution: null,
      };

      state.conflicts.push(conflict);
    },

    resolveConflict: (state, action: PayloadAction<ResolveConflictPayload>) => {
      const conflictIndex = state.conflicts.findIndex(
        conflict => conflict.id === action.payload.conflictId
      );

      if (conflictIndex !== -1) {
        state.conflicts[conflictIndex] = {
          ...state.conflicts[conflictIndex],
          resolvedAt: new Date().toISOString(),
          resolution: action.payload.resolution,
        };

        // Remove resolved conflict after a short delay (handled by middleware)
        // For now, we'll remove it immediately
        state.conflicts.splice(conflictIndex, 1);
        state.stats.itemsSynced.conflictsResolved += 1;
      }
    },

    clearConflicts: state => {
      state.conflicts = [];
    },

    // Configuration actions
    updateSyncConfig: (
      state,
      action: PayloadAction<UpdateSyncConfigPayload>
    ) => {
      state.config = { ...state.config, ...action.payload.config };
    },

    resetSyncConfig: state => {
      state.config = initialState.config;
    },

    // Network status actions
    updateNetworkStatus: (
      state,
      action: PayloadAction<NetworkStatusPayload>
    ) => {
      state.isOnline = action.payload.isOnline;
      state.networkType = action.payload.networkType;

      // Pause sync if offline
      if (!action.payload.isOnline && state.status === SyncStatus.SYNCING) {
        state.status = SyncStatus.PAUSED;
      }
    },

    // State management actions
    resetSyncState: state => {
      return {
        ...initialState,
        // Preserve configuration and statistics across resets
        config: state.config,
        stats: state.stats,
      };
    },

    clearSyncError: state => {
      state.error = null;
      if (state.status === SyncStatus.ERROR) {
        state.status = SyncStatus.IDLE;
      }
    },

    cancelSync: state => {
      state.status = SyncStatus.IDLE;
      state.error = null;
      state.progress = {
        phase: SyncPhase.INITIALIZING,
        totalItems: 0,
        processedItems: 0,
        currentItem: null,
        estimatedTimeRemaining: null,
      };
    },

    // Statistics actions
    updateSyncStats: (
      state,
      action: PayloadAction<{
        articlesCreated?: number;
        articlesUpdated?: number;
        articlesDeleted?: number;
        bytesUploaded?: number;
        bytesDownloaded?: number;
        requestCount?: number;
        cacheHits?: number;
      }>
    ) => {
      const { payload } = action;

      if (payload.articlesCreated !== undefined) {
        state.stats.itemsSynced.articlesCreated += payload.articlesCreated;
      }
      if (payload.articlesUpdated !== undefined) {
        state.stats.itemsSynced.articlesUpdated += payload.articlesUpdated;
      }
      if (payload.articlesDeleted !== undefined) {
        state.stats.itemsSynced.articlesDeleted += payload.articlesDeleted;
      }
      if (payload.bytesUploaded !== undefined) {
        state.stats.dataTransfer.bytesUploaded += payload.bytesUploaded;
      }
      if (payload.bytesDownloaded !== undefined) {
        state.stats.dataTransfer.bytesDownloaded += payload.bytesDownloaded;
      }
      if (payload.requestCount !== undefined) {
        state.stats.dataTransfer.requestCount += payload.requestCount;
      }
      if (payload.cacheHits !== undefined) {
        state.stats.dataTransfer.cacheHits += payload.cacheHits;
      }
    },

    resetSyncStats: state => {
      state.stats = initialState.stats;
    },
  },
  extraReducers: (builder) => {
    // Handle async thunk actions
    builder
      // Start sync operation
      .addCase('sync/startOperation/pending', (state) => {
        state.status = SyncStatus.SYNCING;
        state.error = null;
        state.progress = {
          phase: SyncPhase.INITIALIZING,
          totalItems: 0,
          processedItems: 0,
          currentItem: null,
          estimatedTimeRemaining: null,
        };
        state.stats.totalSyncs += 1;
      })
      .addCase('sync/startOperation/fulfilled', (state) => {
        // Success is handled by the sync service dispatching syncSuccess
      })
      .addCase('sync/startOperation/rejected', (state, action) => {
        state.status = SyncStatus.ERROR;
        state.error = action.error.message || 'Sync failed';
        state.stats.failedSyncs += 1;
      })
      // Pause sync operation
      .addCase('sync/pauseOperation/fulfilled', (state) => {
        if (state.status === SyncStatus.SYNCING) {
          state.status = SyncStatus.PAUSED;
        }
      })
      // Resume sync operation
      .addCase('sync/resumeOperation/pending', (state) => {
        if (state.status === SyncStatus.PAUSED) {
          state.status = SyncStatus.SYNCING;
        }
      })
      .addCase('sync/resumeOperation/rejected', (state, action) => {
        state.status = SyncStatus.ERROR;
        state.error = action.error.message || 'Resume sync failed';
      })
      // Cancel sync operation
      .addCase('sync/cancelOperation/fulfilled', (state) => {
        state.status = SyncStatus.IDLE;
        state.error = null;
        state.progress = {
          phase: SyncPhase.INITIALIZING,
          totalItems: 0,
          processedItems: 0,
          currentItem: null,
          estimatedTimeRemaining: null,
        };
      });
  },
});

// Export action creators
export const {
  startSync,
  syncProgress,
  syncSuccess,
  syncError,
  pauseSync,
  resumeSync,
  cancelSync,
  addConflict,
  resolveConflict,
  clearConflicts,
  updateSyncConfig,
  resetSyncConfig,
  updateNetworkStatus,
  resetSyncState,
  clearSyncError,
  updateSyncStats,
  resetSyncStats,
} = syncSlice.actions;

export default syncSlice.reducer;
