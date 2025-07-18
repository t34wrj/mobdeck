/**
 * Hook for accessing sync status with enhanced error reporting
 */

import { useSelector } from 'react-redux';
import { useMemo } from 'react';
import { RootState } from '../store';
import { SyncStatus, SyncPhase, ErrorType } from '../types/sync';
import { logger } from '../utils/logger';

interface SyncStatusInfo {
  // Basic sync status
  status: SyncStatus;
  phase: SyncPhase;
  isActive: boolean;
  lastSyncTime: string | null;
  
  // Progress information
  progress: {
    phase: SyncPhase;
    totalItems: number;
    processedItems: number;
    currentItem: string | null;
    estimatedTimeRemaining: number | null;
    percentage: number;
  };
  
  // Error information
  error: {
    hasError: boolean;
    message: string | null;
    userMessage: string | null;
    suggestedAction: string | null;
    isRetryable: boolean;
    errorCode: string | null;
    errorType: ErrorType | null;
  };
  
  // Network status
  network: {
    isOnline: boolean;
    networkType: string | null;
  };
  
  // Statistics
  stats: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    lastSyncDuration: number | null;
    averageSyncDuration: number | null;
  };
  
  // Conflicts
  conflicts: {
    count: number;
    hasConflicts: boolean;
  };
}

export const useSyncStatus = (): SyncStatusInfo => {
  const syncState = useSelector((state: RootState) => state.sync);
  
  const syncStatusInfo = useMemo(() => {
    // Calculate progress percentage
    const percentage = syncState.progress.totalItems > 0 
      ? Math.round((syncState.progress.processedItems / syncState.progress.totalItems) * 100)
      : 0;
    
    // Calculate success rate
    const successRate = syncState.stats.totalSyncs > 0
      ? Math.round((syncState.stats.successfulSyncs / syncState.stats.totalSyncs) * 100)
      : 0;
    
    // Get recent error information from logger
    const errorSummary = logger.getErrorSummary(new Date(Date.now() - 24 * 60 * 60 * 1000)); // Last 24 hours
    const recentSyncError = errorSummary.recentErrors.find(err => 
      err.message.toLowerCase().includes('sync')
    );
    
    // Enhanced error information
    const errorInfo = {
      hasError: syncState.status === SyncStatus.ERROR || !!syncState.error,
      message: syncState.error,
      userMessage: recentSyncError?.userMessage || null,
      suggestedAction: recentSyncError?.suggestedAction || null,
      isRetryable: recentSyncError?.isRetryable || false,
      errorCode: null, // Will be populated from error classification
      errorType: null as ErrorType | null
    };
    
    // Try to classify the current error
    if (syncState.error) {
      try {
        const classification = logger.errorWithClassification(
          'Sync error', 
          syncState.error
        );
        errorInfo.userMessage = classification.userMessage || null;
        errorInfo.suggestedAction = classification.suggestedAction || null;
        errorInfo.isRetryable = classification.isRetryable;
        errorInfo.errorCode = classification.errorCode || null;
        errorInfo.errorType = classification.type;
      } catch (error) {
        // If classification fails, use basic error information
        console.warn('Error classification failed:', error);
      }
    }
    
    return {
      status: syncState.status,
      phase: syncState.progress.phase,
      isActive: syncState.status === SyncStatus.SYNCING,
      lastSyncTime: syncState.lastSyncTime,
      
      progress: {
        ...syncState.progress,
        percentage
      },
      
      error: errorInfo,
      
      network: {
        isOnline: syncState.isOnline,
        networkType: syncState.networkType
      },
      
      stats: {
        ...syncState.stats,
        successRate
      },
      
      conflicts: {
        count: syncState.conflicts.length,
        hasConflicts: syncState.conflicts.length > 0
      }
    };
  }, [syncState]);
  
  return syncStatusInfo;
};

/**
 * Hook for sync error recovery actions
 */
export const useSyncErrorRecovery = () => {
  const syncStatus = useSyncStatus();
  
  const getRecoveryActions = useMemo(() => {
    const actions: Array<{
      id: string;
      label: string;
      action: () => void;
      isPrimary: boolean;
    }> = [];
    
    if (syncStatus.error.hasError) {
      // Add retry action for retryable errors
      if (syncStatus.error.isRetryable) {
        actions.push({
          id: 'retry',
          label: 'Retry Sync',
          action: () => {
            // This would typically dispatch a retry action
            console.log('Retrying sync...');
          },
          isPrimary: true
        });
      }
      
      // Add network-specific actions
      if (syncStatus.error.errorType === ErrorType.NETWORK) {
        actions.push({
          id: 'check_network',
          label: 'Check Network',
          action: () => {
            // Open network settings or check connectivity
            console.log('Checking network...');
          },
          isPrimary: false
        });
      }
      
      // Add authentication-specific actions
      if (syncStatus.error.errorType === ErrorType.AUTHENTICATION) {
        actions.push({
          id: 'relogin',
          label: 'Re-login',
          action: () => {
            // Navigate to login screen
            console.log('Navigating to login...');
          },
          isPrimary: true
        });
      }
      
      // Add general dismiss action
      actions.push({
        id: 'dismiss',
        label: 'Dismiss',
        action: () => {
          // Clear error state
          console.log('Dismissing error...');
        },
        isPrimary: false
      });
    }
    
    return actions;
  }, [syncStatus.error]);
  
  return {
    recoveryActions: getRecoveryActions,
    hasRecoveryActions: getRecoveryActions.length > 0
  };
};

/**
 * Hook for sync statistics and monitoring
 */
export const useSyncMonitoring = () => {
  const syncStatus = useSyncStatus();
  
  const monitoring = useMemo(() => {
    const errorStats = logger.getErrorStats(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const errorSummary = logger.getErrorSummary(new Date(Date.now() - 24 * 60 * 60 * 1000));
    
    return {
      // Overall health
      health: {
        score: syncStatus.stats.successRate,
        status: syncStatus.stats.successRate > 80 ? 'healthy' : 
               syncStatus.stats.successRate > 60 ? 'warning' : 'critical',
        lastSync: syncStatus.lastSyncTime,
        uptime: syncStatus.network.isOnline ? 'online' : 'offline'
      },
      
      // Error statistics
      errors: {
        total: errorStats.totalErrors,
        critical: errorStats.errorsBySeverity.critical || 0,
        retryable: errorStats.retryableErrors,
        recent: errorSummary.recentErrors.length,
        byType: errorStats.errorsByType
      },
      
      // Performance metrics
      performance: {
        averageDuration: syncStatus.stats.averageSyncDuration || 0,
        lastDuration: syncStatus.stats.lastSyncDuration || 0,
        successRate: syncStatus.stats.successRate,
        totalSyncs: syncStatus.stats.totalSyncs
      },
      
      // Current operation
      currentOperation: {
        isActive: syncStatus.isActive,
        phase: syncStatus.phase,
        progress: syncStatus.progress.percentage,
        currentItem: syncStatus.progress.currentItem,
        estimatedTimeRemaining: syncStatus.progress.estimatedTimeRemaining
      }
    };
  }, [syncStatus]);
  
  return monitoring;
};