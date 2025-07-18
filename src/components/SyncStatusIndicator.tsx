/**
 * Sync Status Indicator Component
 * Displays sync status with enhanced error reporting and recovery options
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSyncStatus, useSyncErrorRecovery } from '../hooks/useSyncStatus';
import { SyncStatus, SyncPhase } from '../types/sync';
import { useAppTheme } from '../hooks/useAppTheme';

interface SyncStatusIndicatorProps {
  showProgress?: boolean;
  showErrors?: boolean;
  showRecoveryActions?: boolean;
  compact?: boolean;
  onStatusPress?: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  showProgress = true,
  showErrors = true,
  showRecoveryActions = true,
  compact = false,
  onStatusPress
}) => {
  const theme = useAppTheme();
  const syncStatus = useSyncStatus();
  const { recoveryActions, hasRecoveryActions } = useSyncErrorRecovery();
  
  const getStatusColor = () => {
    switch (syncStatus.status) {
      case SyncStatus.SYNCING:
        return theme.colors.primary;
      case SyncStatus.SUCCESS:
        return theme.colors.success;
      case SyncStatus.ERROR:
        return theme.colors.error;
      case SyncStatus.PAUSED:
        return theme.colors.warning;
      default:
        return theme.colors.textSecondary;
    }
  };
  
  const getStatusText = () => {
    switch (syncStatus.status) {
      case SyncStatus.SYNCING:
        return getPhaseText(syncStatus.phase);
      case SyncStatus.SUCCESS:
        return 'Sync completed successfully';
      case SyncStatus.ERROR:
        return syncStatus.error.userMessage || 'Sync failed';
      case SyncStatus.PAUSED:
        return 'Sync paused';
      default:
        return 'Ready to sync';
    }
  };
  
  const getPhaseText = (phase: SyncPhase) => {
    switch (phase) {
      case SyncPhase.INITIALIZING:
        return 'Initializing sync...';
      case SyncPhase.CHECKING_CONNECTION:
        return 'Checking connection...';
      case SyncPhase.UPLOADING_CHANGES:
        return 'Uploading changes...';
      case SyncPhase.DOWNLOADING_UPDATES:
        return 'Downloading updates...';
      case SyncPhase.FETCHING_REMOTE_DATA:
        return 'Fetching remote data...';
      case SyncPhase.RESOLVING_CONFLICTS:
        return 'Resolving conflicts...';
      case SyncPhase.FINALIZING:
        return 'Finalizing sync...';
      case SyncPhase.COMPLETED:
        return 'Sync completed';
      default:
        return 'Syncing...';
    }
  };
  
  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };
  
  const handleStatusPress = () => {
    if (onStatusPress) {
      onStatusPress();
    } else if (syncStatus.error.hasError && hasRecoveryActions) {
      // Show recovery actions
      showRecoveryActionDialog();
    }
  };
  
  const showRecoveryActionDialog = () => {
    if (!hasRecoveryActions) return;
    
    const actionButtons = recoveryActions.map(action => ({
      text: action.label,
      onPress: action.action,
      style: action.isPrimary ? 'default' : 'cancel'
    }));
    
    Alert.alert(
      'Sync Error Recovery',
      syncStatus.error.userMessage || 'Choose a recovery action:',
      actionButtons
    );
  };
  
  const styles = StyleSheet.create({
    container: {
      padding: compact ? 8 : 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginVertical: 4,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusText: {
      fontSize: compact ? 12 : 14,
      fontWeight: '500',
      color: getStatusColor(),
      flex: 1,
    },
    progressContainer: {
      marginTop: 8,
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: 2,
      marginTop: 4,
    },
    progressFill: {
      height: '100%',
      backgroundColor: getStatusColor(),
      borderRadius: 2,
      minWidth: 8,
    },
    progressText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    errorContainer: {
      marginTop: 8,
      padding: 8,
      backgroundColor: theme.colors.errorBackground,
      borderRadius: 6,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.error,
      marginBottom: 4,
    },
    suggestionText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 10,
      color: theme.colors.textSecondary,
    },
    statValue: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.textPrimary,
    },
    networkStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
    },
    networkIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: syncStatus.network.isOnline ? theme.colors.success : theme.colors.error,
      marginRight: 4,
    },
    networkText: {
      fontSize: 10,
      color: theme.colors.textSecondary,
    },
    retryButton: {
      marginTop: 8,
      padding: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 6,
      alignItems: 'center',
    },
    retryButtonText: {
      fontSize: 12,
      color: theme.colors.white,
      fontWeight: '500',
    },
  });
  
  if (compact) {
    return (
      <TouchableOpacity 
        style={styles.container} 
        onPress={handleStatusPress}
        disabled={!syncStatus.error.hasError && !onStatusPress}
      >
        <View style={styles.statusRow}>
          <Text style={styles.statusText} numberOfLines={1}>
            {getStatusText()}
          </Text>
          <View style={styles.networkStatus}>
            <View style={styles.networkIndicator} />
            <Text style={styles.networkText}>
              {syncStatus.network.networkType || 'Unknown'}
            </Text>
          </View>
        </View>
        
        {showProgress && syncStatus.isActive && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${syncStatus.progress.percentage}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {syncStatus.progress.percentage}% • {syncStatus.progress.currentItem || 'Processing...'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }
  
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={handleStatusPress}
      disabled={!syncStatus.error.hasError && !onStatusPress}
    >
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {getStatusText()}
        </Text>
        <View style={styles.networkStatus}>
          <View style={styles.networkIndicator} />
          <Text style={styles.networkText}>
            {syncStatus.network.isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
      
      {showProgress && syncStatus.isActive && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${syncStatus.progress.percentage}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {syncStatus.progress.percentage}% • {syncStatus.progress.processedItems}/{syncStatus.progress.totalItems} items
          </Text>
          {syncStatus.progress.currentItem && (
            <Text style={styles.progressText} numberOfLines={1}>
              {syncStatus.progress.currentItem}
            </Text>
          )}
          {syncStatus.progress.estimatedTimeRemaining && (
            <Text style={styles.progressText}>
              Est. time remaining: {formatDuration(syncStatus.progress.estimatedTimeRemaining)}
            </Text>
          )}
        </View>
      )}
      
      {showErrors && syncStatus.error.hasError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {syncStatus.error.userMessage || syncStatus.error.message}
          </Text>
          {syncStatus.error.suggestedAction && (
            <Text style={styles.suggestionText}>
              💡 {syncStatus.error.suggestedAction}
            </Text>
          )}
          {showRecoveryActions && hasRecoveryActions && (
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={showRecoveryActionDialog}
            >
              <Text style={styles.retryButtonText}>
                {syncStatus.error.isRetryable ? 'Retry' : 'Fix Issue'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {!syncStatus.error.hasError && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Success Rate</Text>
            <Text style={styles.statValue}>{syncStatus.stats.successRate}%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Syncs</Text>
            <Text style={styles.statValue}>{syncStatus.stats.totalSyncs}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Last Duration</Text>
            <Text style={styles.statValue}>
              {formatDuration(syncStatus.stats.lastSyncDuration)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Conflicts</Text>
            <Text style={styles.statValue}>{syncStatus.conflicts.count}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default SyncStatusIndicator;