/**
 * SyncMonitoringService - Comprehensive sync monitoring and analytics
 * Provides detailed metrics and monitoring for sync operations
 */

import { logger, LogCategory } from '../utils/logger';
import { SyncPhase, SyncStatus, NetworkType } from '../types/sync';

export interface SyncOperationMetrics {
  syncId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  phase: SyncPhase;
  status: SyncStatus;
  itemsProcessed: number;
  itemsSuccessful: number;
  itemsFailed: number;
  conflictsDetected: number;
  conflictsResolved: number;
  networkType: NetworkType;
  batchSize: number;
  errorMessages: string[];
  performanceMarkers: Record<string, number>;
}

export interface SyncHealthMetrics {
  successRate: number;
  averageDuration: number;
  averageItemsPerSync: number;
  errorRate: number;
  conflictRate: number;
  networkDistribution: Record<NetworkType, number>;
  phasePerformance: Record<SyncPhase, { count: number; averageDuration: number }>;
  recentErrors: Array<{ timestamp: string; error: string; phase: SyncPhase }>;
}

export interface SyncAlertCondition {
  type: 'error_rate' | 'sync_duration' | 'conflict_rate' | 'failure_rate';
  threshold: number;
  timeWindow: number; // minutes
  description: string;
}

export interface SyncAlert {
  id: string;
  condition: SyncAlertCondition;
  triggeredAt: string;
  value: number;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class SyncMonitoringService {
  private static instance: SyncMonitoringService;
  private syncOperations: Map<string, SyncOperationMetrics> = new Map();
  private alertConditions: SyncAlertCondition[] = [];
  private activeAlerts: SyncAlert[] = [];
  private maxOperationHistory = 100;
  private monitoringEnabled = true;

  private constructor() {
    this.setupDefaultAlertConditions();
  }

  public static getInstance(): SyncMonitoringService {
    if (!SyncMonitoringService.instance) {
      SyncMonitoringService.instance = new SyncMonitoringService();
    }
    return SyncMonitoringService.instance;
  }

  private setupDefaultAlertConditions(): void {
    this.alertConditions = [
      {
        type: 'error_rate',
        threshold: 0.25, // 25% error rate
        timeWindow: 60, // 1 hour
        description: 'High error rate detected in sync operations'
      },
      {
        type: 'sync_duration',
        threshold: 300000, // 5 minutes
        timeWindow: 30, // 30 minutes
        description: 'Sync operations taking too long'
      },
      {
        type: 'conflict_rate',
        threshold: 0.15, // 15% conflict rate
        timeWindow: 60, // 1 hour
        description: 'High conflict rate detected'
      },
      {
        type: 'failure_rate',
        threshold: 0.20, // 20% failure rate
        timeWindow: 60, // 1 hour
        description: 'High failure rate detected'
      }
    ];
  }

  enableMonitoring(): void {
    this.monitoringEnabled = true;
    logger.info('Sync monitoring enabled', undefined, LogCategory.SYNC);
  }

  disableMonitoring(): void {
    this.monitoringEnabled = false;
    logger.info('Sync monitoring disabled', undefined, LogCategory.SYNC);
  }

  startSyncOperation(
    syncId: string,
    phase: SyncPhase,
    networkType: NetworkType,
    batchSize: number = 25
  ): void {
    if (!this.monitoringEnabled) return;

    const operation: SyncOperationMetrics = {
      syncId,
      startTime: new Date().toISOString(),
      phase,
      status: SyncStatus.SYNCING,
      itemsProcessed: 0,
      itemsSuccessful: 0,
      itemsFailed: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      networkType,
      batchSize,
      errorMessages: [],
      performanceMarkers: {}
    };

    this.syncOperations.set(syncId, operation);
    
    logger.syncLog(
      syncId,
      phase,
      'sync_start',
      `Sync operation started`,
      {
        networkType,
        batchSize
      }
    );

    this.trimOperationHistory();
  }

  updateSyncProgress(
    syncId: string,
    phase: SyncPhase,
    itemsProcessed: number,
    itemsSuccessful: number,
    itemsFailed: number,
    conflictsDetected: number = 0
  ): void {
    if (!this.monitoringEnabled) return;

    const operation = this.syncOperations.get(syncId);
    if (!operation) return;

    operation.phase = phase;
    operation.itemsProcessed = itemsProcessed;
    operation.itemsSuccessful = itemsSuccessful;
    operation.itemsFailed = itemsFailed;
    operation.conflictsDetected = conflictsDetected;

    logger.syncLog(
      syncId,
      phase,
      'sync_progress',
      `Sync progress updated`,
      {
        itemCount: itemsProcessed,
        errorCount: itemsFailed,
        networkType: operation.networkType
      }
    );
  }

  addPerformanceMarker(syncId: string, marker: string, duration: number): void {
    if (!this.monitoringEnabled) return;

    const operation = this.syncOperations.get(syncId);
    if (!operation) return;

    operation.performanceMarkers[marker] = duration;

    logger.syncLog(
      syncId,
      operation.phase,
      'performance_marker',
      `Performance marker: ${marker}`,
      {
        duration,
        networkType: operation.networkType
      }
    );
  }

  recordSyncError(syncId: string, phase: SyncPhase, error: string): void {
    if (!this.monitoringEnabled) return;

    const operation = this.syncOperations.get(syncId);
    if (!operation) return;

    operation.errorMessages.push(error);
    operation.phase = phase;

    logger.syncError(
      syncId,
      phase,
      'sync_error',
      `Sync error recorded`,
      error,
      {
        networkType: operation.networkType,
        errorCount: operation.errorMessages.length
      }
    );
  }

  completeSyncOperation(
    syncId: string,
    status: SyncStatus,
    conflictsResolved: number = 0
  ): void {
    if (!this.monitoringEnabled) return;

    const operation = this.syncOperations.get(syncId);
    if (!operation) return;

    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(operation.startTime).getTime();

    operation.endTime = endTime;
    operation.duration = duration;
    operation.status = status;
    operation.conflictsResolved = conflictsResolved;

    logger.syncLog(
      syncId,
      operation.phase,
      'sync_complete',
      `Sync operation completed`,
      {
        duration,
        itemCount: operation.itemsProcessed,
        errorCount: operation.itemsFailed,
        networkType: operation.networkType
      }
    );

    // Check for alert conditions
    this.checkAlertConditions();
  }

  getSyncOperationMetrics(syncId: string): SyncOperationMetrics | undefined {
    return this.syncOperations.get(syncId);
  }

  getAllSyncOperations(limit?: number): SyncOperationMetrics[] {
    const operations = Array.from(this.syncOperations.values());
    const sorted = operations.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getSyncHealthMetrics(timeWindow: number = 60): SyncHealthMetrics {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    const recentOperations = this.getAllSyncOperations()
      .filter(op => op.endTime && new Date(op.startTime) >= cutoff);

    if (recentOperations.length === 0) {
      return {
        successRate: 0,
        averageDuration: 0,
        averageItemsPerSync: 0,
        errorRate: 0,
        conflictRate: 0,
        networkDistribution: {},
        phasePerformance: {},
        recentErrors: []
      };
    }

    const totalOperations = recentOperations.length;
    const successfulOperations = recentOperations.filter(op => op.status === SyncStatus.SUCCESS).length;
    const totalDuration = recentOperations.reduce((sum, op) => sum + (op.duration || 0), 0);
    const totalItems = recentOperations.reduce((sum, op) => sum + op.itemsProcessed, 0);
    const totalErrors = recentOperations.reduce((sum, op) => sum + op.itemsFailed, 0);
    const totalConflicts = recentOperations.reduce((sum, op) => sum + op.conflictsDetected, 0);

    // Network distribution
    const networkDistribution: Record<NetworkType, number> = {};
    recentOperations.forEach(op => {
      networkDistribution[op.networkType] = (networkDistribution[op.networkType] || 0) + 1;
    });

    // Phase performance
    const phasePerformance: Record<SyncPhase, { count: number; averageDuration: number }> = {};
    recentOperations.forEach(op => {
      if (!phasePerformance[op.phase]) {
        phasePerformance[op.phase] = { count: 0, averageDuration: 0 };
      }
      phasePerformance[op.phase].count++;
      phasePerformance[op.phase].averageDuration += (op.duration || 0);
    });

    // Calculate averages for phases
    Object.keys(phasePerformance).forEach(phase => {
      const phaseData = phasePerformance[phase as SyncPhase];
      phaseData.averageDuration = phaseData.averageDuration / phaseData.count;
    });

    // Recent errors
    const recentErrors = recentOperations
      .filter(op => op.errorMessages.length > 0)
      .flatMap(op => op.errorMessages.map(error => ({
        timestamp: op.startTime,
        error,
        phase: op.phase
      })))
      .slice(0, 10);

    return {
      successRate: successfulOperations / totalOperations,
      averageDuration: totalDuration / totalOperations,
      averageItemsPerSync: totalItems / totalOperations,
      errorRate: totalErrors / Math.max(totalItems, 1),
      conflictRate: totalConflicts / Math.max(totalItems, 1),
      networkDistribution,
      phasePerformance,
      recentErrors
    };
  }

  private checkAlertConditions(): void {
    const now = new Date();
    
    this.alertConditions.forEach(condition => {
      const cutoff = new Date(now.getTime() - condition.timeWindow * 60 * 1000);
      const recentOperations = this.getAllSyncOperations()
        .filter(op => op.endTime && new Date(op.startTime) >= cutoff);

      if (recentOperations.length === 0) return;

      let alertTriggered = false;
      let currentValue = 0;

      switch (condition.type) {
        case 'error_rate': {
          const totalItems = recentOperations.reduce((sum, op) => sum + op.itemsProcessed, 0);
          const totalErrors = recentOperations.reduce((sum, op) => sum + op.itemsFailed, 0);
          currentValue = totalItems > 0 ? totalErrors / totalItems : 0;
          alertTriggered = currentValue > condition.threshold;
          break;
        }

        case 'sync_duration': {
          const avgDuration = recentOperations.reduce((sum, op) => sum + (op.duration || 0), 0) / recentOperations.length;
          currentValue = avgDuration;
          alertTriggered = avgDuration > condition.threshold;
          break;
        }

        case 'conflict_rate': {
          const totalItemsConflict = recentOperations.reduce((sum, op) => sum + op.itemsProcessed, 0);
          const totalConflicts = recentOperations.reduce((sum, op) => sum + op.conflictsDetected, 0);
          currentValue = totalItemsConflict > 0 ? totalConflicts / totalItemsConflict : 0;
          alertTriggered = currentValue > condition.threshold;
          break;
        }

        case 'failure_rate': {
          const failedOperations = recentOperations.filter(op => op.status === SyncStatus.ERROR).length;
          currentValue = failedOperations / recentOperations.length;
          alertTriggered = currentValue > condition.threshold;
          break;
        }
      }

      if (alertTriggered) {
        this.triggerAlert(condition, currentValue);
      }
    });
  }

  private triggerAlert(condition: SyncAlertCondition, value: number): void {
    const alertId = `${condition.type}_${Date.now()}`;
    const severity = this.calculateAlertSeverity(condition, value);

    const alert: SyncAlert = {
      id: alertId,
      condition,
      triggeredAt: new Date().toISOString(),
      value,
      description: `${condition.description} (${(value * 100).toFixed(1)}% vs ${(condition.threshold * 100).toFixed(1)}% threshold)`,
      severity
    };

    this.activeAlerts.push(alert);
    
    logger.warn(
      `Sync alert triggered: ${alert.description}`,
      { alert },
      LogCategory.SYNC
    );

    // Keep only recent alerts
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    this.activeAlerts = this.activeAlerts.filter(a => new Date(a.triggeredAt) >= cutoff);
  }

  private calculateAlertSeverity(condition: SyncAlertCondition, value: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = value / condition.threshold;
    
    if (ratio >= 3) return 'critical';
    if (ratio >= 2) return 'high';
    if (ratio >= 1.5) return 'medium';
    return 'low';
  }

  getActiveAlerts(): SyncAlert[] {
    return [...this.activeAlerts];
  }

  clearAlert(alertId: string): void {
    this.activeAlerts = this.activeAlerts.filter(alert => alert.id !== alertId);
  }

  addAlertCondition(condition: SyncAlertCondition): void {
    this.alertConditions.push(condition);
  }

  removeAlertCondition(type: string): void {
    this.alertConditions = this.alertConditions.filter(condition => condition.type !== type);
  }

  private trimOperationHistory(): void {
    if (this.syncOperations.size > this.maxOperationHistory) {
      const operations = Array.from(this.syncOperations.entries());
      const sorted = operations.sort((a, b) => 
        new Date(b[1].startTime).getTime() - new Date(a[1].startTime).getTime()
      );
      
      // Keep only the most recent operations
      const toKeep = sorted.slice(0, this.maxOperationHistory);
      this.syncOperations.clear();
      
      toKeep.forEach(([syncId, operation]) => {
        this.syncOperations.set(syncId, operation);
      });
    }
  }

  generateSyncReport(timeWindow: number = 60): string {
    const healthMetrics = this.getSyncHealthMetrics(timeWindow);
    const recentOperations = this.getAllSyncOperations(10);
    const activeAlerts = this.getActiveAlerts();

    const report = [
      `# Sync Monitoring Report`,
      `Generated: ${new Date().toISOString()}`,
      `Time Window: ${timeWindow} minutes`,
      ``,
      `## Health Metrics`,
      `- Success Rate: ${(healthMetrics.successRate * 100).toFixed(1)}%`,
      `- Average Duration: ${healthMetrics.averageDuration.toFixed(0)}ms`,
      `- Average Items per Sync: ${healthMetrics.averageItemsPerSync.toFixed(1)}`,
      `- Error Rate: ${(healthMetrics.errorRate * 100).toFixed(1)}%`,
      `- Conflict Rate: ${(healthMetrics.conflictRate * 100).toFixed(1)}%`,
      ``,
      `## Network Distribution`,
      ...Object.entries(healthMetrics.networkDistribution).map(([type, count]) => 
        `- ${type}: ${count} operations`
      ),
      ``,
      `## Recent Operations`,
      ...recentOperations.slice(0, 5).map(op => 
        `- ${op.syncId}: ${op.status} (${op.duration}ms, ${op.itemsProcessed} items)`
      ),
      ``,
      `## Active Alerts`,
      ...activeAlerts.map(alert => 
        `- [${alert.severity.toUpperCase()}] ${alert.description}`
      ),
      ``
    ];

    return report.join('\n');
  }

  clearHistory(): void {
    this.syncOperations.clear();
    this.activeAlerts = [];
    logger.info('Sync monitoring history cleared', undefined, LogCategory.SYNC);
  }
}

// Export singleton instance
export const syncMonitoringService = SyncMonitoringService.getInstance();

// Export class for testing
export default SyncMonitoringService;