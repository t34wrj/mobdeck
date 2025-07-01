/**
 * BackgroundSyncUsage - Example implementation of background sync integration
 * 
 * This file demonstrates how to integrate the BackgroundSyncService
 * into your React Native app lifecycle and components.
 */

import { AppState, AppStateStatus } from 'react-native';
import { backgroundSyncService, SYNC_INTERVALS } from '../services/BackgroundSyncService';

/**
 * Example: App.tsx integration
 * Add this to your main App component to initialize background sync
 */
export class BackgroundSyncAppIntegration {
  private appStateSubscription: any = null;

  /**
   * Initialize background sync when app starts
   * Call this in your App component's useEffect or componentDidMount
   */
  async initializeBackgroundSync() {
    try {
      console.log('Initializing background sync...');
      
      // Initialize the background sync service
      await backgroundSyncService.initialize();
      
      // Set up app state monitoring
      this.setupAppStateMonitoring();
      
      console.log('Background sync initialized successfully');
    } catch (error) {
      console.error('Failed to initialize background sync:', error);
    }
  }

  /**
   * Set up app state monitoring to handle app lifecycle events
   */
  private setupAppStateMonitoring() {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange(nextAppState: AppStateStatus) {
    console.log(`App state changed to: ${nextAppState}`);
    
    if (nextAppState === 'background') {
      // App is going to background - no specific action needed
      // Background sync will continue based on configured intervals
      console.log('App backgrounded - background sync will continue');
    } else if (nextAppState === 'active') {
      // App is coming to foreground - trigger an immediate sync if needed
      this.handleAppForegrounded();
    }
  }

  /**
   * Handle app coming to foreground
   */
  private async handleAppForegrounded() {
    try {
      // Get sync status
      const status = await backgroundSyncService.getStatus();
      
      // Check if it's been a while since last sync
      if (status.lastSyncTime) {
        const lastSyncTime = new Date(status.lastSyncTime).getTime();
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncTime;
        
        // If more than 10 minutes since last sync, trigger manual sync
        if (timeSinceLastSync > 10 * 60 * 1000) {
          console.log('Triggering foreground sync - been a while since last sync');
          await backgroundSyncService.triggerManualSync();
        }
      } else {
        // No previous sync, trigger one
        console.log('Triggering initial foreground sync');
        await backgroundSyncService.triggerManualSync();
      }
    } catch (error) {
      console.error('Failed to handle app foregrounded:', error);
    }
  }

  /**
   * Clean up when app is unmounted
   * Call this in your App component's cleanup
   */
  cleanup() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    
    backgroundSyncService.cleanup();
  }
}

/**
 * Example: Settings configuration helper
 */
export class BackgroundSyncConfigHelper {
  
  /**
   * Configure background sync with common presets
   */
  static async configurePreset(preset: 'aggressive' | 'balanced' | 'conservative' | 'manual') {
    const configurations = {
      aggressive: {
        enabled: true,
        interval: SYNC_INTERVALS.FIFTEEN_MINUTES,
        wifiOnly: false,
        allowCellular: true,
        allowMetered: true,
      },
      balanced: {
        enabled: true,
        interval: SYNC_INTERVALS.THIRTY_MINUTES,
        wifiOnly: false,
        allowCellular: true,
        allowMetered: false,
      },
      conservative: {
        enabled: true,
        interval: SYNC_INTERVALS.ONE_HOUR,
        wifiOnly: true,
        allowCellular: false,
        allowMetered: false,
      },
      manual: {
        enabled: false,
        interval: SYNC_INTERVALS.MANUAL,
        wifiOnly: false,
        allowCellular: true,
        allowMetered: true,
      },
    };

    const config = configurations[preset];
    await backgroundSyncService.updatePreferences(config);
    
    console.log(`Background sync configured with ${preset} preset`);
  }

  /**
   * Get readable sync configuration
   */
  static async getCurrentConfiguration() {
    const status = await backgroundSyncService.getStatus();
    
    return {
      isEnabled: true, // Get from Redux store
      intervalLabel: this.getIntervalLabel(15), // Get from Redux store
      networkPreference: 'WiFi + Cellular', // Get from Redux store
      lastSync: status.lastSyncTime,
      nextSync: status.nextScheduledSync,
      recentSyncs: status.syncHistory.slice(0, 5),
    };
  }

  /**
   * Get human-readable interval label
   */
  private static getIntervalLabel(intervalMinutes: number): string {
    switch (intervalMinutes) {
      case SYNC_INTERVALS.MANUAL:
        return 'Manual Only';
      case SYNC_INTERVALS.FIFTEEN_MINUTES:
        return '15 Minutes';
      case SYNC_INTERVALS.THIRTY_MINUTES:
        return '30 Minutes';
      case SYNC_INTERVALS.ONE_HOUR:
        return '1 Hour';
      case SYNC_INTERVALS.TWO_HOURS:
        return '2 Hours';
      default:
        return `${intervalMinutes} Minutes`;
    }
  }
}

/**
 * Example: Monitoring and debugging helper
 */
export class BackgroundSyncMonitor {
  
  /**
   * Get comprehensive sync statistics
   */
  static async getSyncStatistics() {
    const status = await backgroundSyncService.getStatus();
    
    const stats = {
      totalSyncs: status.syncHistory.length,
      successfulSyncs: status.syncHistory.filter(s => s.success).length,
      failedSyncs: status.syncHistory.filter(s => !s.success).length,
      averageDuration: this.calculateAverageDuration(status.syncHistory),
      averageItemsSynced: this.calculateAverageItems(status.syncHistory),
      networkDistribution: this.calculateNetworkDistribution(status.syncHistory),
      lastWeekSyncs: this.getLastWeekSyncs(status.syncHistory),
    };

    return stats;
  }

  /**
   * Calculate average sync duration
   */
  private static calculateAverageDuration(history: any[]): number {
    const successfulSyncs = history.filter(s => s.success && s.duration);
    if (successfulSyncs.length === 0) return 0;
    
    const totalDuration = successfulSyncs.reduce((sum, sync) => sum + sync.duration, 0);
    return Math.round(totalDuration / successfulSyncs.length);
  }

  /**
   * Calculate average items synced
   */
  private static calculateAverageItems(history: any[]): number {
    const successfulSyncs = history.filter(s => s.success && s.itemsSynced !== undefined);
    if (successfulSyncs.length === 0) return 0;
    
    const totalItems = successfulSyncs.reduce((sum, sync) => sum + sync.itemsSynced, 0);
    return Math.round(totalItems / successfulSyncs.length);
  }

  /**
   * Calculate network type distribution
   */
  private static calculateNetworkDistribution(history: any[]) {
    const distribution = history.reduce((acc, sync) => {
      const network = sync.networkType || 'unknown';
      acc[network] = (acc[network] || 0) + 1;
      return acc;
    }, {});

    return distribution;
  }

  /**
   * Get syncs from the last week
   */
  private static getLastWeekSyncs(history: any[]): any[] {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    return history.filter(sync => {
      const syncTime = new Date(sync.timestamp).getTime();
      return syncTime >= oneWeekAgo;
    });
  }

  /**
   * Export sync data for debugging
   */
  static async exportSyncData() {
    const status = await backgroundSyncService.getStatus();
    const stats = await this.getSyncStatistics();
    
    const exportData = {
      timestamp: new Date().toISOString(),
      currentStatus: status,
      statistics: stats,
      configuration: await BackgroundSyncConfigHelper.getCurrentConfiguration(),
    };

    console.log('Background Sync Export Data:', JSON.stringify(exportData, null, 2));
    return exportData;
  }
}

/**
 * Example usage in App.tsx:
 * 
 * import { BackgroundSyncAppIntegration } from './src/examples/BackgroundSyncUsage';
 * 
 * function App() {
 *   const syncIntegration = useRef(new BackgroundSyncAppIntegration());
 * 
 *   useEffect(() => {
 *     syncIntegration.current.initializeBackgroundSync();
 * 
 *     return () => {
 *       syncIntegration.current.cleanup();
 *     };
 *   }, []);
 * 
 *   // ... rest of your app
 * }
 */