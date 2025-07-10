import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { SyncStatus, ConflictType } from '../../types/sync';

// Base selector for sync state
const selectSyncState = (state: RootState) => state.sync;

// Basic selectors
export const selectSyncStatus = createSelector(
  [selectSyncState],
  sync => sync.status
);

export const selectLastSyncTime = createSelector(
  [selectSyncState],
  sync => sync.lastSyncTime
);

export const selectSyncError = createSelector(
  [selectSyncState],
  sync => sync.error
);

export const selectIsOnline = createSelector(
  [selectSyncState],
  sync => sync.isOnline
);

export const selectNetworkType = createSelector(
  [selectSyncState],
  sync => sync.networkType
);

// Progress selectors
export const selectSyncProgress = createSelector(
  [selectSyncState],
  sync => sync.progress
);

export const selectSyncPhase = createSelector(
  [selectSyncProgress],
  progress => progress.phase
);

export const selectSyncProgressPercentage = createSelector(
  [selectSyncProgress],
  progress => {
    if (progress.totalItems === 0) return 0;
    return Math.round((progress.processedItems / progress.totalItems) * 100);
  }
);

export const selectCurrentSyncItem = createSelector(
  [selectSyncProgress],
  progress => progress.currentItem
);

export const selectEstimatedTimeRemaining = createSelector(
  [selectSyncProgress],
  progress => progress.estimatedTimeRemaining
);

// Configuration selectors
export const selectSyncConfig = createSelector(
  [selectSyncState],
  sync => sync.config
);

export const selectBackgroundSyncEnabled = createSelector(
  [selectSyncConfig],
  config => config.backgroundSyncEnabled
);

export const selectSyncInterval = createSelector(
  [selectSyncConfig],
  config => config.syncInterval
);

export const selectSyncOnWifiOnly = createSelector(
  [selectSyncConfig],
  config => config.syncOnWifiOnly
);

export const selectConflictResolutionStrategy = createSelector(
  [selectSyncConfig],
  config => config.conflictResolutionStrategy
);

// Conflict selectors
export const selectSyncConflicts = createSelector(
  [selectSyncState],
  sync => sync.conflicts
);

export const selectConflictCount = createSelector(
  [selectSyncConflicts],
  conflicts => conflicts.length
);

export const selectUnresolvedConflicts = createSelector(
  [selectSyncConflicts],
  conflicts => conflicts.filter(conflict => !conflict.resolvedAt)
);

export const selectConflictsByType = createSelector(
  [selectSyncConflicts],
  conflicts => {
    return conflicts.reduce(
      (acc, conflict) => {
        const type = conflict.type;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(conflict);
        return acc;
      },
      {} as Record<ConflictType, typeof conflicts>
    );
  }
);

export const selectConflictsByArticle = createSelector(
  [selectSyncConflicts],
  conflicts => {
    return conflicts.reduce(
      (acc, conflict) => {
        const articleId = conflict.articleId;
        if (!acc[articleId]) {
          acc[articleId] = [];
        }
        acc[articleId].push(conflict);
        return acc;
      },
      {} as Record<string, typeof conflicts>
    );
  }
);

// Statistics selectors
export const selectSyncStats = createSelector(
  [selectSyncState],
  sync => sync.stats
);

export const selectTotalSyncs = createSelector(
  [selectSyncStats],
  stats => stats.totalSyncs
);

export const selectSuccessfulSyncs = createSelector(
  [selectSyncStats],
  stats => stats.successfulSyncs
);

export const selectFailedSyncs = createSelector(
  [selectSyncStats],
  stats => stats.failedSyncs
);

export const selectSyncSuccessRate = createSelector(
  [selectTotalSyncs, selectSuccessfulSyncs],
  (total, successful) => {
    if (total === 0) return 0;
    return Math.round((successful / total) * 100);
  }
);

export const selectLastSyncDuration = createSelector(
  [selectSyncStats],
  stats => stats.lastSyncDuration
);

export const selectAverageSyncDuration = createSelector(
  [selectSyncStats],
  stats => stats.averageSyncDuration
);

export const selectItemsSynced = createSelector(
  [selectSyncStats],
  stats => stats.itemsSynced
);

export const selectDataTransferStats = createSelector(
  [selectSyncStats],
  stats => stats.dataTransfer
);

export const selectTotalDataTransferred = createSelector(
  [selectDataTransferStats],
  dataTransfer => dataTransfer.bytesUploaded + dataTransfer.bytesDownloaded
);

// Boolean selectors for UI state
export const selectIsSyncing = createSelector(
  [selectSyncStatus],
  status => status === SyncStatus.SYNCING
);

export const selectIsSyncIdle = createSelector(
  [selectSyncStatus],
  status => status === SyncStatus.IDLE
);

export const selectIsSyncSuccessful = createSelector(
  [selectSyncStatus],
  status => status === SyncStatus.SUCCESS
);

export const selectIsSyncError = createSelector(
  [selectSyncStatus],
  status => status === SyncStatus.ERROR
);

export const selectIsSyncPaused = createSelector(
  [selectSyncStatus],
  status => status === SyncStatus.PAUSED
);

export const selectHasConflicts = createSelector(
  [selectConflictCount],
  count => count > 0
);

export const selectHasSyncError = createSelector(
  [selectSyncError],
  error => error !== null
);

export const selectCanSync = createSelector(
  [selectIsOnline, selectSyncStatus, selectSyncConfig],
  (isOnline, status, config) => {
    if (!isOnline) return false;
    if (status === SyncStatus.SYNCING) return false;

    // Check network restrictions
    if (config.syncOnWifiOnly && config.syncOnCellular === false) {
      // Would need to check network type here
      return true; // Simplified for now
    }

    return true;
  }
);

// Complex computed selectors
export const selectSyncStatusSummary = createSelector(
  [
    selectSyncStatus,
    selectLastSyncTime,
    selectSyncError,
    selectConflictCount,
    selectSyncProgressPercentage,
    selectCurrentSyncItem,
  ],
  (
    status,
    lastSyncTime,
    error,
    conflictCount,
    progressPercentage,
    currentItem
  ) => ({
    status,
    lastSyncTime,
    error,
    conflictCount,
    progressPercentage,
    currentItem,
    hasIssues: error !== null || conflictCount > 0,
  })
);

export const selectSyncHealthMetrics = createSelector(
  [
    selectSyncSuccessRate,
    selectAverageSyncDuration,
    selectConflictCount,
    selectTotalDataTransferred,
    selectIsOnline,
  ],
  (successRate, avgDuration, conflicts, dataTransferred, isOnline) => ({
    successRate,
    avgDuration,
    conflicts,
    dataTransferred,
    isOnline,
    healthScore: calculateHealthScore(successRate, conflicts, isOnline),
  })
);

// Helper function for health score calculation
function calculateHealthScore(
  successRate: number,
  conflictCount: number,
  isOnline: boolean
): number {
  let score = 100;

  // Reduce score based on success rate
  score -= (100 - successRate) * 0.5;

  // Reduce score for conflicts
  score -= Math.min(conflictCount * 5, 30);

  // Reduce score if offline
  if (!isOnline) {
    score -= 20;
  }

  return Math.max(0, Math.round(score));
}

// Selectors for sync timing and scheduling
export const selectNextSyncTime = createSelector(
  [selectLastSyncTime, selectSyncInterval],
  (lastSyncTime, interval) => {
    if (!lastSyncTime) return null;

    const lastSync = new Date(lastSyncTime);
    const nextSync = new Date(lastSync.getTime() + interval * 60 * 1000);

    return nextSync.toISOString();
  }
);

export const selectTimeUntilNextSync = createSelector(
  [selectNextSyncTime],
  nextSyncTime => {
    if (!nextSyncTime) return null;

    const now = new Date();
    const next = new Date(nextSyncTime);
    const diff = next.getTime() - now.getTime();

    return Math.max(0, diff);
  }
);

export const selectIsSyncDue = createSelector(
  [selectTimeUntilNextSync],
  timeUntilNext => {
    if (timeUntilNext === null) return false;
    return timeUntilNext <= 0;
  }
);
