/**
 * Enhanced Logger for Mobile App with Sync Monitoring
 * Comprehensive logging with sync-specific capabilities
 */

import { SyncPhase, NetworkType } from '../types/sync';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export enum LogCategory {
  SYNC = 'SYNC',
  API = 'API',
  DB = 'DB',
  UI = 'UI',
  NETWORK = 'NETWORK',
  PERFORMANCE = 'PERFORMANCE',
  ERROR = 'ERROR',
  GENERAL = 'GENERAL'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  correlation?: string;
  duration?: number;
  phase?: SyncPhase;
  operation?: string;
}

export interface SyncLogEntry extends LogEntry {
  syncId: string;
  phase: SyncPhase;
  operation: string;
  itemCount?: number;
  errorCount?: number;
  duration?: number;
  networkType?: NetworkType;
  batchSize?: number;
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: string;
  success: boolean;
  itemCount?: number;
  errorCount?: number;
}

class EnhancedLogger {
  private isDev = typeof globalThis !== 'undefined' && globalThis.__DEV__;
  private isDebugMode = false;
  private performanceTimers: Map<string, { start: number; data?: any }> = new Map();
  private logHistory: LogEntry[] = [];
  private maxLogHistory = 1000;
  private syncMetrics: Map<string, PerformanceMetrics> = new Map();
  private currentLogLevel = LogLevel.INFO;

  constructor() {
    this.setupDebugMode();
  }

  private setupDebugMode(): void {
    this.isDebugMode = this.isDev || process.env.NODE_ENV === 'development';
  }

  setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }

  enableDebugMode(): void {
    this.isDebugMode = true;
  }

  disableDebugMode(): void {
    this.isDebugMode = false;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLogLevel;
  }

  private createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: any,
    correlation?: string,
    duration?: number,
    phase?: SyncPhase,
    operation?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      correlation,
      duration,
      phase,
      operation
    };
  }

  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxLogHistory) {
      this.logHistory.shift();
    }
  }

  private formatLogMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const level = LogLevel[entry.level];
    const category = entry.category;
    const correlation = entry.correlation ? `[${entry.correlation}]` : '';
    const duration = entry.duration ? `(${entry.duration}ms)` : '';
    const phase = entry.phase ? `[${entry.phase}]` : '';
    
    return `[${timestamp}] [${level}] [${category}]${correlation}${phase}${duration} ${entry.message}`;
  }

  debug(message: string, data?: any, category: LogCategory = LogCategory.GENERAL): void {
    if (this.shouldLog(LogLevel.DEBUG) && this.isDebugMode) {
      const entry = this.createLogEntry(LogLevel.DEBUG, category, message, data);
      this.addToHistory(entry);
      console.debug(this.formatLogMessage(entry), data);
    }
  }

  info(message: string, data?: any, category: LogCategory = LogCategory.GENERAL): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.createLogEntry(LogLevel.INFO, category, message, data);
      this.addToHistory(entry);
      console.info(this.formatLogMessage(entry), data);
    }
  }

  warn(message: string, data?: any, category: LogCategory = LogCategory.GENERAL): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.createLogEntry(LogLevel.WARN, category, message, data);
      this.addToHistory(entry);
      console.warn(this.formatLogMessage(entry), data);
    }
  }

  error(message: string, data?: any, category: LogCategory = LogCategory.GENERAL): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.createLogEntry(LogLevel.ERROR, category, message, data);
      this.addToHistory(entry);
      console.error(this.formatLogMessage(entry), data);
    }
  }

  syncLog(
    syncId: string,
    phase: SyncPhase,
    operation: string,
    message: string,
    data?: {
      itemCount?: number;
      errorCount?: number;
      duration?: number;
      networkType?: NetworkType;
      batchSize?: number;
    }
  ): void {
    const entry: SyncLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      category: LogCategory.SYNC,
      message,
      data,
      correlation: syncId,
      phase,
      operation,
      syncId,
      ...data
    };

    this.addToHistory(entry);
    
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatLogMessage(entry), data);
    }

    // Store sync metrics
    if (data?.duration) {
      this.syncMetrics.set(`${syncId}_${operation}`, {
        operation,
        duration: data.duration,
        timestamp: entry.timestamp,
        success: !data.errorCount || data.errorCount === 0,
        itemCount: data.itemCount,
        errorCount: data.errorCount
      });
    }
  }

  syncDebug(
    syncId: string,
    phase: SyncPhase,
    operation: string,
    message: string,
    data?: any
  ): void {
    if (this.isDebugMode) {
      const entry: SyncLogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.DEBUG,
        category: LogCategory.SYNC,
        message,
        data,
        correlation: syncId,
        phase,
        operation,
        syncId
      };

      this.addToHistory(entry);
      console.debug(this.formatLogMessage(entry), data);
    }
  }

  syncError(
    syncId: string,
    phase: SyncPhase,
    operation: string,
    message: string,
    error: any,
    data?: any
  ): void {
    const entry: SyncLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      category: LogCategory.SYNC,
      message,
      data: { error, ...data },
      correlation: syncId,
      phase,
      operation,
      syncId
    };

    this.addToHistory(entry);
    console.error(this.formatLogMessage(entry), { error, ...data });
  }

  startPerformanceTimer(id: string, data?: any): void {
    this.performanceTimers.set(id, {
      start: Date.now(),
      data
    });
  }

  endPerformanceTimer(id: string, category: LogCategory = LogCategory.PERFORMANCE): number {
    const timer = this.performanceTimers.get(id);
    if (timer) {
      const duration = Date.now() - timer.start;
      this.performanceTimers.delete(id);
      
      const entry = this.createLogEntry(
        LogLevel.INFO,
        category,
        `Performance: ${id}`,
        timer.data,
        undefined,
        duration
      );
      
      this.addToHistory(entry);
      
      if (this.shouldLog(LogLevel.INFO) && this.isDebugMode) {
        console.info(this.formatLogMessage(entry), timer.data);
      }
      
      return duration;
    }
    return 0;
  }

  getLogHistory(
    category?: LogCategory,
    level?: LogLevel,
    since?: Date,
    limit?: number
  ): LogEntry[] {
    let filtered = this.logHistory;

    if (category) {
      filtered = filtered.filter(entry => entry.category === category);
    }

    if (level !== undefined) {
      filtered = filtered.filter(entry => entry.level >= level);
    }

    if (since) {
      filtered = filtered.filter(entry => new Date(entry.timestamp) >= since);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  getSyncLogs(syncId?: string, phase?: SyncPhase, since?: Date): SyncLogEntry[] {
    const syncLogs = this.logHistory.filter(entry => 
      entry.category === LogCategory.SYNC
    ) as SyncLogEntry[];

    let filtered = syncLogs;

    if (syncId) {
      filtered = filtered.filter(entry => entry.syncId === syncId);
    }

    if (phase) {
      filtered = filtered.filter(entry => entry.phase === phase);
    }

    if (since) {
      filtered = filtered.filter(entry => new Date(entry.timestamp) >= since);
    }

    return filtered;
  }

  getSyncMetrics(operation?: string, since?: Date): PerformanceMetrics[] {
    const metrics = Array.from(this.syncMetrics.values());

    let filtered = metrics;

    if (operation) {
      filtered = filtered.filter(metric => metric.operation === operation);
    }

    if (since) {
      filtered = filtered.filter(metric => new Date(metric.timestamp) >= since);
    }

    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getSyncStats(since?: Date): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageDuration: number;
    operationsByType: Record<string, number>;
  } {
    const metrics = this.getSyncMetrics(undefined, since);
    
    const stats = {
      totalOperations: metrics.length,
      successfulOperations: metrics.filter(m => m.success).length,
      failedOperations: metrics.filter(m => !m.success).length,
      averageDuration: 0,
      operationsByType: {} as Record<string, number>
    };

    if (metrics.length > 0) {
      stats.averageDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    }

    metrics.forEach(metric => {
      stats.operationsByType[metric.operation] = (stats.operationsByType[metric.operation] || 0) + 1;
    });

    return stats;
  }

  clearHistory(): void {
    this.logHistory = [];
    this.syncMetrics.clear();
  }

  exportLogs(category?: LogCategory, level?: LogLevel, since?: Date): string {
    const logs = this.getLogHistory(category, level, since);
    return logs.map(entry => this.formatLogMessage(entry)).join('\n');
  }
}

export const logger = new EnhancedLogger();
