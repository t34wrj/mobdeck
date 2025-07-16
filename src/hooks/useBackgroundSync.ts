/**
 * useBackgroundSync - React Hook for Simplified Sync Management
 *
 * Provides an interface to manage sync preferences and status
 * from React components, integrating with the simplified SyncService.
 * No longer supports background task scheduling - uses app lifecycle sync instead.
 */

import { useEffect, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppSelector, useAppDispatch, store } from '../store';
import { syncService } from '../services/SyncService';
import { updateSyncConfig } from '../store/slices/syncSlice';

interface BackgroundSyncHookReturn {
  // State
  isEnabled: boolean;
  syncInterval: number;
  isWifiOnly: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  nextSyncTime: string | null;

  // Actions
  setEnabled: (enabled: boolean) => Promise<void>;
  setSyncInterval: (interval: number) => Promise<void>;
  setWifiOnly: (wifiOnly: boolean) => Promise<void>;
  triggerManualSync: () => Promise<void>;
  getSyncHistory: () => Promise<any[]>;
}

// Sync interval constants for use in UI
export const SYNC_INTERVALS = {
  DISABLED: 0,
  MANUAL: -1,
  FIVE_MINUTES: 5,
  FIFTEEN_MINUTES: 15,
  THIRTY_MINUTES: 30,
  ONE_HOUR: 60,
  TWO_HOURS: 120,
  SIX_HOURS: 360,
  TWELVE_HOURS: 720,
  DAILY: 1440,
};

/**
 * Hook to manage simplified sync functionality
 * Note: No longer supports true background sync - uses app lifecycle sync
 */
export function useBackgroundSync(): BackgroundSyncHookReturn {
  const dispatch = useAppDispatch();

  // Get sync state from Redux
  const syncConfig = useAppSelector(state => state.sync.config);
  const lastSyncRedux = useAppSelector(state => state.sync.lastSyncTime);

  // Local state for sync timing
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [nextSyncTime, setNextSyncTime] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState
  );

  // Initialize sync service on mount
  useEffect(() => {
    const initializeSync = async () => {
      try {
        await syncService.initialize();
        await updateSyncStatus();
      } catch (error) {
        console.error('[useBackgroundSync] Failed to initialize:', error);
      }
    };

    initializeSync();

    // Listen for app state changes
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange, updateSyncStatus]);

  // Update sync status periodically when app is active
  useEffect(() => {
    if (appState === 'active') {
      updateSyncStatus();

      const interval = setInterval(updateSyncStatus, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
    return undefined;
  }, [appState, updateSyncStatus]);

  /**
   * Handle app state changes - trigger sync when coming back to foreground
   */
  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      console.log(
        `[useBackgroundSync] App state changed from ${appState} to ${nextAppState}`
      );

      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground, trigger sync if enabled
        updateSyncStatus();
        
        // Trigger sync if enabled and enough time has passed
        const state = store.getState();
        if (state.sync.config.backgroundSyncEnabled && state.auth.isAuthenticated) {
          const lastSync = state.sync.lastSyncTime;
          const syncInterval = state.sync.config.syncInterval * 60 * 1000; // Convert to milliseconds
          
          if (!lastSync || Date.now() - new Date(lastSync).getTime() > syncInterval) {
            console.log('[useBackgroundSync] Triggering foreground sync');
            triggerManualSync().catch(error => {
              console.error('[useBackgroundSync] Foreground sync failed:', error);
            });
          }
        }
      }

      setAppState(nextAppState);
    },
    [appState, triggerManualSync, updateSyncStatus]
  );

  /**
   * Update sync status from sync service
   */
  const updateSyncStatus = useCallback(async () => {
    try {
      // Only update sync status if user is authenticated
      const state = store.getState();
      if (!state.auth.isAuthenticated) {
        return;
      }

      await syncService.getSyncStats();
      setLastSyncTime(state.sync.lastSyncTime);
      
      // Calculate next sync time based on interval (for display purposes)
      if (state.sync.lastSyncTime && syncConfig.backgroundSyncEnabled) {
        const lastSync = new Date(state.sync.lastSyncTime);
        const interval = syncConfig.syncInterval * 60 * 1000; // Convert to milliseconds
        const nextSync = new Date(lastSync.getTime() + interval);
        setNextSyncTime(nextSync.toISOString());
      } else {
        setNextSyncTime(null);
      }
    } catch (error) {
      console.error('[useBackgroundSync] Failed to get status:', error);
    }
  }, [syncConfig.backgroundSyncEnabled, syncConfig.syncInterval]);

  /**
   * Enable/disable sync (note: no longer true background sync)
   */
  const setEnabled = useCallback(
    async (enabled: boolean) => {
      try {
        syncService.updateConfiguration({ backgroundSyncEnabled: enabled });
        dispatch(
          updateSyncConfig({ config: { backgroundSyncEnabled: enabled } })
        );
        await updateSyncStatus();
        
        console.log(`[useBackgroundSync] Sync ${enabled ? 'enabled' : 'disabled'} (app lifecycle only)`);
      } catch (error) {
        console.error(
          '[useBackgroundSync] Failed to set enabled state:',
          error
        );
        throw error;
      }
    },
    [dispatch, updateSyncStatus]
  );

  /**
   * Set sync interval (for app lifecycle sync)
   */
  const setSyncInterval = useCallback(
    async (interval: number) => {
      try {
        syncService.updateConfiguration({ syncInterval: interval });
        dispatch(updateSyncConfig({ config: { syncInterval: interval } }));
        await updateSyncStatus();
        
        console.log(`[useBackgroundSync] Sync interval set to ${interval} minutes`);
      } catch (error) {
        console.error(
          '[useBackgroundSync] Failed to set sync interval:',
          error
        );
        throw error;
      }
    },
    [dispatch, updateSyncStatus]
  );

  /**
   * Set WiFi-only preference
   */
  const setWifiOnly = useCallback(
    async (wifiOnly: boolean) => {
      try {
        syncService.updateConfiguration({
          syncOnWifiOnly: wifiOnly,
          syncOnCellular: !wifiOnly,
        });
        dispatch(
          updateSyncConfig({
            config: {
              syncOnWifiOnly: wifiOnly,
              syncOnCellular: !wifiOnly,
            },
          })
        );
        await updateSyncStatus();
        
        console.log(`[useBackgroundSync] WiFi-only set to ${wifiOnly}`);
      } catch (error) {
        console.error(
          '[useBackgroundSync] Failed to set WiFi-only preference:',
          error
        );
        throw error;
      }
    },
    [dispatch, updateSyncStatus]
  );

  /**
   * Trigger manual sync
   */
  const triggerManualSync = useCallback(async () => {
    try {
      console.log('[useBackgroundSync] Triggering manual sync');
      await syncService.triggerManualSync();
      await updateSyncStatus();
    } catch (error) {
      console.error(
        '[useBackgroundSync] Failed to trigger manual sync:',
        error
      );
      throw error;
    }
  }, [updateSyncStatus]);

  /**
   * Get sync history (simplified - just return basic stats)
   */
  const getSyncHistory = useCallback(async () => {
    try {
      const stats = await syncService.getSyncStats();
      return [
        {
          timestamp: lastSyncTime || new Date().toISOString(),
          status: 'completed',
          itemsSynced: stats?.itemsSynced || 0,
          conflicts: stats?.conflicts || 0,
        },
      ];
    } catch (error) {
      console.error('[useBackgroundSync] Failed to get sync history:', error);
      return [];
    }
  }, [lastSyncTime]);

  return {
    // State
    isEnabled: syncConfig.backgroundSyncEnabled,
    syncInterval: syncConfig.syncInterval,
    isWifiOnly: syncConfig.syncOnWifiOnly,
    isSyncing: syncService.isSyncRunning(),
    lastSyncTime: lastSyncTime || lastSyncRedux,
    nextSyncTime,

    // Actions
    setEnabled,
    setSyncInterval,
    setWifiOnly,
    triggerManualSync,
    getSyncHistory,
  };
}