/**
 * Database Sync Performance Monitor Tests
 * 
 * Comprehensive tests for performance monitoring including:
 * - Performance metrics collection
 * - Threshold detection and alerts
 * - Resource usage monitoring
 * - Performance report generation
 * - Bottleneck identification
 */

import { DatabaseSyncPerformanceMonitor } from '../../src/services/DatabaseSyncPerformanceMonitor';
import { SyncPhase } from '../../src/types/sync';

describe('Database Sync Performance Monitor', () => {
  let performanceMonitor: DatabaseSyncPerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = DatabaseSyncPerformanceMonitor.getInstance();
    performanceMonitor.clearAllData();
  });

  afterEach(() => {
    performanceMonitor.clearAllData();
  });

  describe('Performance Metrics Collection', () => {
    it('should collect performance metrics for database operations', async () => {
      // Arrange
      const operationId = 'test-operation-1';
      const operation = 'database_create';
      const phase = SyncPhase.UPLOADING_CHANGES;
      const recordCount = 10;

      // Act
      performanceMonitor.startOperation(operationId, operation, phase);
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const metric = performanceMonitor.endOperation(operationId, recordCount, true);

      // Assert
      expect(metric).toBeDefined();
      expect(metric?.id).toBe(operationId);
      expect(metric?.operation).toBe(operation);
      expect(metric?.phase).toBe(phase);
      expect(metric?.recordCount).toBe(recordCount);
      expect(metric?.success).toBe(true);
      expect(metric?.duration).toBeGreaterThan(0);
      expect(metric?.throughput).toBeGreaterThan(0);
      expect(metric?.startTime).toBeLessThan(metric?.endTime);
    });

    it('should handle multiple concurrent operations', async () => {
      // Arrange
      const operations = [
        { id: 'op1', operation: 'database_create', phase: SyncPhase.UPLOADING_CHANGES },
        { id: 'op2', operation: 'database_read', phase: SyncPhase.DOWNLOADING_UPDATES },
        { id: 'op3', operation: 'database_update', phase: SyncPhase.FINALIZING },
      ];

      // Act
      operations.forEach(op => {
        performanceMonitor.startOperation(op.id, op.operation, op.phase);
      });

      // Simulate concurrent work
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = operations.map(op => 
        performanceMonitor.endOperation(op.id, 5, true)
      );

      // Assert
      expect(metrics).toHaveLength(3);
      metrics.forEach((metric, index) => {
        expect(metric).toBeDefined();
        expect(metric?.id).toBe(operations[index].id);
        expect(metric?.operation).toBe(operations[index].operation);
        expect(metric?.phase).toBe(operations[index].phase);
        expect(metric?.duration).toBeGreaterThan(0);
      });
    });

    it('should handle operations with errors', async () => {
      // Arrange
      const operationId = 'error-operation';
      const operation = 'database_create';
      const phase = SyncPhase.UPLOADING_CHANGES;
      const recordCount = 5;
      const errorCount = 2;

      // Act
      performanceMonitor.startOperation(operationId, operation, phase);
      await new Promise(resolve => setTimeout(resolve, 30));
      const metric = performanceMonitor.endOperation(operationId, recordCount, false, errorCount);

      // Assert
      expect(metric).toBeDefined();
      expect(metric?.success).toBe(false);
      expect(metric?.errorCount).toBe(errorCount);
      expect(metric?.recordCount).toBe(recordCount);
    });

    it('should handle unknown operations gracefully', () => {
      // Arrange
      const unknownOperationId = 'unknown-operation';

      // Act
      const metric = performanceMonitor.endOperation(unknownOperationId, 0, true);

      // Assert
      expect(metric).toBeNull();
    });
  });

  describe('Performance Threshold Detection', () => {
    it('should detect duration threshold violations', async () => {
      // Arrange
      const operationId = 'slow-operation';
      const operation = 'database_create';
      const phase = SyncPhase.UPLOADING_CHANGES;

      // Set a very low threshold for testing
      performanceMonitor.setPerformanceThreshold({
        operation,
        maxDuration: 10, // 10ms
        minThroughput: 1,
        maxMemoryUsage: 1000,
        maxCpuUsage: 100,
      });

      // Act
      performanceMonitor.startOperation(operationId, operation, phase);
      await new Promise(resolve => setTimeout(resolve, 50)); // Exceed threshold
      performanceMonitor.endOperation(operationId, 5, true);

      // Assert
      const alerts = performanceMonitor.getRecentAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const durationAlert = alerts.find(alert => 
        alert.operation === operation && alert.metric === 'duration'
      );
      expect(durationAlert).toBeDefined();
      expect(durationAlert?.type).toBe('threshold_exceeded');
      expect(durationAlert?.actualValue).toBeGreaterThan(10);
    });

    it('should detect throughput threshold violations', async () => {
      // Arrange
      const operationId = 'low-throughput-operation';
      const operation = 'database_read';
      const phase = SyncPhase.DOWNLOADING_UPDATES;

      // Set a very high throughput threshold for testing
      performanceMonitor.setPerformanceThreshold({
        operation,
        maxDuration: 1000,
        minThroughput: 1000, // 1000 records/second
        maxMemoryUsage: 1000,
        maxCpuUsage: 100,
      });

      // Act
      performanceMonitor.startOperation(operationId, operation, phase);
      await new Promise(resolve => setTimeout(resolve, 100));
      performanceMonitor.endOperation(operationId, 5, true); // Low record count

      // Assert
      const alerts = performanceMonitor.getRecentAlerts();
      const throughputAlert = alerts.find(alert => 
        alert.operation === operation && alert.metric === 'throughput'
      );
      expect(throughputAlert).toBeDefined();
      expect(throughputAlert?.type).toBe('performance_degradation');
      expect(throughputAlert?.actualValue).toBeLessThan(1000);
    });

    it('should generate alerts with appropriate severity levels', async () => {
      // Arrange
      const operationId = 'severity-test';
      const operation = 'database_update';
      const phase = SyncPhase.FINALIZING;

      // Set threshold that will be exceeded significantly
      performanceMonitor.setPerformanceThreshold({
        operation,
        maxDuration: 10, // 10ms
        minThroughput: 1,
        maxMemoryUsage: 1000,
        maxCpuUsage: 100,
      });

      // Act
      performanceMonitor.startOperation(operationId, operation, phase);
      await new Promise(resolve => setTimeout(resolve, 100)); // Exceed threshold significantly
      performanceMonitor.endOperation(operationId, 1, true);

      // Assert
      const alerts = performanceMonitor.getRecentAlerts();
      const durationAlert = alerts.find(alert => 
        alert.operation === operation && alert.metric === 'duration'
      );
      
      expect(durationAlert).toBeDefined();
      expect(['high', 'critical']).toContain(durationAlert?.severity);
    });
  });

  describe('Resource Usage Monitoring', () => {
    it('should capture resource usage snapshots', async () => {
      // Arrange & Act
      const snapshot1 = performanceMonitor.getCurrentResourceUsage();
      await new Promise(resolve => setTimeout(resolve, 10));
      const snapshot2 = performanceMonitor.getCurrentResourceUsage();

      // Assert
      expect(snapshot1).toBeDefined();
      expect(snapshot1.timestamp).toBeGreaterThan(0);
      expect(snapshot1.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(snapshot1.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(snapshot1.diskUsage).toBeGreaterThanOrEqual(0);
      expect(snapshot1.networkUsage).toBeGreaterThanOrEqual(0);
      expect(snapshot1.activeOperations).toBeGreaterThanOrEqual(0);

      expect(snapshot2.timestamp).toBeGreaterThan(snapshot1.timestamp);
    });

    it('should maintain resource usage history', async () => {
      // Arrange
      const initialHistory = performanceMonitor.getResourceUsageHistory();
      const initialCount = initialHistory.length;

      // Act - Force a snapshot
      performanceMonitor.getCurrentResourceUsage();
      await new Promise(resolve => setTimeout(resolve, 10));
      performanceMonitor.getCurrentResourceUsage();

      // Assert
      const updatedHistory = performanceMonitor.getResourceUsageHistory();
      expect(updatedHistory.length).toBeGreaterThanOrEqual(initialCount);
    });

    it('should limit resource usage history size', async () => {
      // Arrange
      const maxSnapshots = 50;

      // Act - Generate many snapshots
      for (let i = 0; i < maxSnapshots + 10; i++) {
        performanceMonitor.getCurrentResourceUsage();
      }

      // Assert
      const history = performanceMonitor.getResourceUsageHistory();
      expect(history.length).toBeLessThanOrEqual(maxSnapshots);
    });
  });

  describe('Performance Report Generation', () => {
    it('should generate comprehensive performance reports', async () => {
      // Arrange
      const startTime = Date.now();
      const operations = [
        { id: 'report-op1', operation: 'database_create', phase: SyncPhase.UPLOADING_CHANGES, records: 10 },
        { id: 'report-op2', operation: 'database_read', phase: SyncPhase.DOWNLOADING_UPDATES, records: 20 },
        { id: 'report-op3', operation: 'database_update', phase: SyncPhase.FINALIZING, records: 15 },
      ];

      // Act
      for (const op of operations) {
        performanceMonitor.startOperation(op.id, op.operation, op.phase);
        await new Promise(resolve => setTimeout(resolve, 20));
        performanceMonitor.endOperation(op.id, op.records, true);
      }

      const endTime = Date.now();
      const report = performanceMonitor.generatePerformanceReport(startTime, endTime);

      // Assert
      expect(report).toBeDefined();
      expect(report.reportId).toBeDefined();
      expect(report.startTime).toBe(startTime);
      expect(report.endTime).toBe(endTime);
      expect(report.totalOperations).toBe(3);
      expect(report.successfulOperations).toBe(3);
      expect(report.failedOperations).toBe(0);
      expect(report.averageDuration).toBeGreaterThan(0);
      expect(report.totalRecordsProcessed).toBe(45);
      expect(report.phaseMetrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should include phase-specific metrics in reports', async () => {
      // Arrange
      const startTime = Date.now();
      const uploadOp = { id: 'upload-op', operation: 'database_create', phase: SyncPhase.UPLOADING_CHANGES };
      const downloadOp = { id: 'download-op', operation: 'database_read', phase: SyncPhase.DOWNLOADING_UPDATES };

      // Act
      performanceMonitor.startOperation(uploadOp.id, uploadOp.operation, uploadOp.phase);
      await new Promise(resolve => setTimeout(resolve, 30));
      performanceMonitor.endOperation(uploadOp.id, 10, true);

      performanceMonitor.startOperation(downloadOp.id, downloadOp.operation, downloadOp.phase);
      await new Promise(resolve => setTimeout(resolve, 20));
      performanceMonitor.endOperation(downloadOp.id, 15, true);

      const endTime = Date.now();
      const report = performanceMonitor.generatePerformanceReport(startTime, endTime);

      // Assert
      expect(report.phaseMetrics[SyncPhase.UPLOADING_CHANGES]).toBeDefined();
      expect(report.phaseMetrics[SyncPhase.DOWNLOADING_UPDATES]).toBeDefined();
      expect(report.phaseMetrics[SyncPhase.UPLOADING_CHANGES].operationCount).toBe(1);
      expect(report.phaseMetrics[SyncPhase.DOWNLOADING_UPDATES].operationCount).toBe(1);
    });

    it('should identify bottlenecks in performance reports', async () => {
      // Arrange
      const startTime = Date.now();
      
      // Create operations with failures to trigger bottleneck detection
      const failingOps = Array.from({ length: 5 }, (_, i) => ({
        id: `failing-op-${i}`,
        operation: 'database_create',
        phase: SyncPhase.UPLOADING_CHANGES,
      }));

      // Act
      for (const op of failingOps) {
        performanceMonitor.startOperation(op.id, op.operation, op.phase);
        await new Promise(resolve => setTimeout(resolve, 10));
        performanceMonitor.endOperation(op.id, 1, false, 1); // Mark as failed
      }

      const endTime = Date.now();
      const report = performanceMonitor.generatePerformanceReport(startTime, endTime);

      // Assert
      expect(report.failedOperations).toBe(5);
      expect(report.bottlenecks.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Metrics Retrieval', () => {
    it('should retrieve metrics by operation type', async () => {
      // Arrange
      const operations = [
        { id: 'create-op1', operation: 'database_create', phase: SyncPhase.UPLOADING_CHANGES },
        { id: 'create-op2', operation: 'database_create', phase: SyncPhase.UPLOADING_CHANGES },
        { id: 'read-op1', operation: 'database_read', phase: SyncPhase.DOWNLOADING_UPDATES },
      ];

      // Act
      for (const op of operations) {
        performanceMonitor.startOperation(op.id, op.operation, op.phase);
        await new Promise(resolve => setTimeout(resolve, 10));
        performanceMonitor.endOperation(op.id, 5, true);
      }

      const createMetrics = performanceMonitor.getMetricsByOperation('database_create');
      const readMetrics = performanceMonitor.getMetricsByOperation('database_read');

      // Assert
      expect(createMetrics).toHaveLength(2);
      expect(readMetrics).toHaveLength(1);
      expect(createMetrics[0].operation).toBe('database_create');
      expect(readMetrics[0].operation).toBe('database_read');
    });

    it('should retrieve metrics by sync phase', async () => {
      // Arrange
      const operations = [
        { id: 'upload-op1', operation: 'database_create', phase: SyncPhase.UPLOADING_CHANGES },
        { id: 'upload-op2', operation: 'database_update', phase: SyncPhase.UPLOADING_CHANGES },
        { id: 'download-op1', operation: 'database_read', phase: SyncPhase.DOWNLOADING_UPDATES },
      ];

      // Act
      for (const op of operations) {
        performanceMonitor.startOperation(op.id, op.operation, op.phase);
        await new Promise(resolve => setTimeout(resolve, 10));
        performanceMonitor.endOperation(op.id, 5, true);
      }

      const uploadMetrics = performanceMonitor.getMetricsByPhase(SyncPhase.UPLOADING_CHANGES);
      const downloadMetrics = performanceMonitor.getMetricsByPhase(SyncPhase.DOWNLOADING_UPDATES);

      // Assert
      expect(uploadMetrics).toHaveLength(2);
      expect(downloadMetrics).toHaveLength(1);
      expect(uploadMetrics[0].phase).toBe(SyncPhase.UPLOADING_CHANGES);
      expect(downloadMetrics[0].phase).toBe(SyncPhase.DOWNLOADING_UPDATES);
    });

    it('should retrieve all metrics sorted by recency', async () => {
      // Arrange
      const operations = [
        { id: 'first-op', operation: 'database_create', phase: SyncPhase.UPLOADING_CHANGES },
        { id: 'second-op', operation: 'database_read', phase: SyncPhase.DOWNLOADING_UPDATES },
        { id: 'third-op', operation: 'database_update', phase: SyncPhase.FINALIZING },
      ];

      // Act
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        performanceMonitor.startOperation(op.id, op.operation, op.phase);
        await new Promise(resolve => setTimeout(resolve, 10));
        performanceMonitor.endOperation(op.id, 5, true);
        
        // Add delay between operations to ensure different timestamps
        if (i < operations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      }

      const allMetrics = performanceMonitor.getAllMetrics();

      // Assert
      expect(allMetrics).toHaveLength(3);
      // Should be sorted by recency (most recent first)
      expect(allMetrics[0].id).toBe('third-op');
      expect(allMetrics[1].id).toBe('second-op');
      expect(allMetrics[2].id).toBe('first-op');
    });
  });

  describe('Performance Summary', () => {
    it('should generate performance summary', async () => {
      // Arrange
      const operations = [
        { id: 'summary-op1', operation: 'database_create', phase: SyncPhase.UPLOADING_CHANGES, success: true },
        { id: 'summary-op2', operation: 'database_read', phase: SyncPhase.DOWNLOADING_UPDATES, success: true },
        { id: 'summary-op3', operation: 'database_update', phase: SyncPhase.FINALIZING, success: false },
      ];

      // Act
      for (const op of operations) {
        performanceMonitor.startOperation(op.id, op.operation, op.phase);
        await new Promise(resolve => setTimeout(resolve, 10));
        performanceMonitor.endOperation(op.id, 5, op.success);
      }

      const summary = performanceMonitor.getPerformanceSummary();

      // Assert
      expect(summary).toBeDefined();
      expect(summary.totalOperations).toBe(3);
      expect(summary.avgDuration).toBeGreaterThan(0);
      expect(summary.avgThroughput).toBeGreaterThan(0);
      expect(summary.errorRate).toBeCloseTo(1/3); // 1 failed out of 3
      expect(summary.activeOperations).toBe(0);
      expect(summary.topBottlenecks).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should allow updating performance thresholds', () => {
      // Arrange
      const operation = 'custom_operation';
      const threshold = {
        operation,
        maxDuration: 200,
        minThroughput: 50,
        maxMemoryUsage: 100,
        maxCpuUsage: 80,
      };

      // Act
      performanceMonitor.setPerformanceThreshold(threshold);
      const retrieved = performanceMonitor.getPerformanceThreshold(operation);

      // Assert
      expect(retrieved).toEqual(threshold);
    });

    it('should allow enabling/disabling monitoring', async () => {
      // Arrange
      const operationId = 'disabled-monitoring-test';
      const operation = 'database_create';
      const phase = SyncPhase.UPLOADING_CHANGES;

      // Act
      performanceMonitor.setMonitoringEnabled(false);
      performanceMonitor.startOperation(operationId, operation, phase);
      await new Promise(resolve => setTimeout(resolve, 10));
      const metric = performanceMonitor.endOperation(operationId, 5, true);

      // Assert
      expect(metric).toBeNull();

      // Re-enable monitoring
      performanceMonitor.setMonitoringEnabled(true);
      performanceMonitor.startOperation(`${operationId}-2`, operation, phase);
      await new Promise(resolve => setTimeout(resolve, 10));
      const metric2 = performanceMonitor.endOperation(`${operationId}-2`, 5, true);

      expect(metric2).toBeDefined();
    });
  });

  describe('Data Management', () => {
    it('should clear all performance data', async () => {
      // Arrange
      const operationId = 'clear-test';
      const operation = 'database_create';
      const phase = SyncPhase.UPLOADING_CHANGES;

      performanceMonitor.startOperation(operationId, operation, phase);
      await new Promise(resolve => setTimeout(resolve, 10));
      performanceMonitor.endOperation(operationId, 5, true);

      // Verify data exists
      expect(performanceMonitor.getAllMetrics()).toHaveLength(1);

      // Act
      performanceMonitor.clearAllData();

      // Assert
      expect(performanceMonitor.getAllMetrics()).toHaveLength(0);
      expect(performanceMonitor.getRecentAlerts()).toHaveLength(0);
    });

    it('should handle memory cleanup for large datasets', async () => {
      // Arrange
      const maxHistorySize = 1000;
      const operationsToCreate = maxHistorySize + 100;

      // Act - Create more operations than the history limit
      for (let i = 0; i < operationsToCreate; i++) {
        const operationId = `cleanup-op-${i}`;
        performanceMonitor.startOperation(operationId, 'database_create', SyncPhase.UPLOADING_CHANGES);
        performanceMonitor.endOperation(operationId, 1, true);
      }

      // Assert
      const allMetrics = performanceMonitor.getAllMetrics();
      expect(allMetrics.length).toBeLessThanOrEqual(maxHistorySize);
    });
  });
});