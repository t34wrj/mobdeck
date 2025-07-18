/**
 * Database Sync Performance Monitor
 * 
 * Comprehensive performance monitoring for database sync operations including:
 * - Real-time performance metrics collection
 * - Throughput monitoring
 * - Resource usage tracking
 * - Performance bottleneck detection
 * - Historical performance analysis
 */

import { logger, LogCategory } from '../utils/logger';
import { SyncPhase } from '../types/sync';

export interface PerformanceMetric {
  id: string;
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  recordCount: number;
  phase: SyncPhase;
  success: boolean;
  throughput: number; // records per second
  memoryUsage?: number; // MB
  cpuUsage?: number; // percentage
  errorCount: number;
  warningCount: number;
  metadata?: Record<string, any>;
}

export interface PerformanceThreshold {
  operation: string;
  maxDuration: number; // milliseconds
  minThroughput: number; // records per second
  maxMemoryUsage: number; // MB
  maxCpuUsage: number; // percentage
}

export interface PerformanceAlert {
  id: string;
  type: 'threshold_exceeded' | 'performance_degradation' | 'resource_exhaustion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  operation: string;
  metric: string;
  actualValue: number;
  thresholdValue: number;
  timestamp: number;
  recommendation: string;
}

export interface PerformanceReport {
  reportId: string;
  startTime: number;
  endTime: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageDuration: number;
  averageThroughput: number;
  totalRecordsProcessed: number;
  peakMemoryUsage: number;
  peakCpuUsage: number;
  bottlenecks: string[];
  recommendations: string[];
  alerts: PerformanceAlert[];
  phaseMetrics: Record<SyncPhase, {
    operationCount: number;
    totalDuration: number;
    averageDuration: number;
    throughput: number;
    errorRate: number;
  }>;
}

export interface ResourceUsageSnapshot {
  timestamp: number;
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  diskUsage: number; // MB
  networkUsage: number; // KB/s
  databaseConnections: number;
  activeOperations: number;
}

/**
 * Database Sync Performance Monitor Service
 */
export class DatabaseSyncPerformanceMonitor {
  private static instance: DatabaseSyncPerformanceMonitor;
  private metrics: Map<string, PerformanceMetric> = new Map();
  private activeOperations: Map<string, { startTime: number; metadata: any }> = new Map();
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private alerts: PerformanceAlert[] = [];
  private resourceSnapshots: ResourceUsageSnapshot[] = [];
  private maxHistorySize: number = 1000;
  private monitoringEnabled: boolean = true;

  private constructor() {
    this.initializeDefaultThresholds();
    this.startResourceMonitoring();
  }

  public static getInstance(): DatabaseSyncPerformanceMonitor {
    if (!DatabaseSyncPerformanceMonitor.instance) {
      DatabaseSyncPerformanceMonitor.instance = new DatabaseSyncPerformanceMonitor();
    }
    return DatabaseSyncPerformanceMonitor.instance;
  }

  /**
   * Initialize default performance thresholds
   */
  private initializeDefaultThresholds(): void {
    const defaultThresholds: PerformanceThreshold[] = [
      {
        operation: 'database_create',
        maxDuration: 100, // 100ms
        minThroughput: 10, // 10 records/second
        maxMemoryUsage: 50, // 50MB
        maxCpuUsage: 80, // 80%
      },
      {
        operation: 'database_read',
        maxDuration: 50, // 50ms
        minThroughput: 20, // 20 records/second
        maxMemoryUsage: 30, // 30MB
        maxCpuUsage: 60, // 60%
      },
      {
        operation: 'database_update',
        maxDuration: 75, // 75ms
        minThroughput: 15, // 15 records/second
        maxMemoryUsage: 40, // 40MB
        maxCpuUsage: 70, // 70%
      },
      {
        operation: 'database_delete',
        maxDuration: 30, // 30ms
        minThroughput: 25, // 25 records/second
        maxMemoryUsage: 20, // 20MB
        maxCpuUsage: 50, // 50%
      },
      {
        operation: 'batch_create',
        maxDuration: 500, // 500ms
        minThroughput: 50, // 50 records/second
        maxMemoryUsage: 100, // 100MB
        maxCpuUsage: 90, // 90%
      },
      {
        operation: 'batch_update',
        maxDuration: 300, // 300ms
        minThroughput: 30, // 30 records/second
        maxMemoryUsage: 80, // 80MB
        maxCpuUsage: 85, // 85%
      },
      {
        operation: 'sync_operation',
        maxDuration: 10000, // 10 seconds
        minThroughput: 20, // 20 records/second
        maxMemoryUsage: 150, // 150MB
        maxCpuUsage: 95, // 95%
      },
      {
        operation: 'consistency_check',
        maxDuration: 2000, // 2 seconds
        minThroughput: 10, // 10 records/second
        maxMemoryUsage: 60, // 60MB
        maxCpuUsage: 70, // 70%
      },
    ];

    defaultThresholds.forEach(threshold => {
      this.thresholds.set(threshold.operation, threshold);
    });
  }

  /**
   * Start monitoring a database operation
   */
  public startOperation(
    operationId: string,
    operation: string,
    phase: SyncPhase,
    metadata?: Record<string, any>
  ): void {
    if (!this.monitoringEnabled) return;

    const startTime = performance.now();
    
    this.activeOperations.set(operationId, {
      startTime,
      metadata: {
        operation,
        phase,
        ...metadata,
      },
    });

    logger.debug('Started performance monitoring for operation', {
      operationId,
      operation,
      phase,
      startTime,
    }, LogCategory.SYNC);
  }

  /**
   * End monitoring a database operation
   */
  public endOperation(
    operationId: string,
    recordCount: number = 0,
    success: boolean = true,
    errorCount: number = 0,
    warningCount: number = 0
  ): PerformanceMetric | null {
    if (!this.monitoringEnabled) return null;

    const activeOperation = this.activeOperations.get(operationId);
    if (!activeOperation) {
      logger.warn('Attempted to end unknown operation', {
        operationId,
      }, LogCategory.SYNC);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - activeOperation.startTime;
    const throughput = recordCount > 0 ? (recordCount / duration) * 1000 : 0;

    const metric: PerformanceMetric = {
      id: operationId,
      operation: activeOperation.metadata.operation,
      startTime: activeOperation.startTime,
      endTime,
      duration,
      recordCount,
      phase: activeOperation.metadata.phase,
      success,
      throughput,
      memoryUsage: this.getCurrentMemoryUsage(),
      cpuUsage: this.getCurrentCpuUsage(),
      errorCount,
      warningCount,
      metadata: activeOperation.metadata,
    };

    // Store the metric
    this.metrics.set(operationId, metric);

    // Clean up active operation
    this.activeOperations.delete(operationId);

    // Check performance thresholds
    this.checkPerformanceThresholds(metric);

    // Clean up old metrics if needed
    this.cleanupOldMetrics();

    logger.debug('Ended performance monitoring for operation', {
      operationId,
      duration,
      throughput,
      success,
      recordCount,
    }, LogCategory.SYNC);

    return metric;
  }

  /**
   * Get current memory usage (mock implementation)
   */
  private getCurrentMemoryUsage(): number {
    // In a real implementation, this would get actual memory usage
    // For now, return a simulated value
    return Math.random() * 100; // 0-100 MB
  }

  /**
   * Get current CPU usage (mock implementation)
   */
  private getCurrentCpuUsage(): number {
    // In a real implementation, this would get actual CPU usage
    // For now, return a simulated value
    return Math.random() * 100; // 0-100%
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.operation);
    if (!threshold) return;

    const alerts: PerformanceAlert[] = [];

    // Check duration threshold
    if (metric.duration > threshold.maxDuration) {
      alerts.push({
        id: `${metric.id}_duration`,
        type: 'threshold_exceeded',
        severity: this.calculateSeverity(metric.duration, threshold.maxDuration),
        operation: metric.operation,
        metric: 'duration',
        actualValue: metric.duration,
        thresholdValue: threshold.maxDuration,
        timestamp: Date.now(),
        recommendation: `Operation took ${metric.duration.toFixed(2)}ms, exceeding threshold of ${threshold.maxDuration}ms. Consider optimizing queries or reducing batch size.`,
      });
    }

    // Check throughput threshold
    if (metric.recordCount > 0 && metric.throughput < threshold.minThroughput) {
      alerts.push({
        id: `${metric.id}_throughput`,
        type: 'performance_degradation',
        severity: this.calculateSeverity(threshold.minThroughput, metric.throughput),
        operation: metric.operation,
        metric: 'throughput',
        actualValue: metric.throughput,
        thresholdValue: threshold.minThroughput,
        timestamp: Date.now(),
        recommendation: `Throughput of ${metric.throughput.toFixed(2)} records/second is below threshold of ${threshold.minThroughput}. Consider indexing or query optimization.`,
      });
    }

    // Check memory usage threshold
    if (metric.memoryUsage && metric.memoryUsage > threshold.maxMemoryUsage) {
      alerts.push({
        id: `${metric.id}_memory`,
        type: 'resource_exhaustion',
        severity: this.calculateSeverity(metric.memoryUsage, threshold.maxMemoryUsage),
        operation: metric.operation,
        metric: 'memory',
        actualValue: metric.memoryUsage,
        thresholdValue: threshold.maxMemoryUsage,
        timestamp: Date.now(),
        recommendation: `Memory usage of ${metric.memoryUsage.toFixed(2)}MB exceeds threshold of ${threshold.maxMemoryUsage}MB. Consider reducing batch size or optimizing data structures.`,
      });
    }

    // Check CPU usage threshold
    if (metric.cpuUsage && metric.cpuUsage > threshold.maxCpuUsage) {
      alerts.push({
        id: `${metric.id}_cpu`,
        type: 'resource_exhaustion',
        severity: this.calculateSeverity(metric.cpuUsage, threshold.maxCpuUsage),
        operation: metric.operation,
        metric: 'cpu',
        actualValue: metric.cpuUsage,
        thresholdValue: threshold.maxCpuUsage,
        timestamp: Date.now(),
        recommendation: `CPU usage of ${metric.cpuUsage.toFixed(2)}% exceeds threshold of ${threshold.maxCpuUsage}%. Consider reducing concurrency or optimizing algorithms.`,
      });
    }

    // Store alerts
    this.alerts.push(...alerts);

    // Log alerts
    alerts.forEach(alert => {
      logger.warn('Performance threshold exceeded', {
        alertId: alert.id,
        operation: alert.operation,
        metric: alert.metric,
        actualValue: alert.actualValue,
        thresholdValue: alert.thresholdValue,
        severity: alert.severity,
        recommendation: alert.recommendation,
      }, LogCategory.SYNC);
    });
  }

  /**
   * Calculate alert severity based on how much a value exceeds threshold
   */
  private calculateSeverity(actualValue: number, thresholdValue: number): PerformanceAlert['severity'] {
    const ratio = actualValue / thresholdValue;
    
    if (ratio >= 3) return 'critical';
    if (ratio >= 2) return 'high';
    if (ratio >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    if (!this.monitoringEnabled) return;

    // Take a snapshot every 30 seconds
    setInterval(() => {
      this.takeResourceSnapshot();
    }, 30000);

    // Take initial snapshot
    this.takeResourceSnapshot();
  }

  /**
   * Take a resource usage snapshot
   */
  private takeResourceSnapshot(): void {
    const snapshot: ResourceUsageSnapshot = {
      timestamp: Date.now(),
      memoryUsage: this.getCurrentMemoryUsage(),
      cpuUsage: this.getCurrentCpuUsage(),
      diskUsage: Math.random() * 500, // Mock disk usage
      networkUsage: Math.random() * 1000, // Mock network usage
      databaseConnections: 1, // Mock database connections
      activeOperations: this.activeOperations.size,
    };

    this.resourceSnapshots.push(snapshot);

    // Keep only recent snapshots (last 100)
    if (this.resourceSnapshots.length > 100) {
      this.resourceSnapshots = this.resourceSnapshots.slice(-100);
    }
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    if (this.metrics.size <= this.maxHistorySize) return;

    // Sort by start time and keep only recent metrics
    const sortedMetrics = Array.from(this.metrics.entries())
      .sort(([, a], [, b]) => b.startTime - a.startTime);

    // Keep only the most recent metrics
    const metricsToKeep = sortedMetrics.slice(0, this.maxHistorySize);
    
    this.metrics.clear();
    metricsToKeep.forEach(([id, metric]) => {
      this.metrics.set(id, metric);
    });

    // Also clean up old alerts
    if (this.alerts.length > this.maxHistorySize) {
      this.alerts = this.alerts.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get performance metrics for a specific operation type
   */
  public getMetricsByOperation(operation: string): PerformanceMetric[] {
    return Array.from(this.metrics.values())
      .filter(metric => metric.operation === operation)
      .sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Get performance metrics for a specific phase
   */
  public getMetricsByPhase(phase: SyncPhase): PerformanceMetric[] {
    return Array.from(this.metrics.values())
      .filter(metric => metric.phase === phase)
      .sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Get all performance metrics
   */
  public getAllMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Get recent performance alerts
   */
  public getRecentAlerts(limit: number = 10): PerformanceAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get performance report for a time range
   */
  public generatePerformanceReport(
    startTime: number,
    endTime: number
  ): PerformanceReport {
    const relevantMetrics = Array.from(this.metrics.values())
      .filter(metric => metric.startTime >= startTime && metric.endTime <= endTime);

    const relevantAlerts = this.alerts
      .filter(alert => alert.timestamp >= startTime && alert.timestamp <= endTime);

    const totalOperations = relevantMetrics.length;
    const successfulOperations = relevantMetrics.filter(m => m.success).length;
    const failedOperations = totalOperations - successfulOperations;

    const totalDuration = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalOperations > 0 ? totalDuration / totalOperations : 0;

    const totalRecords = relevantMetrics.reduce((sum, m) => sum + m.recordCount, 0);
    const averageThroughput = totalDuration > 0 ? (totalRecords / totalDuration) * 1000 : 0;

    const peakMemoryUsage = Math.max(...relevantMetrics.map(m => m.memoryUsage || 0));
    const peakCpuUsage = Math.max(...relevantMetrics.map(m => m.cpuUsage || 0));

    // Calculate phase metrics
    const phaseMetrics: Record<SyncPhase, any> = {} as any;
    Object.values(SyncPhase).forEach(phase => {
      const phaseMetricsList = relevantMetrics.filter(m => m.phase === phase);
      const phaseTotal = phaseMetricsList.reduce((sum, m) => sum + m.duration, 0);
      const phaseErrors = phaseMetricsList.reduce((sum, m) => sum + m.errorCount, 0);
      const phaseRecords = phaseMetricsList.reduce((sum, m) => sum + m.recordCount, 0);

      phaseMetrics[phase] = {
        operationCount: phaseMetricsList.length,
        totalDuration: phaseTotal,
        averageDuration: phaseMetricsList.length > 0 ? phaseTotal / phaseMetricsList.length : 0,
        throughput: phaseTotal > 0 ? (phaseRecords / phaseTotal) * 1000 : 0,
        errorRate: phaseMetricsList.length > 0 ? phaseErrors / phaseMetricsList.length : 0,
      };
    });

    // Identify bottlenecks
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    if (failedOperations > totalOperations * 0.1) {
      bottlenecks.push('High error rate detected');
      recommendations.push('Investigate and fix recurring errors');
    }

    if (averageDuration > 1000) {
      bottlenecks.push('Slow average operation duration');
      recommendations.push('Optimize database queries and indexing');
    }

    if (averageThroughput < 10) {
      bottlenecks.push('Low throughput detected');
      recommendations.push('Consider batch processing and parallel operations');
    }

    if (peakMemoryUsage > 200) {
      bottlenecks.push('High memory usage detected');
      recommendations.push('Reduce batch sizes and optimize data structures');
    }

    return {
      reportId: `report_${Date.now()}`,
      startTime,
      endTime,
      totalOperations,
      successfulOperations,
      failedOperations,
      averageDuration,
      averageThroughput,
      totalRecordsProcessed: totalRecords,
      peakMemoryUsage,
      peakCpuUsage,
      bottlenecks,
      recommendations,
      alerts: relevantAlerts,
      phaseMetrics,
    };
  }

  /**
   * Get current resource usage
   */
  public getCurrentResourceUsage(): ResourceUsageSnapshot {
    return {
      timestamp: Date.now(),
      memoryUsage: this.getCurrentMemoryUsage(),
      cpuUsage: this.getCurrentCpuUsage(),
      diskUsage: Math.random() * 500,
      networkUsage: Math.random() * 1000,
      databaseConnections: 1,
      activeOperations: this.activeOperations.size,
    };
  }

  /**
   * Get resource usage history
   */
  public getResourceUsageHistory(limit: number = 50): ResourceUsageSnapshot[] {
    return this.resourceSnapshots
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Set performance threshold for an operation
   */
  public setPerformanceThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.set(threshold.operation, threshold);
    
    logger.info('Performance threshold updated', {
      operation: threshold.operation,
      maxDuration: threshold.maxDuration,
      minThroughput: threshold.minThroughput,
      maxMemoryUsage: threshold.maxMemoryUsage,
      maxCpuUsage: threshold.maxCpuUsage,
    }, LogCategory.SYNC);
  }

  /**
   * Get performance threshold for an operation
   */
  public getPerformanceThreshold(operation: string): PerformanceThreshold | undefined {
    return this.thresholds.get(operation);
  }

  /**
   * Enable or disable performance monitoring
   */
  public setMonitoringEnabled(enabled: boolean): void {
    this.monitoringEnabled = enabled;
    
    logger.info('Performance monitoring toggled', {
      enabled,
    }, LogCategory.SYNC);
  }

  /**
   * Clear all performance data
   */
  public clearAllData(): void {
    this.metrics.clear();
    this.activeOperations.clear();
    this.alerts.splice(0, this.alerts.length);
    this.resourceSnapshots.splice(0, this.resourceSnapshots.length);
    
    logger.info('Performance monitoring data cleared', {}, LogCategory.SYNC);
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    totalOperations: number;
    avgDuration: number;
    avgThroughput: number;
    errorRate: number;
    activeOperations: number;
    recentAlerts: number;
    topBottlenecks: string[];
  } {
    const allMetrics = this.getAllMetrics();
    const totalOperations = allMetrics.length;
    const avgDuration = totalOperations > 0 
      ? allMetrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations 
      : 0;
    const avgThroughput = totalOperations > 0
      ? allMetrics.reduce((sum, m) => sum + m.throughput, 0) / totalOperations
      : 0;
    const errorRate = totalOperations > 0
      ? allMetrics.filter(m => !m.success).length / totalOperations
      : 0;
    const recentAlerts = this.alerts.filter(a => a.timestamp > Date.now() - 3600000).length; // Last hour

    // Get top bottlenecks
    const operationCounts = new Map<string, number>();
    allMetrics.forEach(metric => {
      if (!metric.success) {
        operationCounts.set(metric.operation, (operationCounts.get(metric.operation) || 0) + 1);
      }
    });

    const topBottlenecks = Array.from(operationCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([operation]) => operation);

    return {
      totalOperations,
      avgDuration,
      avgThroughput,
      errorRate,
      activeOperations: this.activeOperations.size,
      recentAlerts,
      topBottlenecks,
    };
  }
}

// Export singleton instance
export const databaseSyncPerformanceMonitor = DatabaseSyncPerformanceMonitor.getInstance();

// Export utility functions
export const startPerformanceMonitoring = (
  operationId: string,
  operation: string,
  phase: SyncPhase,
  metadata?: Record<string, any>
) => databaseSyncPerformanceMonitor.startOperation(operationId, operation, phase, metadata);

export const endPerformanceMonitoring = (
  operationId: string,
  recordCount?: number,
  success?: boolean,
  errorCount?: number,
  warningCount?: number
) => databaseSyncPerformanceMonitor.endOperation(operationId, recordCount, success, errorCount, warningCount);

export const getPerformanceReport = (startTime: number, endTime: number) => 
  databaseSyncPerformanceMonitor.generatePerformanceReport(startTime, endTime);

export const getPerformanceSummary = () => databaseSyncPerformanceMonitor.getPerformanceSummary();