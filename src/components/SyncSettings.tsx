import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from './ui/Text';
import { Button } from './ui/Button';
import { theme } from './ui/theme';
import { RootState, AppDispatch } from '../store';
import {
  pauseSync,
  resumeSync,
  clearSyncError,
  resetSyncStatus,
  cancelSync,
} from '../store/slices/syncSlice';
import { 
  startSyncOperation,
  pauseSyncOperation,
  resumeSyncOperation,
  cancelSyncOperation,
} from '../store/thunks/syncThunks';
import { SyncStatus } from '../types/sync';

export const SyncSettings: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { status, error, isOnline, networkType, progress, lastSyncTime } =
    useSelector((state: RootState) => state.sync);

  const [manualSyncLoading, setManualSyncLoading] = useState(false);

  // Debug log the sync state
  console.log('[SyncSettings] Full sync state:', { status, error, isOnline, lastSyncTime });

  const handleManualSync = useCallback(async () => {
    if (!isOnline) {
      Alert.alert(
        'No Connection',
        'Cannot sync while offline. Please check your internet connection and try again.'
      );
      return;
    }

    try {
      console.log('[SyncSettings] Starting manual sync...');
      setManualSyncLoading(true);
      // Reset sync status before starting new sync
      console.log('[SyncSettings] Resetting sync status...');
      dispatch(resetSyncStatus());
      
      console.log('[SyncSettings] Dispatching startSyncOperation...');
      await dispatch(
        startSyncOperation({
          syncOptions: {
            fullTextSync: true,
            downloadImages: true,
          },
          forceFull: false,
        })
      ).unwrap();
      console.log('[SyncSettings] Sync completed successfully');
    } catch (err) {
      console.error('[SyncSettings] Manual sync failed:', err);
      Alert.alert('Sync Error', err?.message || 'Failed to start sync. Please try again.');
    } finally {
      setManualSyncLoading(false);
    }
  }, [dispatch, isOnline]);

  const handlePauseSync = useCallback(async () => {
    try {
      await dispatch(pauseSyncOperation()).unwrap();
      dispatch(pauseSync());
    } catch (err) {
      console.error('[SyncSettings] Failed to pause sync:', err);
      Alert.alert('Error', 'Failed to pause sync');
    }
  }, [dispatch]);

  const handleResumeSync = useCallback(async () => {
    try {
      await dispatch(resumeSyncOperation()).unwrap();
    } catch (err) {
      console.error('[SyncSettings] Failed to resume sync:', err);
      Alert.alert('Error', err?.message || 'Failed to resume sync');
    }
  }, [dispatch]);

  const handleClearError = useCallback(() => {
    dispatch(clearSyncError());
  }, [dispatch]);

  const handleCancelSync = useCallback(async () => {
    try {
      await dispatch(cancelSyncOperation()).unwrap();
      dispatch(cancelSync());
    } catch (err) {
      console.error('[SyncSettings] Failed to cancel sync:', err);
      Alert.alert('Error', 'Failed to cancel sync');
    }
  }, [dispatch]);

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return 'Never';

    const now = new Date();
    const syncTime = new Date(lastSyncTime);
    const diffMs = now.getTime() - syncTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60)
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  const getSyncStatusText = () => {
    console.log('[SyncSettings] Current sync status:', status, 'Error:', error);
    switch (status) {
      case SyncStatus.IDLE:
        return 'Ready to sync';
      case SyncStatus.SYNCING:
        return `Syncing... ${progress.processedItems}/${progress.totalItems}`;
      case SyncStatus.PAUSED:
        return 'Sync paused';
      case SyncStatus.SUCCESS:
        return 'Last sync completed successfully';
      case SyncStatus.ERROR:
        return 'Sync failed';
      default:
        return 'Unknown status';
    }
  };

  const getSyncStatusColor = () => {
    switch (status) {
      case SyncStatus.IDLE:
        return theme.colors.neutral[600];
      case SyncStatus.SYNCING:
        return theme.colors.primary[600];
      case SyncStatus.PAUSED:
        return theme.colors.warning[600];
      case SyncStatus.SUCCESS:
        return theme.colors.success[600];
      case SyncStatus.ERROR:
        return theme.colors.error[600];
      default:
        return theme.colors.neutral[600];
    }
  };

  const getNetworkStatusText = () => {
    if (!isOnline) return 'Offline';
    if (networkType === 'wifi') return 'WiFi';
    if (networkType === 'cellular') return 'Cellular';
    return 'Connected';
  };

  const getNetworkStatusColor = () => {
    if (!isOnline) return theme.colors.error[600];
    if (networkType === 'wifi') return theme.colors.success[600];
    if (networkType === 'cellular') return theme.colors.warning[600];
    return theme.colors.success[600];
  };

  const renderSyncProgress = () => {
    if (status !== SyncStatus.SYNCING) return null;

    const progressPercentage =
      progress.totalItems > 0
        ? Math.round((progress.processedItems / progress.totalItems) * 100)
        : 0;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text variant='body2' style={styles.progressText}>
            {progress.phase.replace('_', ' ').toLowerCase()}
          </Text>
          <Text variant='body2' style={styles.progressText}>
            {progressPercentage}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progressPercentage}%` }]}
          />
        </View>
        {progress.currentItem && (
          <Text variant='caption' style={styles.currentItem} numberOfLines={1}>
            Processing: {progress.currentItem}
          </Text>
        )}
        {!!progress.estimatedTimeRemaining && (
          <Text variant='caption' style={styles.timeRemaining}>
            ~{Math.round(progress.estimatedTimeRemaining / 1000)}s remaining
          </Text>
        )}
      </View>
    );
  };


  const renderSyncControls = () => {
    const isSyncing = status === SyncStatus.SYNCING;
    const isPaused = status === SyncStatus.PAUSED;

    return (
      <View style={styles.controlsContainer}>
        {!isSyncing && !isPaused && (
          <Button
            variant='primary'
            onPress={handleManualSync}
            loading={manualSyncLoading}
            disabled={!isOnline}
            fullWidth
          >
            {isOnline ? 'Sync Now' : 'No Connection'}
          </Button>
        )}


        {isSyncing && (
          <Button variant='secondary' onPress={handlePauseSync} fullWidth>
            Pause Sync
          </Button>
        )}

        {isPaused && (
          <View style={styles.pausedControls}>
            <Button
              variant='primary'
              onPress={handleResumeSync}
              style={styles.resumeButton}
            >
              Resume
            </Button>
            <Button
              variant='outline'
              onPress={handleCancelSync}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
          </View>
        )}
      </View>
    );
  };

  const renderError = () => {
    if (!error) return null;

    return (
      <View style={styles.errorContainer}>
        <Text variant='body2' style={styles.errorText}>
          {error}
        </Text>
        <Button
          variant='outline'
          size='sm'
          onPress={handleClearError}
          style={styles.clearErrorButton}
        >
          Dismiss
        </Button>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sync Status */}
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <View style={styles.statusInfo}>
            <Text variant='body1' style={styles.statusLabel}>
              Sync Status
            </Text>
            <View style={styles.statusIndicator}>
              {status === SyncStatus.SYNCING && (
                <ActivityIndicator
                  size='small'
                  color={theme.colors.primary[500]}
                  style={styles.statusSpinner}
                />
              )}
              <Text
                variant='body2'
                style={[styles.statusText, { color: getSyncStatusColor() }]}
              >
                {getSyncStatusText()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusInfo}>
            <Text variant='body1' style={styles.statusLabel}>
              Network
            </Text>
            <Text
              variant='body2'
              style={[styles.statusText, { color: getNetworkStatusColor() }]}
            >
              {getNetworkStatusText()}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusInfo}>
            <Text variant='body1' style={styles.statusLabel}>
              Last Sync
            </Text>
            <Text variant='body2' style={styles.statusText}>
              {formatLastSyncTime()}
            </Text>
          </View>
        </View>
      </View>

      {/* Sync Progress */}
      {renderSyncProgress()}

      {/* Error Display */}
      {renderError()}

      {/* Sync Controls */}
      {renderSyncControls()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing[4],
    marginHorizontal: theme.spacing[4],
    marginVertical: theme.spacing[3],
    ...theme.shadows.sm,
  },
  statusContainer: {
    marginBottom: theme.spacing[4],
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    color: theme.colors.neutral[700],
    marginBottom: theme.spacing[1],
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusSpinner: {
    marginRight: theme.spacing[2],
  },
  statusText: {
    fontWeight: theme.typography.fontWeight.medium,
  },
  progressContainer: {
    marginBottom: theme.spacing[4],
    padding: theme.spacing[3],
    backgroundColor: theme.colors.primary[50],
    borderRadius: theme.borderRadius.base,
    borderWidth: 1,
    borderColor: theme.colors.primary[200],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  progressText: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.primary[200],
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    marginBottom: theme.spacing[2],
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.borderRadius.full,
  },
  currentItem: {
    color: theme.colors.primary[600],
    marginBottom: theme.spacing[1],
  },
  timeRemaining: {
    color: theme.colors.primary[600],
    textAlign: 'right',
  },
  controlsContainer: {
    marginTop: theme.spacing[2],
  },
  pausedControls: {
    flexDirection: 'row',
    gap: theme.spacing[3],
  },
  resumeButton: {
    flex: 1,
  },
  cancelButton: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: theme.colors.error[50],
    borderWidth: 1,
    borderColor: theme.colors.error[200],
    borderRadius: theme.borderRadius.base,
    padding: theme.spacing[3],
    marginBottom: theme.spacing[4],
  },
  errorText: {
    color: theme.colors.error[700],
    marginBottom: theme.spacing[2],
  },
  clearErrorButton: {
    alignSelf: 'flex-start',
  },
});
