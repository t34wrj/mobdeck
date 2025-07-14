/**
 * BackgroundTaskManager Tests
 *
 * Tests for Android background task management service
 */

import { Platform } from 'react-native';
import BackgroundTaskManager, {
  backgroundTaskManager,
} from '../BackgroundTaskManager';
import { backgroundSyncService } from '../BackgroundSyncService';

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 33,
  },
  DeviceEventEmitter: {
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
    },
    check: jest.fn(),
    request: jest.fn(),
  },
  NativeModules: {},
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../BackgroundSyncService', () => ({
  backgroundSyncService: {
    initialize: jest.fn(),
    scheduleSync: jest.fn(),
    cancelSync: jest.fn(),
    getStatus: jest.fn().mockResolvedValue({
      isRunning: false,
      lastSyncTime: null,
      nextScheduledSync: null,
      currentNetworkType: null,
      syncHistory: [],
    }),
  },
}));

describe('BackgroundTaskManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset Platform to Android for tests
    (Platform as any).OS = 'android';
    (Platform as any).Version = 33;

    // Reset singleton instance state
    const manager = BackgroundTaskManager.getInstance();
    (manager as any).isInitialized = false;
  });

  afterEach(() => {
    // Clean up any background tasks and listeners
    const manager = BackgroundTaskManager.getInstance();
    manager.cleanup();
  });

  describe('initialization', () => {
    it('should initialize successfully on Android', async () => {
      const manager = BackgroundTaskManager.getInstance();
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should skip initialization on non-Android platforms', async () => {
      (Platform as any).OS = 'ios';
      const manager = BackgroundTaskManager.getInstance();
      await manager.initialize();
      // Should not throw and should handle gracefully
    });

    it('should initialize background sync service integration', async () => {
      (Platform as any).OS = 'android';
      const manager = BackgroundTaskManager.getInstance();

      // Ensure we're testing a fresh instance
      (manager as any).isInitialized = false;

      await manager.initialize();
      expect(backgroundSyncService.initialize).toHaveBeenCalled();
    });
  });

  describe('background task scheduling', () => {
    it('should schedule background sync correctly', async () => {
      const manager = BackgroundTaskManager.getInstance();
      await manager.initialize();

      await manager.scheduleBackgroundSync(30, 'wifi');
      expect(backgroundSyncService.scheduleSync).toHaveBeenCalled();
    });

    it('should cancel background sync correctly', async () => {
      const manager = BackgroundTaskManager.getInstance();
      await manager.initialize();

      await manager.cancelBackgroundSync();
      expect(backgroundSyncService.cancelSync).toHaveBeenCalled();
    });
  });

  describe('permission checking', () => {
    it('should check required permissions on Android 13+', async () => {
      (Platform as any).OS = 'android';
      (Platform as any).Version = 33;
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(true);

      const manager = BackgroundTaskManager.getInstance();

      // Ensure we're testing a fresh instance
      (manager as any).isInitialized = false;

      await manager.initialize();

      expect(PermissionsAndroid.check).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    });

    it('should return correct reliability score', async () => {
      const manager = BackgroundTaskManager.getInstance();
      await manager.initialize();

      const score = manager.getReliabilityScore();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should check if background tasks can run', async () => {
      const manager = BackgroundTaskManager.getInstance();
      await manager.initialize();

      const canRun = manager.canRunBackgroundTasks();
      expect(typeof canRun).toBe('boolean');
    });
  });

  describe('task status', () => {
    it('should return task status correctly', async () => {
      const manager = BackgroundTaskManager.getInstance();
      await manager.initialize();

      const status = await manager.getTaskStatus();
      expect(status).toHaveProperty('permissions');
      expect(status).toHaveProperty('tasks');
      expect(status).toHaveProperty('isBackgroundSyncEnabled');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources correctly', () => {
      const manager = BackgroundTaskManager.getInstance();
      const { DeviceEventEmitter } = require('react-native');

      manager.cleanup();
      expect(DeviceEventEmitter.removeAllListeners).toHaveBeenCalledWith(
        'BackgroundTaskExecuted'
      );
      expect(DeviceEventEmitter.removeAllListeners).toHaveBeenCalledWith(
        'BackgroundTaskScheduled'
      );
      expect(DeviceEventEmitter.removeAllListeners).toHaveBeenCalledWith(
        'PermissionChanged'
      );
    });
  });
});

describe('backgroundTaskManager singleton', () => {
  it('should return the same instance', () => {
    const instance1 = backgroundTaskManager;
    const instance2 = BackgroundTaskManager.getInstance();
    expect(instance1).toBe(instance2);
  });
});
