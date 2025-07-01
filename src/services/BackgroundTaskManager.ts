/**
 * BackgroundTaskManager - Android Background Task Management Service
 *
 * Features:
 * - Android-specific background task scheduling and management
 * - Integration with existing BackgroundSyncService
 * - Android 13+ compatibility with background task restrictions
 * - Network-aware task execution with proper permissions
 * - Foreground service management for long-running sync operations
 */

import {
  NativeModules,
  DeviceEventEmitter,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backgroundSyncService } from './BackgroundSyncService';
import { store } from '../store';
import { syncError } from '../store/slices/syncSlice';

// Background task constants
const BACKGROUND_TASK_STORAGE_KEY = '@mobdeck/background_tasks';
const NOTIFICATION_PERMISSION_KEY = '@mobdeck/notification_permission';
const ALARM_PERMISSION_KEY = '@mobdeck/alarm_permission';

interface BackgroundTaskConfig {
  taskId: string;
  enabled: boolean;
  interval: number;
  networkRequirement: 'any' | 'wifi' | 'unmetered';
  requiresCharging: boolean;
  requiresDeviceIdle: boolean;
  lastExecuted?: string;
  nextScheduled?: string;
}

interface AndroidTaskPermissions {
  notifications: boolean;
  exactAlarms: boolean;
  backgroundActivity: boolean;
  foregroundService: boolean;
}

/**
 * BackgroundTaskManager - Manages Android-specific background task scheduling
 */
class BackgroundTaskManager {
  private static instance: BackgroundTaskManager;
  private isInitialized = false;
  private taskConfigs: Map<string, BackgroundTaskConfig> = new Map();
  private permissions: AndroidTaskPermissions = {
    notifications: false,
    exactAlarms: false,
    backgroundActivity: false,
    foregroundService: false,
  };

  private constructor() {}

  /**
   * Get singleton instance of BackgroundTaskManager
   */
  public static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  /**
   * Initialize background task manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[BackgroundTaskManager] Already initialized');
      return;
    }

    try {
      console.log('[BackgroundTaskManager] Initializing...');

      // Check Android version and platform
      if (Platform.OS !== 'android') {
        console.log(
          '[BackgroundTaskManager] Not on Android platform, skipping initialization'
        );
        return;
      }

      // Load saved task configurations
      await this.loadTaskConfigurations();

      // Check and request required permissions
      await this.checkAndRequestPermissions();

      // Set up device event listeners
      this.setupDeviceEventListeners();

      // Register background task handlers
      await this.registerTaskHandlers();

      // Initialize integration with BackgroundSyncService
      await this.initializeBackgroundSyncIntegration();

      this.isInitialized = true;
      console.log('[BackgroundTaskManager] Initialized successfully');
    } catch (error) {
      console.error('[BackgroundTaskManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Load task configurations from storage
   */
  private async loadTaskConfigurations(): Promise<void> {
    try {
      const savedConfigs = await AsyncStorage.getItem(
        BACKGROUND_TASK_STORAGE_KEY
      );
      if (savedConfigs) {
        const configs: BackgroundTaskConfig[] = JSON.parse(savedConfigs);
        configs.forEach(config => {
          this.taskConfigs.set(config.taskId, config);
        });
        console.log(
          `[BackgroundTaskManager] Loaded ${configs.length} task configurations`
        );
      }
    } catch (error) {
      console.error(
        '[BackgroundTaskManager] Failed to load task configurations:',
        error
      );
    }
  }

  /**
   * Save task configurations to storage
   */
  private async saveTaskConfigurations(): Promise<void> {
    try {
      const configs = Array.from(this.taskConfigs.values());
      await AsyncStorage.setItem(
        BACKGROUND_TASK_STORAGE_KEY,
        JSON.stringify(configs)
      );
    } catch (error) {
      console.error(
        '[BackgroundTaskManager] Failed to save task configurations:',
        error
      );
    }
  }

  /**
   * Check and request required Android permissions
   */
  private async checkAndRequestPermissions(): Promise<void> {
    try {
      // Check notification permission (Android 13+)
      if (Platform.Version >= 33) {
        const notificationPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );

        if (!notificationPermission) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            {
              title: 'Notification Permission',
              message:
                'Mobdeck needs notification permission to show sync status updates.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
          this.permissions.notifications =
            granted === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          this.permissions.notifications = true;
        }
      } else {
        this.permissions.notifications = true; // Not required for older versions
      }

      // Check exact alarm permission (Android 12+)
      if (Platform.Version >= 31) {
        try {
          // Use native module to check exact alarm permission
          const hasExactAlarmPermission =
            await this.checkExactAlarmPermission();
          this.permissions.exactAlarms = hasExactAlarmPermission;

          if (!hasExactAlarmPermission) {
            console.warn(
              '[BackgroundTaskManager] Exact alarm permission not granted, background sync may be less reliable'
            );
          }
        } catch (error) {
          console.warn(
            '[BackgroundTaskManager] Could not check exact alarm permission:',
            error
          );
          this.permissions.exactAlarms = false;
        }
      } else {
        this.permissions.exactAlarms = true; // Not required for older versions
      }

      // Check background activity and foreground service permissions
      this.permissions.backgroundActivity = true; // Handled by manifest permissions
      this.permissions.foregroundService = true; // Handled by manifest permissions

      console.log(
        '[BackgroundTaskManager] Permission status:',
        this.permissions
      );
    } catch (error) {
      console.error(
        '[BackgroundTaskManager] Failed to check permissions:',
        error
      );
    }
  }

  /**
   * Check exact alarm permission using native Android API
   */
  private async checkExactAlarmPermission(): Promise<boolean> {
    try {
      // This would typically require a native module implementation
      // For now, we'll assume permission is granted and handle gracefully
      return true;
    } catch (error) {
      console.warn(
        '[BackgroundTaskManager] Could not check exact alarm permission:',
        error
      );
      return false;
    }
  }

  /**
   * Set up device event listeners for Android background task events
   */
  private setupDeviceEventListeners(): void {
    // Listen for background task execution events
    DeviceEventEmitter.addListener('BackgroundTaskExecuted', data => {
      console.log('[BackgroundTaskManager] Background task executed:', data);
      this.handleBackgroundTaskExecution(data);
    });

    // Listen for task scheduling events
    DeviceEventEmitter.addListener('BackgroundTaskScheduled', data => {
      console.log('[BackgroundTaskManager] Background task scheduled:', data);
      this.handleBackgroundTaskScheduling(data);
    });

    // Listen for permission changes
    DeviceEventEmitter.addListener('PermissionChanged', data => {
      console.log('[BackgroundTaskManager] Permission changed:', data);
      this.handlePermissionChange(data);
    });
  }

  /**
   * Register background task handlers with Android system
   */
  private async registerTaskHandlers(): Promise<void> {
    try {
      // Register sync task
      const syncTaskConfig: BackgroundTaskConfig = {
        taskId: 'mobdeck-sync-task',
        enabled: true,
        interval: 15, // 15 minutes default
        networkRequirement: 'any',
        requiresCharging: false,
        requiresDeviceIdle: false,
      };

      this.taskConfigs.set(syncTaskConfig.taskId, syncTaskConfig);
      await this.saveTaskConfigurations();

      console.log('[BackgroundTaskManager] Task handlers registered');
    } catch (error) {
      console.error(
        '[BackgroundTaskManager] Failed to register task handlers:',
        error
      );
    }
  }

  /**
   * Initialize integration with existing BackgroundSyncService
   */
  private async initializeBackgroundSyncIntegration(): Promise<void> {
    try {
      // Initialize the background sync service if not already done
      await backgroundSyncService.initialize();

      // Register this manager as a task execution handler
      console.log(
        '[BackgroundTaskManager] Background sync integration initialized'
      );
    } catch (error) {
      console.error(
        '[BackgroundTaskManager] Failed to initialize background sync integration:',
        error
      );
    }
  }

  /**
   * Handle background task execution events
   */
  private handleBackgroundTaskExecution(data: any): void {
    const { taskId, success, error } = data;

    if (taskId === 'mobdeck-sync-task') {
      // Update task configuration with execution time
      const config = this.taskConfigs.get(taskId);
      if (config) {
        config.lastExecuted = new Date().toISOString();
        this.taskConfigs.set(taskId, config);
        this.saveTaskConfigurations();
      }

      if (!success && error) {
        // Dispatch error to Redux store
        store.dispatch(
          syncError({
            error: error.message || 'Background task execution failed',
            errorCode: 'BACKGROUND_TASK_FAILED',
            retryable: true,
          })
        );
      }
    }
  }

  /**
   * Handle background task scheduling events
   */
  private handleBackgroundTaskScheduling(data: any): void {
    const { taskId, nextExecution } = data;

    const config = this.taskConfigs.get(taskId);
    if (config && nextExecution) {
      config.nextScheduled = nextExecution;
      this.taskConfigs.set(taskId, config);
      this.saveTaskConfigurations();
    }
  }

  /**
   * Handle permission changes
   */
  private handlePermissionChange(data: any): void {
    const { permission, granted } = data;

    switch (permission) {
      case 'POST_NOTIFICATIONS':
        this.permissions.notifications = granted;
        break;
      case 'SCHEDULE_EXACT_ALARM':
        this.permissions.exactAlarms = granted;
        break;
    }

    console.log(
      '[BackgroundTaskManager] Permission updated:',
      permission,
      granted
    );
  }

  /**
   * Schedule background sync task
   */
  public async scheduleBackgroundSync(
    intervalMinutes: number,
    networkRequirement: 'any' | 'wifi' = 'any'
  ): Promise<void> {
    try {
      const config = this.taskConfigs.get('mobdeck-sync-task');
      if (!config) {
        throw new Error('Sync task configuration not found');
      }

      config.interval = intervalMinutes;
      config.networkRequirement = networkRequirement;
      config.enabled = true;
      config.nextScheduled = new Date(
        Date.now() + intervalMinutes * 60 * 1000
      ).toISOString();

      this.taskConfigs.set('mobdeck-sync-task', config);
      await this.saveTaskConfigurations();

      // Delegate to BackgroundSyncService for actual scheduling
      await backgroundSyncService.scheduleSync();

      console.log(
        `[BackgroundTaskManager] Background sync scheduled for ${intervalMinutes} minutes`
      );
    } catch (error) {
      console.error(
        '[BackgroundTaskManager] Failed to schedule background sync:',
        error
      );
      throw error;
    }
  }

  /**
   * Cancel background sync task
   */
  public async cancelBackgroundSync(): Promise<void> {
    try {
      const config = this.taskConfigs.get('mobdeck-sync-task');
      if (config) {
        config.enabled = false;
        config.nextScheduled = undefined;
        this.taskConfigs.set('mobdeck-sync-task', config);
        await this.saveTaskConfigurations();
      }

      // Delegate to BackgroundSyncService for actual cancellation
      await backgroundSyncService.cancelSync();

      console.log('[BackgroundTaskManager] Background sync cancelled');
    } catch (error) {
      console.error(
        '[BackgroundTaskManager] Failed to cancel background sync:',
        error
      );
    }
  }

  /**
   * Get current task status
   */
  public async getTaskStatus(): Promise<{
    permissions: AndroidTaskPermissions;
    tasks: BackgroundTaskConfig[];
    isBackgroundSyncEnabled: boolean;
  }> {
    const backgroundSyncStatus = await backgroundSyncService.getStatus();

    return {
      permissions: this.permissions,
      tasks: Array.from(this.taskConfigs.values()),
      isBackgroundSyncEnabled: backgroundSyncStatus.isRunning,
    };
  }

  /**
   * Request user to enable exact alarm permission
   */
  public async requestExactAlarmPermission(): Promise<boolean> {
    try {
      if (Platform.Version < 31) {
        return true; // Not required for older versions
      }

      // This would typically open Android settings for exact alarm permission
      // For now, we'll log and return current status
      console.log(
        '[BackgroundTaskManager] Exact alarm permission should be requested through settings'
      );
      return this.permissions.exactAlarms;
    } catch (error) {
      console.error(
        '[BackgroundTaskManager] Failed to request exact alarm permission:',
        error
      );
      return false;
    }
  }

  /**
   * Check if background tasks can run reliably
   */
  public canRunBackgroundTasks(): boolean {
    if (Platform.OS !== 'android') {
      return false;
    }

    // Check minimum required permissions
    const hasRequiredPermissions =
      this.permissions.backgroundActivity && this.permissions.foregroundService;

    // On Android 13+, notification permission is also required
    if (Platform.Version >= 33 && !this.permissions.notifications) {
      return false;
    }

    return hasRequiredPermissions;
  }

  /**
   * Get background task reliability score (0-100)
   */
  public getReliabilityScore(): number {
    let score = 0;

    // Base permissions (40 points)
    if (this.permissions.backgroundActivity) score += 20;
    if (this.permissions.foregroundService) score += 20;

    // Notification permission (20 points on Android 13+)
    if (Platform.Version >= 33) {
      if (this.permissions.notifications) score += 20;
    } else {
      score += 20; // Full points for older versions
    }

    // Exact alarm permission (20 points on Android 12+)
    if (Platform.Version >= 31) {
      if (this.permissions.exactAlarms) score += 20;
    } else {
      score += 20; // Full points for older versions
    }

    // Battery optimization (20 points - assume optimized for now)
    score += 20;

    return Math.min(score, 100);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    // Remove device event listeners
    DeviceEventEmitter.removeAllListeners('BackgroundTaskExecuted');
    DeviceEventEmitter.removeAllListeners('BackgroundTaskScheduled');
    DeviceEventEmitter.removeAllListeners('PermissionChanged');

    this.isInitialized = false;
    console.log('[BackgroundTaskManager] Cleanup completed');
  }
}

// Export singleton instance
export const backgroundTaskManager = BackgroundTaskManager.getInstance();

// Export class for testing
export default BackgroundTaskManager;
