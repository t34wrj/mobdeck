import { createAsyncThunk } from '@reduxjs/toolkit';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { syncService } from '../../services/SyncService';
import { RootState } from '../index';
import {
  syncProgress,
  syncSuccess,
  syncError,
  updateNetworkStatus,
} from '../slices/syncSlice';
import { fetchArticles } from '../slices/articlesSlice';
import { SyncPhase, NetworkType } from '../../types/sync';

interface StartSyncParams {
  syncOptions?: {
    fullTextSync?: boolean;
    downloadImages?: boolean;
  };
  forceFull?: boolean;
}

/**
 * Get network type from NetInfo state
 */
const getNetworkType = (netInfoState: NetInfoState): NetworkType | null => {
  if (!netInfoState.isConnected) return null;
  
  switch (netInfoState.type) {
    case 'wifi':
      return NetworkType.WIFI;
    case 'cellular':
      return NetworkType.CELLULAR;
    default:
      return NetworkType.UNKNOWN;
  }
};

/**
 * Initialize sync service
 */
export const initializeSyncService = createAsyncThunk(
  'sync/initialize',
  async (_, { dispatch }) => {
    try {
      console.log('[SyncThunks] Initializing sync service...');
      await syncService.initialize();
      
      // Get initial network status
      const netInfoState = await NetInfo.fetch();
      console.log('[SyncThunks] Initial network state:', netInfoState);
      
      dispatch(updateNetworkStatus({
        isOnline: netInfoState.isConnected || false,
        networkType: getNetworkType(netInfoState),
      }));
      
      // Set up network monitoring
      const unsubscribe = NetInfo.addEventListener(state => {
        console.log('[SyncThunks] Network state changed:', state);
        dispatch(updateNetworkStatus({
          isOnline: state.isConnected || false,
          networkType: getNetworkType(state),
        }));
      });
      
      // Store unsubscribe function for cleanup
      (window as any).__netInfoUnsubscribe = unsubscribe;
      
      console.log('[SyncThunks] Sync service initialized successfully');
      return true;
    } catch (error) {
      console.error('[SyncThunks] Failed to initialize sync service:', error);
      throw error;
    }
  }
);

/**
 * Start sync operation
 */
export const startSyncOperation = createAsyncThunk<
  void,
  StartSyncParams,
  { state: RootState }
>(
  'sync/startOperation',
  async (params, { dispatch, getState }) => {
    try {
      console.log('[SyncThunks] Starting sync operation...');
      
      // Check if sync service is initialized
      const state = getState();
      if (!state.sync.isOnline) {
        throw new Error('Cannot sync while offline');
      }
      
      // Initialize sync service if not already initialized
      try {
        await syncService.initialize();
      } catch (initError) {
        console.log('[SyncThunks] Sync service already initialized or initialization failed:', initError);
      }
      
      // Update sync configuration if options provided
      if (params.syncOptions) {
        syncService.updateConfig(params.syncOptions);
      }
      
      // Start the actual sync
      const result = await syncService.startFullSync(params.forceFull);
      
      if (!result.success) {
        throw new Error(result.errors[0]?.error || 'Sync failed');
      }
      
      console.log('[SyncThunks] Sync completed successfully:', result);
      
      // Refresh articles list after successful sync
      dispatch(fetchArticles({ page: 1, forceRefresh: true }));
      
    } catch (error) {
      console.error('[SyncThunks] Sync operation failed:', error);
      throw error;
    }
  }
);

/**
 * Pause sync operation
 */
export const pauseSyncOperation = createAsyncThunk(
  'sync/pauseOperation',
  async () => {
    try {
      console.log('[SyncThunks] Pausing sync...');
      await syncService.stopSync();
      return true;
    } catch (error) {
      console.error('[SyncThunks] Failed to pause sync:', error);
      throw error;
    }
  }
);

/**
 * Resume sync operation
 */
export const resumeSyncOperation = createAsyncThunk<
  void,
  void,
  { state: RootState }
>(
  'sync/resumeOperation',
  async (_, { dispatch, getState }) => {
    try {
      console.log('[SyncThunks] Resuming sync...');
      
      const state = getState();
      if (!state.sync.isOnline) {
        throw new Error('Cannot resume sync while offline');
      }
      
      // Restart sync from where it left off
      const result = await syncService.startFullSync(false);
      
      if (!result.success) {
        throw new Error(result.errors[0]?.error || 'Resume sync failed');
      }
      
      // Refresh articles list after successful sync
      dispatch(fetchArticles({ page: 1, forceRefresh: true }));
      
    } catch (error) {
      console.error('[SyncThunks] Failed to resume sync:', error);
      throw error;
    }
  }
);

/**
 * Cancel sync operation
 */
export const cancelSyncOperation = createAsyncThunk(
  'sync/cancelOperation',
  async () => {
    try {
      console.log('[SyncThunks] Cancelling sync...');
      await syncService.stopSync();
      return true;
    } catch (error) {
      console.error('[SyncThunks] Failed to cancel sync:', error);
      throw error;
    }
  }
);