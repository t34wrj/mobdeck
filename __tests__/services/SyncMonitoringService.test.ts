/**
 * Unit tests for SyncMonitoringService
 * Tests comprehensive sync monitoring and analytics functionality
 */

import { syncMonitoringService } from '../../src/services/SyncMonitoringService';
import { SyncPhase, SyncStatus, NetworkType } from '../../src/types/sync';
import { logger } from '../../src/utils/logger';

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    syncLog: jest.fn(),
    syncError: jest.fn(),
  },
  LogCategory: {
    SYNC: 'SYNC',
    API: 'API',
    DB: 'DB',
    UI: 'UI',
    NETWORK: 'NETWORK',
    PERFORMANCE: 'PERFORMANCE',
    ERROR: 'ERROR',
    GENERAL: 'GENERAL'
  }
}));

describe('SyncMonitoringService', () => {
  beforeEach(() => {
    // Clear all monitoring data before each test
    syncMonitoringService.clearHistory();
    jest.clearAllMocks();
  });

  describe('Sync Operation Tracking', () => {
    test('should start sync operation tracking', () => {
      const syncId = 'test-sync-123';
      const phase = SyncPhase.INITIALIZING;
      const networkType = NetworkType.WIFI;
      const batchSize = 25;

      syncMonitoringService.startSyncOperation(syncId, phase, networkType, batchSize);

      const operation = syncMonitoringService.getSyncOperationMetrics(syncId);
      expect(operation).toBeDefined();
      expect(operation).toMatchObject({
        syncId,
        phase,
        status: SyncStatus.SYNCING,
        networkType,
        batchSize,
        itemsProcessed: 0,
        itemsSuccessful: 0,
        itemsFailed: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        errorMessages: [],
        performanceMarkers: {}
      });
    });

    test('should update sync progress', () => {
      const syncId = 'test-sync-123';
      
      syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.updateSyncProgress(syncId, SyncPhase.UPLOADING_CHANGES, 10, 8, 2, 1);

      const operation = syncMonitoringService.getSyncOperationMetrics(syncId);
      expect(operation).toMatchObject({
        phase: SyncPhase.UPLOADING_CHANGES,
        itemsProcessed: 10,
        itemsSuccessful: 8,
        itemsFailed: 2,
        conflictsDetected: 1
      });
    });

    test('should add performance markers', () => {
      const syncId = 'test-sync-123';
      
      syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.addPerformanceMarker(syncId, 'upload_phase', 5000);
      syncMonitoringService.addPerformanceMarker(syncId, 'download_phase', 3000);

      const operation = syncMonitoringService.getSyncOperationMetrics(syncId);
      expect(operation?.performanceMarkers).toMatchObject({
        'upload_phase': 5000,
        'download_phase': 3000
      });
    });

    test('should record sync errors', () => {
      const syncId = 'test-sync-123';
      const errorMessage = 'Network timeout occurred';
      
      syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.recordSyncError(syncId, SyncPhase.DOWNLOADING_UPDATES, errorMessage);

      const operation = syncMonitoringService.getSyncOperationMetrics(syncId);
      expect(operation?.errorMessages).toContain(errorMessage);
      expect(operation?.phase).toBe(SyncPhase.DOWNLOADING_UPDATES);
    });

    test('should complete sync operation', () => {
      const syncId = 'test-sync-123';
      
      syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.completeSyncOperation(syncId, SyncStatus.SUCCESS, 2);

      const operation = syncMonitoringService.getSyncOperationMetrics(syncId);
      expect(operation?.status).toBe(SyncStatus.SUCCESS);
      expect(operation?.conflictsResolved).toBe(2);
      expect(operation?.endTime).toBeDefined();
      expect(operation?.duration).toBeGreaterThan(0);
    });

    test('should handle monitoring disabled', () => {
      syncMonitoringService.disableMonitoring();
      
      const syncId = 'test-sync-123';
      syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);

      const operation = syncMonitoringService.getSyncOperationMetrics(syncId);
      expect(operation).toBeUndefined();
    });
  });

  describe('Sync Operations History', () => {
    test('should retrieve all sync operations', () => {
      const syncId1 = 'test-sync-1';
      const syncId2 = 'test-sync-2';
      
      syncMonitoringService.startSyncOperation(syncId1, SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.startSyncOperation(syncId2, SyncPhase.INITIALIZING, NetworkType.CELLULAR);

      const operations = syncMonitoringService.getAllSyncOperations();
      expect(operations).toHaveLength(2);
      expect(operations.map(op => op.syncId)).toContain(syncId1);
      expect(operations.map(op => op.syncId)).toContain(syncId2);
    });

    test('should limit sync operations results', () => {
      for (let i = 0; i < 10; i++) {
        syncMonitoringService.startSyncOperation(`sync-${i}`, SyncPhase.INITIALIZING, NetworkType.WIFI);
      }

      const limitedOperations = syncMonitoringService.getAllSyncOperations(5);
      expect(limitedOperations).toHaveLength(5);
    });

    test('should sort operations by start time descending', (done) => {
      const syncId1 = 'test-sync-1';
      const syncId2 = 'test-sync-2';
      
      syncMonitoringService.startSyncOperation(syncId1, SyncPhase.INITIALIZING, NetworkType.WIFI);
      
      setTimeout(() => {
        syncMonitoringService.startSyncOperation(syncId2, SyncPhase.INITIALIZING, NetworkType.WIFI);
        
        const operations = syncMonitoringService.getAllSyncOperations();
        expect(operations[0].syncId).toBe(syncId2); // Most recent first
        expect(operations[1].syncId).toBe(syncId1);
        done();
      }, 10);
    });
  });

  describe('Health Metrics', () => {
    test('should calculate health metrics for successful operations', () => {
      const syncId = 'test-sync-123';
      
      syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.updateSyncProgress(syncId, SyncPhase.UPLOADING_CHANGES, 10, 10, 0);
      syncMonitoringService.completeSyncOperation(syncId, SyncStatus.SUCCESS);

      const healthMetrics = syncMonitoringService.getSyncHealthMetrics();
      expect(healthMetrics).toMatchObject({
        successRate: 1.0,
        errorRate: 0.0,
        conflictRate: 0.0,
        averageItemsPerSync: 10
      });
    });

    test('should calculate health metrics for failed operations', () => {
      const syncId = 'test-sync-123';
      
      syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.updateSyncProgress(syncId, SyncPhase.UPLOADING_CHANGES, 10, 5, 5);
      syncMonitoringService.completeSyncOperation(syncId, SyncStatus.ERROR);

      const healthMetrics = syncMonitoringService.getSyncHealthMetrics();
      expect(healthMetrics).toMatchObject({
        successRate: 0.0,
        errorRate: 0.5, // 5 errors out of 10 items
        conflictRate: 0.0,
        averageItemsPerSync: 10
      });
    });

    test('should calculate network distribution', () => {
      syncMonitoringService.startSyncOperation('sync-1', SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.completeSyncOperation('sync-1', SyncStatus.SUCCESS);
      
      syncMonitoringService.startSyncOperation('sync-2', SyncPhase.INITIALIZING, NetworkType.CELLULAR);
      syncMonitoringService.completeSyncOperation('sync-2', SyncStatus.SUCCESS);
      
      syncMonitoringService.startSyncOperation('sync-3', SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.completeSyncOperation('sync-3', SyncStatus.SUCCESS);

      const healthMetrics = syncMonitoringService.getSyncHealthMetrics();
      expect(healthMetrics.networkDistribution).toMatchObject({
        [NetworkType.WIFI]: 2,
        [NetworkType.CELLULAR]: 1
      });
    });

    test('should calculate phase performance', () => {
      const syncId = 'test-sync-123';
      
      syncMonitoringService.startSyncOperation(syncId, SyncPhase.UPLOADING_CHANGES, NetworkType.WIFI);
      syncMonitoringService.completeSyncOperation(syncId, SyncStatus.SUCCESS);

      const healthMetrics = syncMonitoringService.getSyncHealthMetrics();
      expect(healthMetrics.phasePerformance[SyncPhase.UPLOADING_CHANGES]).toBeDefined();
      expect(healthMetrics.phasePerformance[SyncPhase.UPLOADING_CHANGES].count).toBe(1);
      expect(healthMetrics.phasePerformance[SyncPhase.UPLOADING_CHANGES].averageDuration).toBeGreaterThan(0);
    });

    test('should include recent errors in health metrics', () => {
      const syncId = 'test-sync-123';
      const errorMessage = 'Test error message';
      
      syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.recordSyncError(syncId, SyncPhase.DOWNLOADING_UPDATES, errorMessage);
      syncMonitoringService.completeSyncOperation(syncId, SyncStatus.ERROR);

      const healthMetrics = syncMonitoringService.getSyncHealthMetrics();
      expect(healthMetrics.recentErrors).toHaveLength(1);
      expect(healthMetrics.recentErrors[0]).toMatchObject({
        error: errorMessage,
        phase: SyncPhase.DOWNLOADING_UPDATES
      });
    });

    test('should handle empty metrics when no operations exist', () => {
      const healthMetrics = syncMonitoringService.getSyncHealthMetrics();
      expect(healthMetrics).toMatchObject({
        successRate: 0,
        averageDuration: 0,
        averageItemsPerSync: 0,
        errorRate: 0,
        conflictRate: 0,
        networkDistribution: {},
        phasePerformance: {},
        recentErrors: []
      });
    });
  });

  describe('Alert System', () => {
    test('should have default alert conditions', () => {
      const alerts = syncMonitoringService.getActiveAlerts();
      expect(alerts).toHaveLength(0); // No alerts initially
    });

    test('should trigger high error rate alert', () => {
      // Create multiple operations with high error rate
      for (let i = 0; i < 10; i++) {
        const syncId = `sync-${i}`;
        syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
        syncMonitoringService.updateSyncProgress(syncId, SyncPhase.UPLOADING_CHANGES, 10, 0, 10); // All errors
        syncMonitoringService.completeSyncOperation(syncId, SyncStatus.ERROR);
      }

      const alerts = syncMonitoringService.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(alert => alert.condition.type === 'error_rate')).toBe(true);
    });

    test('should clear specific alerts', () => {
      // Trigger an alert
      for (let i = 0; i < 5; i++) {
        const syncId = `sync-${i}`;
        syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
        syncMonitoringService.updateSyncProgress(syncId, SyncPhase.UPLOADING_CHANGES, 10, 0, 10);
        syncMonitoringService.completeSyncOperation(syncId, SyncStatus.ERROR);
      }

      const alerts = syncMonitoringService.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      const alertId = alerts[0].id;
      syncMonitoringService.clearAlert(alertId);

      const remainingAlerts = syncMonitoringService.getActiveAlerts();
      expect(remainingAlerts.some(alert => alert.id === alertId)).toBe(false);
    });

    test('should add custom alert condition', () => {
      const customCondition = {
        type: 'custom_error_rate' as any,
        threshold: 0.1,
        timeWindow: 30,
        description: 'Custom error rate alert'
      };

      syncMonitoringService.addAlertCondition(customCondition);

      // The alert condition should be added (we can't directly test this without triggering)
      // but we can verify the method doesn't throw an error
      expect(() => syncMonitoringService.addAlertCondition(customCondition)).not.toThrow();
    });

    test('should remove alert condition', () => {
      syncMonitoringService.removeAlertCondition('error_rate');

      // Create operations with high error rate
      for (let i = 0; i < 10; i++) {
        const syncId = `sync-${i}`;
        syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
        syncMonitoringService.updateSyncProgress(syncId, SyncPhase.UPLOADING_CHANGES, 10, 0, 10);
        syncMonitoringService.completeSyncOperation(syncId, SyncStatus.ERROR);
      }

      const alerts = syncMonitoringService.getActiveAlerts();
      expect(alerts.some(alert => alert.condition.type === 'error_rate')).toBe(false);
    });
  });

  describe('Sync Report Generation', () => {
    test('should generate comprehensive sync report', () => {
      const syncId = 'test-sync-123';
      
      syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.updateSyncProgress(syncId, SyncPhase.UPLOADING_CHANGES, 10, 9, 1);
      syncMonitoringService.completeSyncOperation(syncId, SyncStatus.SUCCESS);

      const report = syncMonitoringService.generateSyncReport(60);
      
      expect(report).toContain('# Sync Monitoring Report');
      expect(report).toContain('## Health Metrics');
      expect(report).toContain('Success Rate: 100.0%');
      expect(report).toContain('Error Rate: 10.0%');
      expect(report).toContain('## Network Distribution');
      expect(report).toContain('wifi: 1 operations');
      expect(report).toContain('## Recent Operations');
      expect(report).toContain('## Active Alerts');
    });

    test('should include operation details in report', () => {
      const syncId = 'test-sync-123';
      
      syncMonitoringService.startSyncOperation(syncId, SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.updateSyncProgress(syncId, SyncPhase.UPLOADING_CHANGES, 5, 5, 0);
      syncMonitoringService.completeSyncOperation(syncId, SyncStatus.SUCCESS);

      const report = syncMonitoringService.generateSyncReport();
      
      expect(report).toContain(syncId);
      expect(report).toContain('success');
      expect(report).toContain('5 items');
    });
  });

  describe('History Management', () => {
    test('should maintain operation history within limits', () => {
      // Create more operations than the limit
      for (let i = 0; i < 150; i++) {
        syncMonitoringService.startSyncOperation(`sync-${i}`, SyncPhase.INITIALIZING, NetworkType.WIFI);
      }

      const operations = syncMonitoringService.getAllSyncOperations();
      expect(operations.length).toBeLessThanOrEqual(100); // Should be limited to maxOperationHistory
    });

    test('should clear all history', () => {
      syncMonitoringService.startSyncOperation('sync-1', SyncPhase.INITIALIZING, NetworkType.WIFI);
      syncMonitoringService.startSyncOperation('sync-2', SyncPhase.INITIALIZING, NetworkType.WIFI);

      expect(syncMonitoringService.getAllSyncOperations()).toHaveLength(2);

      syncMonitoringService.clearHistory();

      expect(syncMonitoringService.getAllSyncOperations()).toHaveLength(0);
      expect(syncMonitoringService.getActiveAlerts()).toHaveLength(0);
    });
  });

  describe('Monitoring Control', () => {
    test('should enable and disable monitoring', () => {
      syncMonitoringService.disableMonitoring();
      syncMonitoringService.startSyncOperation('sync-1', SyncPhase.INITIALIZING, NetworkType.WIFI);
      
      expect(syncMonitoringService.getSyncOperationMetrics('sync-1')).toBeUndefined();

      syncMonitoringService.enableMonitoring();
      syncMonitoringService.startSyncOperation('sync-2', SyncPhase.INITIALIZING, NetworkType.WIFI);
      
      expect(syncMonitoringService.getSyncOperationMetrics('sync-2')).toBeDefined();
    });

    test('should log monitoring state changes', () => {
      syncMonitoringService.enableMonitoring();
      expect(logger.info).toHaveBeenCalledWith('Sync monitoring enabled', undefined, expect.any(String));

      syncMonitoringService.disableMonitoring();
      expect(logger.info).toHaveBeenCalledWith('Sync monitoring disabled', undefined, expect.any(String));
    });
  });
});