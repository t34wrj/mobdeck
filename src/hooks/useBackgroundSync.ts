/**
 * useBackgroundSync - React Hook for Background Sync Management
 * 
 * Provides an interface to manage background sync preferences and status
 * from React components, integrating with BackgroundSyncService and Redux store.
 */

import { useEffect, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppSelector, useAppDispatch } from '../store';
import { backgroundSyncService, SYNC_INTERVALS } from '../services/BackgroundSyncService';
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

/**
 * Hook to manage background sync functionality
 */
export function useBackgroundSync(): BackgroundSyncHookReturn {
  const dispatch = useAppDispatch();
  
  // Get sync state from Redux
  const syncConfig = useAppSelector((state) => state.sync.config);
  const syncStatus = useAppSelector((state) => state.sync.status);
  const lastSyncRedux = useAppSelector((state) => state.sync.lastSyncTime);
  
  // Local state for sync timing
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [nextSyncTime, setNextSyncTime] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // Initialize background sync service on mount
  useEffect(() => {
    const initializeBackgroundSync = async () => {
      try {
        await backgroundSyncService.initialize();
        await updateSyncStatus();
      } catch (error) {
        console.error('[useBackgroundSync] Failed to initialize:', error);
      }
    };

    initializeBackgroundSync();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  // Update sync status periodically when app is active
  useEffect(() => {
    if (appState === 'active') {
      updateSyncStatus();
      
      const interval = setInterval(updateSyncStatus, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [appState]);

  /**
   * Handle app state changes
   */
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log(`[useBackgroundSync] App state changed from ${appState} to ${nextAppState}`);
    
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to foreground, update sync status
      updateSyncStatus();
    }
    
    setAppState(nextAppState);
  };

  /**
   * Update sync status from background service
   */
  const updateSyncStatus = async () => {
    try {
      const status = await backgroundSyncService.getStatus();
      setLastSyncTime(status.lastSyncTime);
      setNextSyncTime(status.nextScheduledSync);
    } catch (error) {
      console.error('[useBackgroundSync] Failed to get status:', error);
    }
  };

  /**
   * Enable/disable background sync
   */
  const setEnabled = useCallback(async (enabled: boolean) => {
    try {
      await backgroundSyncService.updatePreferences({ enabled });
      dispatch(updateSyncConfig({ config: { backgroundSyncEnabled: enabled } }));
      await updateSyncStatus();
    } catch (error) {
      console.error('[useBackgroundSync] Failed to set enabled state:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Set sync interval
   */
  const setSyncInterval = useCallback(async (interval: number) => {
    try {
      await backgroundSyncService.updatePreferences({ interval });
      dispatch(updateSyncConfig({ config: { syncInterval: interval } }));
      await updateSyncStatus();
    } catch (error) {
      console.error('[useBackgroundSync] Failed to set sync interval:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Set WiFi-only preference
   */
  const setWifiOnly = useCallback(async (wifiOnly: boolean) => {
    try {
      await backgroundSyncService.updatePreferences({ 
        wifiOnly,
        allowCellular: !wifiOnly 
      });
      dispatch(updateSyncConfig({ 
        config: { 
          syncOnWifiOnly: wifiOnly,
          syncOnCellular: !wifiOnly
        } 
      }));
      await updateSyncStatus();
    } catch (error) {
      console.error('[useBackgroundSync] Failed to set WiFi-only preference:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Trigger manual sync
   */
  const triggerManualSync = useCallback(async () => {
    try {
      await backgroundSyncService.triggerManualSync();
      await updateSyncStatus();
    } catch (error) {
      console.error('[useBackgroundSync] Failed to trigger manual sync:', error);
      throw error;
    }
  }, []);

  /**
   * Get sync history
   */
  const getSyncHistory = useCallback(async () => {
    try {
      const status = await backgroundSyncService.getStatus();
      return status.syncHistory;
    } catch (error) {
      console.error('[useBackgroundSync] Failed to get sync history:', error);
      return [];
    }
  }, []);

  return {
    // State
    isEnabled: syncConfig.backgroundSyncEnabled,
    syncInterval: syncConfig.syncInterval,
    isWifiOnly: syncConfig.syncOnWifiOnly,
    isSyncing: syncStatus === 'syncing',
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

// Export sync interval constants for use in UI
export { SYNC_INTERVALS } from '../services/BackgroundSyncService';