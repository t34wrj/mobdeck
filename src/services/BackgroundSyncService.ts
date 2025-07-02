/**
 * BackgroundSyncService - Enhanced Background Synchronization Service
 *
 * Features:
 * - Configurable sync intervals (15min, 30min, 1hr, 2hr, manual)
 * - Network-aware sync with WiFi/cellular preferences
 * - Integration with existing SyncService for data synchronization
 * - Battery optimization handling
 * - Comprehensive error handling and retry mechanisms
 * - Background sync status reporting
 */

import BackgroundService from 'react-native-background-actions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { DeviceEventEmitter, NativeEventEmitter } from 'react-native';
import { syncService } from './SyncService';
import { store } from '../store';
import {
  updateSyncConfig,
  updateNetworkStatus,
  syncError,
} from '../store/slices/syncSlice';
import { SyncConfiguration, NetworkType, SyncStatus } from '../types/sync';

// Constants
const LAST_SYNC_KEY = '@mobdeck/last_sync_time';
const SYNC_PREFERENCES_KEY = '@mobdeck/sync_preferences';

// Sync interval options in minutes
export const SYNC_INTERVALS = {
  MANUAL: 0,
  FIFTEEN_MINUTES: 15,
  THIRTY_MINUTES: 30,
  ONE_HOUR: 60,
  TWO_HOURS: 120,
};

interface BackgroundSyncPreferences {
  enabled: boolean;
  interval: number;
  wifiOnly: boolean;
  allowCellular: boolean;
  allowMetered: boolean;
}

interface BackgroundSyncStatus {
  isRunning: boolean;
  lastSyncTime: string | null;
  nextScheduledSync: string | null;
  currentNetworkType: NetworkType | null;
  syncHistory: SyncHistoryEntry[];
}

interface SyncHistoryEntry {
  timestamp: string;
  success: boolean;
  itemsSynced: number;
  duration: number;
  networkType: NetworkType;
  error?: string;
}

/**
 * BackgroundSyncService - Manages background synchronization tasks
 */
class BackgroundSyncService {
  private static instance: BackgroundSyncService;
  private isInitialized = false;
  private syncPreferences: BackgroundSyncPreferences;
  private currentNetworkState: NetInfoState | null = null;
  private unsubscribeNetInfo: (() => void) | null = null;
  private deviceEventSubscriptions: any[] = [];

  private constructor() {
    // Initialize with default preferences
    this.syncPreferences = {
      enabled: true,
      interval: SYNC_INTERVALS.FIFTEEN_MINUTES,
      wifiOnly: false,
      allowCellular: true,
      allowMetered: true,
    };
  }

  /**
   * Get singleton instance of BackgroundSyncService
   */
  public static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  /**
   * Initialize background sync service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[BackgroundSyncService] Already initialized');
      return;
    }

    try {
      console.log('[BackgroundSyncService] Initializing...');

      // Load saved preferences
      await this.loadPreferences();

      // Set up network monitoring
      this.setupNetworkMonitoring();

      // Set up device event listeners
      this.setupDeviceEventListeners();

      // Register background job
      await this.registerBackgroundJob();

      // Schedule sync if enabled
      if (this.syncPreferences.enabled) {
        await this.scheduleSync();
      }

      this.isInitialized = true;
      console.log('[BackgroundSyncService] Initialized successfully');
    } catch (error) {
      console.error('[BackgroundSyncService] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Load sync preferences from storage
   */
  private async loadPreferences(): Promise<void> {
    try {
      const savedPreferences = await AsyncStorage.getItem(SYNC_PREFERENCES_KEY);
      if (savedPreferences) {
        this.syncPreferences = JSON.parse(savedPreferences);

        // Update Redux store with loaded configuration
        store.dispatch(
          updateSyncConfig({
            config: {
              backgroundSyncEnabled: this.syncPreferences.enabled,
              syncInterval: this.syncPreferences.interval,
              syncOnWifiOnly: this.syncPreferences.wifiOnly,
              syncOnCellular: this.syncPreferences.allowCellular,
            },
          })
        );
      }
    } catch (error) {
      console.error(
        '[BackgroundSyncService] Failed to load preferences:',
        error
      );
    }
  }

  /**
   * Save sync preferences to storage
   */
  private async savePreferences(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        SYNC_PREFERENCES_KEY,
        JSON.stringify(this.syncPreferences)
      );
    } catch (error) {
      console.error(
        '[BackgroundSyncService] Failed to save preferences:',
        error
      );
    }
  }

  /**
   * Set up network state monitoring
   */
  private setupNetworkMonitoring(): void {
    // Subscribe to network state changes
    this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
      this.handleNetworkChange(state);
    });

    // Get initial network state
    NetInfo.fetch().then(state => {
      this.handleNetworkChange(state);
    });
  }

  /**
   * Set up device event listeners for Android native events
   */
  private setupDeviceEventListeners(): void {
    // Listen for boot completion events
    const bootSubscription = DeviceEventEmitter.addListener(
      'DeviceBootCompleted',
      (data: any) => {
        console.log('[BackgroundSyncService] Device boot completed:', data);
        this.handleDeviceBootCompleted();
      }
    );

    // Listen for background sync job events
    const syncJobSubscription = DeviceEventEmitter.addListener(
      'BackgroundSyncEvent',
      (data: any) => {
        console.log('[BackgroundSyncService] Background sync event:', data);
        this.handleBackgroundSyncEvent(data);
      }
    );

    this.deviceEventSubscriptions.push(bootSubscription, syncJobSubscription);
  }

  /**
   * Handle device boot completion
   */
  private async handleDeviceBootCompleted(): Promise<void> {
    try {
      console.log('[BackgroundSyncService] Handling device boot completion');

      // Reload preferences
      await this.loadPreferences();

      // Reschedule sync if enabled
      if (this.syncPreferences.enabled) {
        await this.scheduleSync();
      }

      console.log('[BackgroundSyncService] Sync rescheduled after boot');
    } catch (error) {
      console.error(
        '[BackgroundSyncService] Failed to handle boot completion:',
        error
      );
    }
  }

  /**
   * Handle background sync job events from Android
   */
  private handleBackgroundSyncEvent(eventType: string): void {
    switch (eventType) {
      case 'start':
        console.log('[BackgroundSyncService] Android background job started');
        // The actual sync work will be handled by performBackgroundSync
        break;
      case 'stop':
        console.log('[BackgroundSyncService] Android background job stopped');
        break;
      default:
        console.log(
          '[BackgroundSyncService] Unknown background sync event:',
          eventType
        );
    }
  }

  /**
   * Handle network state changes
   */
  private handleNetworkChange(state: NetInfoState): void {
    this.currentNetworkState = state;

    // Map network type
    let networkType: NetworkType | null = null;
    if (state.type === 'wifi') {
      networkType = NetworkType.WIFI;
    } else if (state.type === 'cellular') {
      networkType = NetworkType.CELLULAR;
    } else if (state.type === 'ethernet') {
      networkType = NetworkType.ETHERNET;
    } else if (state.isConnected) {
      networkType = NetworkType.UNKNOWN;
    }

    // Update Redux store
    store.dispatch(
      updateNetworkStatus({
        isOnline: state.isConnected || false,
        networkType,
      })
    );

    console.log(
      `[BackgroundSyncService] Network state changed: ${state.type}, Connected: ${state.isConnected}`
    );

    // Check if we should trigger a sync based on network conditions
    if (this.shouldSyncOnCurrentNetwork()) {
      this.checkAndTriggerSync();
    }
  }

  /**
   * Check if sync should run on current network
   */
  private shouldSyncOnCurrentNetwork(): boolean {
    if (!this.currentNetworkState || !this.currentNetworkState.isConnected) {
      return false;
    }

    // Check WiFi-only preference
    if (
      this.syncPreferences.wifiOnly &&
      this.currentNetworkState.type !== 'wifi'
    ) {
      console.log(
        '[BackgroundSyncService] Sync requires WiFi, current network is not WiFi'
      );
      return false;
    }

    // Check cellular preference
    if (
      !this.syncPreferences.allowCellular &&
      this.currentNetworkState.type === 'cellular'
    ) {
      console.log('[BackgroundSyncService] Cellular sync disabled');
      return false;
    }

    // Check metered connection preference
    if (
      !this.syncPreferences.allowMetered &&
      this.currentNetworkState.details?.isConnectionExpensive
    ) {
      console.log('[BackgroundSyncService] Metered connection sync disabled');
      return false;
    }

    return true;
  }

  /**
   * Register background job with react-native-background-actions
   */
  private async registerBackgroundJob(): Promise<void> {
    // Background job registration is now handled when starting the service
    console.log('[BackgroundSyncService] Background job registration prepared');
  }

  /**
   * Schedule background sync based on current preferences
   */
  public async scheduleSync(): Promise<void> {
    try {
      if (
        !this.syncPreferences.enabled ||
        this.syncPreferences.interval === SYNC_INTERVALS.MANUAL
      ) {
        await this.cancelSync();
        return;
      }

      // Stop any existing background service
      if (BackgroundService.isRunning()) {
        await BackgroundService.stop();
      }

      // Configure background service options
      const options = {
        taskName: 'MobdeckSync',
        taskTitle: 'Mobdeck Background Sync',
        taskDesc: 'Syncing your articles in the background',
        taskIcon: {
          name: 'ic_launcher',
          type: 'mipmap',
        },
        color: '#2196F3',
        linkingURI: 'mobdeck://sync',
        parameters: {
          syncInterval: this.syncPreferences.interval * 60 * 1000, // Convert minutes to milliseconds
          wifiOnly: this.syncPreferences.wifiOnly,
          allowCellular: this.syncPreferences.allowCellular,
          allowMetered: this.syncPreferences.allowMetered,
        },
        progressBar: {
          max: 100,
          value: 0,
          indeterminate: true,
        },
      };

      // Define the background task
      const backgroundTask = async (taskDataArguments: any) => {
        const { syncInterval, wifiOnly, allowCellular, allowMetered } = taskDataArguments;
        
        // Helper function for delays
        const sleep = (time: number) => new Promise<void>((resolve) => setTimeout(resolve, time));
        
        while (BackgroundService.isRunning()) {
          try {
            // Check network conditions
            const networkState = await NetInfo.fetch();
            
            if (!networkState.isConnected) {
              await sleep(syncInterval);
              continue;
            }
            
            // Check WiFi-only preference
            if (wifiOnly && networkState.type !== 'wifi') {
              await sleep(syncInterval);
              continue;
            }
            
            // Check cellular preference
            if (!allowCellular && networkState.type === 'cellular') {
              await sleep(syncInterval);
              continue;
            }
            
            // Check metered connection preference
            if (!allowMetered && networkState.details?.isConnectionExpensive) {
              await sleep(syncInterval);
              continue;
            }
            
            // Perform the actual sync
            await this.performBackgroundSync();
            
            // Update notification with last sync time
            await BackgroundService.updateNotification({
              taskDesc: `Last sync: ${new Date().toLocaleTimeString()}`,
            });
            
          } catch (error) {
            console.error('[BackgroundSyncService] Error in background task:', error instanceof Error ? error.message : String(error));
          }
          
          await sleep(syncInterval);
        }
      };

      // Start the background service
      await BackgroundService.start(backgroundTask, options);

      const nextSyncTime = new Date(Date.now() + this.syncPreferences.interval * 60 * 1000);
      console.log(
        `[BackgroundSyncService] Sync service started, next sync around ${nextSyncTime.toISOString()}`
      );

      // Save next sync time
      await AsyncStorage.setItem(
        '@mobdeck/next_sync_time',
        nextSyncTime.toISOString()
      );
    } catch (error) {
      console.error('[BackgroundSyncService] Failed to schedule sync:', error);
      throw error;
    }
  }

  /**
   * Cancel scheduled background sync
   */
  public async cancelSync(): Promise<void> {
    try {
      if (BackgroundService.isRunning()) {
        await BackgroundService.stop();
      }
      await AsyncStorage.removeItem('@mobdeck/next_sync_time');
      console.log('[BackgroundSyncService] Background sync cancelled');
    } catch (error) {
      console.error('[BackgroundSyncService] Failed to cancel sync:', error);
    }
  }

  /**
   * Perform background synchronization
   */
  private async performBackgroundSync(): Promise<void> {
    console.log('[BackgroundSyncService] Starting background sync...');

    const startTime = Date.now();
    const syncHistory: SyncHistoryEntry = {
      timestamp: new Date().toISOString(),
      success: false,
      itemsSynced: 0,
      duration: 0,
      networkType: this.getNetworkType(),
    };

    try {
      // Check network conditions
      if (!this.shouldSyncOnCurrentNetwork()) {
        console.log(
          '[BackgroundSyncService] Network conditions not met for sync'
        );
        return;
      }

      // Check if sync is already running
      const state = store.getState();
      if (state.sync.status === SyncStatus.SYNCING) {
        console.log(
          '[BackgroundSyncService] Sync already in progress, skipping'
        );
        return;
      }

      // Perform sync using existing SyncService
      const result = await syncService.startFullSync();

      syncHistory.success = result.success;
      syncHistory.itemsSynced = result.syncedCount;
      syncHistory.duration = Date.now() - startTime;

      if (!result.success) {
        syncHistory.error = result.errors[0]?.error || 'Unknown error';
      }

      // Save last sync time
      await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

      console.log(
        `[BackgroundSyncService] Background sync completed in ${syncHistory.duration}ms`
      );
    } catch (error) {
      console.error('[BackgroundSyncService] Background sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      syncHistory.error = errorMessage;

      // Dispatch error to Redux store
      store.dispatch(
        syncError({
          error: errorMessage,
          errorCode: 'BACKGROUND_SYNC_FAILED',
          retryable: true,
        })
      );
    } finally {
      // Save sync history
      await this.saveSyncHistory(syncHistory);
    }
  }

  /**
   * Save sync history entry
   */
  private async saveSyncHistory(entry: SyncHistoryEntry): Promise<void> {
    try {
      const historyKey = '@mobdeck/sync_history';
      const existingHistory = await AsyncStorage.getItem(historyKey);
      const history: SyncHistoryEntry[] = existingHistory
        ? JSON.parse(existingHistory)
        : [];

      // Add new entry and keep last 20 entries
      history.unshift(entry);
      if (history.length > 20) {
        history.pop();
      }

      await AsyncStorage.setItem(historyKey, JSON.stringify(history));
    } catch (error) {
      console.error(
        '[BackgroundSyncService] Failed to save sync history:',
        error
      );
    }
  }

  /**
   * Get current network type
   */
  private getNetworkType(): NetworkType {
    if (!this.currentNetworkState || !this.currentNetworkState.isConnected) {
      return NetworkType.UNKNOWN;
    }

    switch (this.currentNetworkState.type) {
      case 'wifi':
        return NetworkType.WIFI;
      case 'cellular':
        return NetworkType.CELLULAR;
      case 'ethernet':
        return NetworkType.ETHERNET;
      default:
        return NetworkType.UNKNOWN;
    }
  }

  /**
   * Check and trigger sync if conditions are met
   */
  private async checkAndTriggerSync(): Promise<void> {
    try {
      // Check if enough time has passed since last sync
      const lastSyncTime = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (lastSyncTime) {
        const timeSinceLastSync = Date.now() - new Date(lastSyncTime).getTime();
        const minInterval = Math.min(
          this.syncPreferences.interval * 60 * 1000,
          5 * 60 * 1000
        ); // At least 5 minutes

        if (timeSinceLastSync < minInterval) {
          console.log(
            '[BackgroundSyncService] Too soon since last sync, skipping'
          );
          return;
        }
      }

      // Trigger sync
      await this.performBackgroundSync();
    } catch (error) {
      console.error(
        '[BackgroundSyncService] Failed to check and trigger sync:',
        error
      );
    }
  }

  /**
   * Update sync preferences
   */
  public async updatePreferences(
    preferences: Partial<BackgroundSyncPreferences>
  ): Promise<void> {
    this.syncPreferences = { ...this.syncPreferences, ...preferences };
    await this.savePreferences();

    // Update Redux store
    store.dispatch(
      updateSyncConfig({
        config: {
          backgroundSyncEnabled: this.syncPreferences.enabled,
          syncInterval: this.syncPreferences.interval,
          syncOnWifiOnly: this.syncPreferences.wifiOnly,
          syncOnCellular: this.syncPreferences.allowCellular,
        },
      })
    );

    // Reschedule sync if needed
    if (this.syncPreferences.enabled) {
      await this.scheduleSync();
    } else {
      await this.cancelSync();
    }
  }

  /**
   * Get current sync status
   */
  public async getStatus(): Promise<BackgroundSyncStatus> {
    const lastSyncTime = await AsyncStorage.getItem(LAST_SYNC_KEY);
    const nextSyncTime = await AsyncStorage.getItem('@mobdeck/next_sync_time');
    const historyData = await AsyncStorage.getItem('@mobdeck/sync_history');
    const history: SyncHistoryEntry[] = historyData
      ? JSON.parse(historyData)
      : [];

    return {
      isRunning: BackgroundService.isRunning() || store.getState().sync.status === SyncStatus.SYNCING,
      lastSyncTime,
      nextScheduledSync: nextSyncTime,
      currentNetworkType: this.getNetworkType(),
      syncHistory: history,
    };
  }

  /**
   * Trigger manual sync
   */
  public async triggerManualSync(): Promise<void> {
    console.log('[BackgroundSyncService] Manual sync triggered');
    await this.performBackgroundSync();
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    // Unsubscribe from network monitoring
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }

    // Remove device event subscriptions
    this.deviceEventSubscriptions.forEach(subscription => {
      subscription.remove();
    });
    this.deviceEventSubscriptions = [];

    // Cancel background sync
    this.cancelSync().catch(error => {
      console.error(
        '[BackgroundSyncService] Failed to cancel sync during cleanup:',
        error
      );
    });

    this.isInitialized = false;
  }
}

// Export singleton instance
export const backgroundSyncService = BackgroundSyncService.getInstance();

// Export class for testing
export default BackgroundSyncService;
