/**
 * Unit tests for Enhanced Logger with Sync Monitoring
 * Tests comprehensive logging functionality including sync-specific features
 */

import { logger, LogLevel, LogCategory } from '../../src/utils/logger';
import { SyncPhase, NetworkType } from '../../src/types/sync';

// Mock console methods
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Store original console methods
const originalConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

describe('Enhanced Logger', () => {
  beforeEach(() => {
    // Mock console methods
    console.debug = mockConsole.debug;
    console.info = mockConsole.info;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;
    
    // Clear all mock calls
    jest.clearAllMocks();
    
    // Clear log history
    logger.clearHistory();
    
    // Enable debug mode for testing
    logger.enableDebugMode();
  });

  afterEach(() => {
    // Restore original console methods
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('Basic Logging', () => {
    test('should log debug messages when debug mode is enabled', () => {
      logger.debug('Test debug message', { test: 'data' }, LogCategory.SYNC);
      
      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] [SYNC]'),
        { test: 'data' }
      );
    });

    test('should log info messages', () => {
      logger.info('Test info message', { test: 'data' }, LogCategory.API);
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [API]'),
        { test: 'data' }
      );
    });

    test('should log warn messages', () => {
      logger.warn('Test warning message', { test: 'data' }, LogCategory.NETWORK);
      
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] [NETWORK]'),
        { test: 'data' }
      );
    });

    test('should log error messages', () => {
      logger.error('Test error message', { test: 'data' }, LogCategory.ERROR);
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [ERROR]'),
        { test: 'data' }
      );
    });

    test('should respect log level settings', () => {
      logger.setLogLevel(LogLevel.WARN);
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });

    test('should not log debug messages when debug mode is disabled', () => {
      logger.disableDebugMode();
      logger.debug('Debug message');
      
      expect(mockConsole.debug).not.toHaveBeenCalled();
    });
  });

  describe('Sync Logging', () => {
    test('should log sync operations with proper formatting', () => {
      const syncId = 'test-sync-123';
      const phase = SyncPhase.UPLOADING_CHANGES;
      const operation = 'sync_up';
      const message = 'Starting sync up operation';
      const data = {
        itemCount: 5,
        errorCount: 0,
        networkType: NetworkType.WIFI
      };

      logger.syncLog(syncId, phase, operation, message, data);

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [SYNC][test-sync-123][uploading_changes]'),
        data
      );
    });

    test('should log sync debug messages with proper formatting', () => {
      const syncId = 'test-sync-123';
      const phase = SyncPhase.DOWNLOADING_UPDATES;
      const operation = 'fetch_articles';
      const message = 'Fetching articles from remote';
      const data = { articleCount: 10 };

      logger.syncDebug(syncId, phase, operation, message, data);

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] [SYNC][test-sync-123][downloading_updates]'),
        data
      );
    });

    test('should log sync errors with proper formatting', () => {
      const syncId = 'test-sync-123';
      const phase = SyncPhase.RESOLVING_CONFLICTS;
      const operation = 'resolve_conflict';
      const message = 'Failed to resolve conflict';
      const error = new Error('Conflict resolution failed');
      const data = { conflictId: 'conflict-1' };

      logger.syncError(syncId, phase, operation, message, error, data);

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [SYNC][test-sync-123][resolving_conflicts]'),
        { error, ...data }
      );
    });

    test('should store sync metrics when duration is provided', () => {
      const syncId = 'test-sync-123';
      const phase = SyncPhase.FINALIZING;
      const operation = 'full_sync';
      const message = 'Sync completed';
      const data = {
        duration: 5000,
        itemCount: 10,
        errorCount: 1
      };

      logger.syncLog(syncId, phase, operation, message, data);

      const metrics = logger.getSyncMetrics('full_sync');
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        operation: 'full_sync',
        duration: 5000,
        success: false, // errorCount > 0
        itemCount: 10,
        errorCount: 1
      });
    });
  });

  describe('Performance Timing', () => {
    test('should track performance timers', (done) => {
      const timerId = 'test-operation';
      const data = { operationType: 'sync' };

      logger.startPerformanceTimer(timerId, data);
      
      // Simulate some work
      setTimeout(() => {
        const duration = logger.endPerformanceTimer(timerId, LogCategory.PERFORMANCE);
        
        expect(duration).toBeGreaterThan(0);
        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringContaining('[INFO] [PERFORMANCE]'),
          data
        );
        done();
      }, 10);
    });

    test('should return 0 for non-existent timers', () => {
      const duration = logger.endPerformanceTimer('non-existent');
      expect(duration).toBe(0);
    });
  });

  describe('Log History', () => {
    test('should maintain log history', () => {
      logger.info('Test message 1', { id: 1 }, LogCategory.SYNC);
      logger.warn('Test message 2', { id: 2 }, LogCategory.API);
      logger.error('Test message 3', { id: 3 }, LogCategory.DB);

      const history = logger.getLogHistory();
      expect(history).toHaveLength(3);
      expect(history[0].message).toBe('Test message 1');
      expect(history[1].message).toBe('Test message 2');
      expect(history[2].message).toBe('Test message 3');
    });

    test('should filter log history by category', () => {
      logger.info('Sync message', {}, LogCategory.SYNC);
      logger.warn('API message', {}, LogCategory.API);
      logger.error('DB message', {}, LogCategory.DB);

      const syncLogs = logger.getLogHistory(LogCategory.SYNC);
      expect(syncLogs).toHaveLength(1);
      expect(syncLogs[0].category).toBe(LogCategory.SYNC);
    });

    test('should filter log history by level', () => {
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      const warningAndAbove = logger.getLogHistory(undefined, LogLevel.WARN);
      expect(warningAndAbove).toHaveLength(2);
      expect(warningAndAbove.every(log => log.level >= LogLevel.WARN)).toBe(true);
    });

    test('should filter log history by date', (done) => {
      const cutoffDate = new Date();
      
      logger.info('Old message');
      
      // Simulate delay
      setTimeout(() => {
        logger.info('New message');
        
        const recentLogs = logger.getLogHistory(undefined, undefined, cutoffDate);
        expect(recentLogs).toHaveLength(1);
        expect(recentLogs[0].message).toBe('New message');
        done();
      }, 10);
    });

    test('should limit log history results', () => {
      for (let i = 0; i < 10; i++) {
        logger.info(`Message ${i}`);
      }

      const limitedLogs = logger.getLogHistory(undefined, undefined, undefined, 5);
      expect(limitedLogs).toHaveLength(5);
    });

    test('should maintain maximum log history size', () => {
      // Create more logs than the maximum
      for (let i = 0; i < 1100; i++) {
        logger.info(`Message ${i}`);
      }

      const history = logger.getLogHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Sync Logs', () => {
    test('should retrieve sync logs', () => {
      const syncId = 'test-sync-123';
      
      logger.syncLog(syncId, SyncPhase.INITIALIZING, 'start', 'Sync started');
      logger.syncLog(syncId, SyncPhase.UPLOADING_CHANGES, 'upload', 'Uploading changes');
      logger.info('Non-sync message', {}, LogCategory.API);

      const syncLogs = logger.getSyncLogs();
      expect(syncLogs).toHaveLength(2);
      expect(syncLogs.every(log => log.category === LogCategory.SYNC)).toBe(true);
    });

    test('should filter sync logs by syncId', () => {
      logger.syncLog('sync-1', SyncPhase.INITIALIZING, 'start', 'Sync 1 started');
      logger.syncLog('sync-2', SyncPhase.INITIALIZING, 'start', 'Sync 2 started');

      const sync1Logs = logger.getSyncLogs('sync-1');
      expect(sync1Logs).toHaveLength(1);
      expect(sync1Logs[0].syncId).toBe('sync-1');
    });

    test('should filter sync logs by phase', () => {
      const syncId = 'test-sync-123';
      
      logger.syncLog(syncId, SyncPhase.INITIALIZING, 'start', 'Initializing');
      logger.syncLog(syncId, SyncPhase.UPLOADING_CHANGES, 'upload', 'Uploading');
      logger.syncLog(syncId, SyncPhase.UPLOADING_CHANGES, 'upload_complete', 'Upload complete');

      const uploadLogs = logger.getSyncLogs(undefined, SyncPhase.UPLOADING_CHANGES);
      expect(uploadLogs).toHaveLength(2);
      expect(uploadLogs.every(log => log.phase === SyncPhase.UPLOADING_CHANGES)).toBe(true);
    });
  });

  describe('Sync Metrics', () => {
    test('should collect sync metrics', () => {
      const syncId = 'test-sync-123';
      
      logger.syncLog(syncId, SyncPhase.FINALIZING, 'sync_complete', 'Sync completed', {
        duration: 5000,
        itemCount: 10,
        errorCount: 0
      });

      const metrics = logger.getSyncMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        operation: 'sync_complete',
        duration: 5000,
        success: true,
        itemCount: 10,
        errorCount: 0
      });
    });

    test('should filter metrics by operation', () => {
      const syncId = 'test-sync-123';
      
      logger.syncLog(syncId, SyncPhase.UPLOADING_CHANGES, 'upload', 'Upload', { duration: 1000 });
      logger.syncLog(syncId, SyncPhase.DOWNLOADING_UPDATES, 'download', 'Download', { duration: 2000 });

      const uploadMetrics = logger.getSyncMetrics('upload');
      expect(uploadMetrics).toHaveLength(1);
      expect(uploadMetrics[0].operation).toBe('upload');
    });

    test('should sort metrics by timestamp descending', (done) => {
      const syncId = 'test-sync-123';
      
      logger.syncLog(syncId, SyncPhase.UPLOADING_CHANGES, 'first', 'First operation', { duration: 1000 });
      
      setTimeout(() => {
        logger.syncLog(syncId, SyncPhase.DOWNLOADING_UPDATES, 'second', 'Second operation', { duration: 2000 });
        
        const metrics = logger.getSyncMetrics();
        expect(metrics).toHaveLength(2);
        expect(metrics[0].operation).toBe('second'); // Most recent first
        expect(metrics[1].operation).toBe('first');
        done();
      }, 10);
    });
  });

  describe('Sync Statistics', () => {
    test('should calculate sync statistics', () => {
      const syncId = 'test-sync-123';
      
      // Add successful operation
      logger.syncLog(syncId, SyncPhase.FINALIZING, 'sync_complete', 'Success', {
        duration: 5000,
        itemCount: 10,
        errorCount: 0
      });
      
      // Add failed operation
      logger.syncLog(syncId, SyncPhase.FINALIZING, 'sync_complete', 'Failed', {
        duration: 3000,
        itemCount: 5,
        errorCount: 2
      });

      const stats = logger.getSyncStats();
      expect(stats).toMatchObject({
        totalOperations: 2,
        successfulOperations: 1,
        failedOperations: 1,
        averageDuration: 4000,
        operationsByType: {
          'sync_complete': 2
        }
      });
    });

    test('should filter statistics by date', (done) => {
      const syncId = 'test-sync-123';
      const cutoffDate = new Date();
      
      // Add old operation
      logger.syncLog(syncId, SyncPhase.FINALIZING, 'old_sync', 'Old sync', {
        duration: 1000,
        errorCount: 0
      });
      
      setTimeout(() => {
        // Add recent operation
        logger.syncLog(syncId, SyncPhase.FINALIZING, 'recent_sync', 'Recent sync', {
          duration: 2000,
          errorCount: 0
        });
        
        const recentStats = logger.getSyncStats(cutoffDate);
        expect(recentStats.totalOperations).toBe(1);
        expect(recentStats.operationsByType['recent_sync']).toBe(1);
        done();
      }, 10);
    });
  });

  describe('Log Export', () => {
    test('should export logs as formatted string', () => {
      logger.info('Test message 1', { id: 1 }, LogCategory.SYNC);
      logger.warn('Test message 2', { id: 2 }, LogCategory.API);

      const exportedLogs = logger.exportLogs();
      expect(exportedLogs).toContain('Test message 1');
      expect(exportedLogs).toContain('Test message 2');
      expect(exportedLogs).toContain('[INFO] [SYNC]');
      expect(exportedLogs).toContain('[WARN] [API]');
    });

    test('should export logs with filters', () => {
      logger.info('Sync message', {}, LogCategory.SYNC);
      logger.warn('API message', {}, LogCategory.API);
      logger.error('DB message', {}, LogCategory.DB);

      const syncLogs = logger.exportLogs(LogCategory.SYNC);
      expect(syncLogs).toContain('Sync message');
      expect(syncLogs).not.toContain('API message');
      expect(syncLogs).not.toContain('DB message');
    });
  });

  describe('History Management', () => {
    test('should clear history', () => {
      logger.info('Test message 1');
      logger.warn('Test message 2');
      logger.syncLog('sync-1', SyncPhase.INITIALIZING, 'start', 'Sync started', { duration: 1000 });

      expect(logger.getLogHistory()).toHaveLength(3);
      expect(logger.getSyncMetrics()).toHaveLength(1);

      logger.clearHistory();

      expect(logger.getLogHistory()).toHaveLength(0);
      expect(logger.getSyncMetrics()).toHaveLength(0);
    });
  });
});