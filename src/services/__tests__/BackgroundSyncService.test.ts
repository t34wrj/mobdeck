/**
 * BackgroundSyncService Tests
 */

import { backgroundSyncService } from '../BackgroundSyncService';

// Mock dependencies
jest.mock('react-native-background-actions', () => ({
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  updateNotification: jest.fn(() => Promise.resolve()),
  isRunning: jest.fn(() => false),
  on: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, type: 'wifi' })),
}));

jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  NativeEventEmitter: jest.fn(),
}));

jest.mock('../SyncService', () => ({
  syncService: {
    startFullSync: jest.fn(() =>
      Promise.resolve({
        success: true,
        syncedCount: 5,
        conflictCount: 0,
        errorCount: 0,
        duration: 1000,
        errors: [],
      })
    ),
  },
}));

jest.mock('../../store', () => ({
  store: {
    dispatch: jest.fn(),
    getState: jest.fn(() => ({
      sync: {
        status: 'idle',
        config: {
          backgroundSyncEnabled: true,
          syncInterval: 15,
          syncOnWifiOnly: false,
          syncOnCellular: true,
        },
      },
    })),
  },
}));

describe('BackgroundSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create singleton instance', () => {
    expect(backgroundSyncService).toBeDefined();
  });

  it('should initialize successfully', async () => {
    await expect(backgroundSyncService.initialize()).resolves.not.toThrow();
  });

  it('should update preferences', async () => {
    await backgroundSyncService.initialize();

    await expect(
      backgroundSyncService.updatePreferences({
        enabled: false,
        interval: 30,
      })
    ).resolves.not.toThrow();
  });

  it('should get sync status', async () => {
    await backgroundSyncService.initialize();

    const status = await backgroundSyncService.getStatus();

    expect(status).toHaveProperty('isRunning');
    expect(status).toHaveProperty('lastSyncTime');
    expect(status).toHaveProperty('syncHistory');
  });

  it('should trigger manual sync', async () => {
    await backgroundSyncService.initialize();

    await expect(
      backgroundSyncService.triggerManualSync()
    ).resolves.not.toThrow();
  });

  it('should clean up resources', () => {
    expect(() => backgroundSyncService.cleanup()).not.toThrow();
  });
});
