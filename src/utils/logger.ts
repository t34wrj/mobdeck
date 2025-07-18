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

export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  SERVER = 'SERVER',
  VALIDATION = 'VALIDATION',
  SYNC = 'SYNC',
  DATABASE = 'DATABASE',
  PERMISSION = 'PERMISSION',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

export interface ErrorClassification {
  type: ErrorType;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  isRetryable: boolean;
  userMessage?: string;
  suggestedAction?: string;
  errorCode?: string;
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
  private errorClassifications: Map<string, ErrorClassification> = new Map();

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

  /**
   * Serialize error objects to human-readable strings
   * Handles Error objects, axios errors, and custom error types
   */
  private serializeError(error: any): string {
    try {
      // If error is already a string, return it
      if (typeof error === 'string') return error;
      
      // Handle Error objects
      if (error instanceof Error) {
        let serialized = `${error.name}: ${error.message}`;
        if (error.stack && this.isDebugMode) {
          serialized += `\nStack trace: ${error.stack}`;
        }
        return serialized;
      }
      
      // Handle axios errors
      if (error?.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const data = error.response.data;
        
        let message = `HTTP ${status}`;
        if (statusText) message += ` ${statusText}`;
        
        // Extract error message from response data
        if (data?.message) {
          message += `: ${data.message}`;
        } else if (data?.error) {
          message += `: ${data.error}`;
        } else if (typeof data === 'string') {
          message += `: ${data}`;
        }
        
        return message;
      }
      
      // Handle network errors
      if (error?.code === 'NETWORK_ERROR' || error?.code === 'ECONNABORTED') {
        return `Network error: ${error.message || 'Connection failed'}`;
      }
      
      // Handle timeout errors
      if (error?.code === 'TIMEOUT' || error?.message?.includes('timeout')) {
        return `Timeout error: ${error.message || 'Request timed out'}`;
      }
      
      // Handle objects with message property
      if (error?.message) {
        return error.message;
      }
      
      // Handle objects with error property
      if (error?.error) {
        return typeof error.error === 'string' ? error.error : this.serializeError(error.error);
      }
      
      // Try to extract meaningful properties from objects
      if (typeof error === 'object' && error !== null) {
        const errorInfo = [];
        
        // Common error properties
        if (error.name) errorInfo.push(`Name: ${error.name}`);
        if (error.code) errorInfo.push(`Code: ${error.code}`);
        if (error.status) errorInfo.push(`Status: ${error.status}`);
        if (error.statusText) errorInfo.push(`Status Text: ${error.statusText}`);
        if (error.type) errorInfo.push(`Type: ${error.type}`);
        
        if (errorInfo.length > 0) {
          return errorInfo.join(', ');
        }
        
        // Last resort: try to stringify with safe properties
        try {
          const safeKeys = Object.keys(error).filter(key => {
            const value = error[key];
            return typeof value !== 'function' && 
                   typeof value !== 'object' && 
                   typeof value !== 'undefined' &&
                   value !== null;
          });
          
          if (safeKeys.length > 0) {
            const safeObj = {};
            safeKeys.forEach(key => {
              safeObj[key] = error[key];
            });
            return JSON.stringify(safeObj);
          }
        } catch {
          // If JSON.stringify fails, continue to fallback
        }
      }
      
      // Final fallback
      return error?.toString?.() || 'Unknown error occurred';
    } catch (serializationError) {
      return `[Error serialization failed: ${serializationError.message}] Original error type: ${typeof error}`;
    }
  }

  /**
   * Classify error types and provide user-friendly information
   */
  private classifyError(error: any): ErrorClassification {
    // Check if already classified
    const errorString = this.serializeError(error);
    const cached = this.errorClassifications.get(errorString);
    if (cached) {
      return cached;
    }
    
    let classification: ErrorClassification;
    
    // Network errors
    if (error?.code === 'NETWORK_ERROR' || error?.code === 'ECONNABORTED' || 
        error?.message?.includes('network') || error?.message?.includes('connect')) {
      classification = {
        type: ErrorType.NETWORK,
        severity: 'high',
        isRetryable: true,
        userMessage: 'Network connection failed. Please check your internet connection.',
        suggestedAction: 'Check your network connection and try again',
        errorCode: 'NETWORK_ERROR'
      };
    }
    // Authentication errors
    else if (error?.response?.status === 401 || error?.response?.status === 403 || 
             error?.message?.includes('auth') || error?.message?.includes('unauthorized')) {
      classification = {
        type: ErrorType.AUTHENTICATION,
        severity: 'high',
        isRetryable: false,
        userMessage: 'Authentication failed. Please check your login credentials.',
        suggestedAction: 'Re-login to your account',
        errorCode: 'AUTH_ERROR'
      };
    }
    // Server errors (5xx)
    else if (error?.response?.status >= 500) {
      classification = {
        type: ErrorType.SERVER,
        severity: 'high',
        isRetryable: true,
        userMessage: 'Server error occurred. Please try again later.',
        suggestedAction: 'Wait a moment and try again',
        errorCode: 'SERVER_ERROR'
      };
    }
    // Client errors (4xx)
    else if (error?.response?.status >= 400 && error?.response?.status < 500) {
      classification = {
        type: ErrorType.VALIDATION,
        severity: 'medium',
        isRetryable: false,
        userMessage: 'Request failed. Please check your input and try again.',
        suggestedAction: 'Review your request and try again',
        errorCode: 'VALIDATION_ERROR'
      };
    }
    // Timeout errors
    else if (error?.code === 'TIMEOUT' || error?.message?.includes('timeout')) {
      classification = {
        type: ErrorType.TIMEOUT,
        severity: 'medium',
        isRetryable: true,
        userMessage: 'Request timed out. Please try again.',
        suggestedAction: 'Try again with a better connection',
        errorCode: 'TIMEOUT_ERROR'
      };
    }
    // Sync-specific errors
    else if (error?.message?.includes('sync') || error?.code?.includes('SYNC')) {
      classification = {
        type: ErrorType.SYNC,
        severity: 'medium',
        isRetryable: true,
        userMessage: 'Sync operation failed. Your data will be synced when the connection is restored.',
        suggestedAction: 'Try syncing again when you have a stable connection',
        errorCode: 'SYNC_ERROR'
      };
    }
    // Database errors
    else if (error?.message?.includes('database') || error?.message?.includes('SQL')) {
      classification = {
        type: ErrorType.DATABASE,
        severity: 'critical',
        isRetryable: false,
        userMessage: 'Database error occurred. Please restart the app.',
        suggestedAction: 'Restart the app or clear app data',
        errorCode: 'DATABASE_ERROR'
      };
    }
    // Unknown errors
    else {
      classification = {
        type: ErrorType.UNKNOWN,
        severity: 'medium',
        isRetryable: true,
        userMessage: 'An unexpected error occurred. Please try again.',
        suggestedAction: 'Try again or contact support if the issue persists',
        errorCode: 'UNKNOWN_ERROR'
      };
    }
    
    // Cache the classification
    this.errorClassifications.set(errorString, classification);
    
    return classification;
  }

  /**
   * Deep serialize any data structure, handling errors properly
   */
  private serializeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }
    
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }
    
    if (data instanceof Error || (data && typeof data === 'object' && data.message)) {
      return this.serializeError(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.serializeData(item));
    }
    
    if (typeof data === 'object') {
      const serialized = {};
      for (const [key, value] of Object.entries(data)) {
        serialized[key] = this.serializeData(value);
      }
      return serialized;
    }
    
    return data;
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
      const serializedData = this.serializeData(data);
      const entry = this.createLogEntry(LogLevel.ERROR, category, message, serializedData);
      this.addToHistory(entry);
      console.error(this.formatLogMessage(entry), serializedData);
    }
  }

  /**
   * Enhanced error logging with classification and user-friendly messages
   */
  errorWithClassification(message: string, error: any, category: LogCategory = LogCategory.GENERAL): ErrorClassification {
    const classification = this.classifyError(error);
    const serializedError = this.serializeError(error);
    
    const enhancedMessage = `${message}: ${serializedError}`;
    const logData = {
      originalError: serializedError,
      classification,
      userMessage: classification.userMessage,
      suggestedAction: classification.suggestedAction,
      errorCode: classification.errorCode,
      isRetryable: classification.isRetryable
    };
    
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.createLogEntry(LogLevel.ERROR, category, enhancedMessage, logData);
      this.addToHistory(entry);
      console.error(this.formatLogMessage(entry), logData);
    }
    
    return classification;
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
    const classification = this.classifyError(error);
    const serializedError = this.serializeError(error);
    
    const enhancedMessage = `${message}: ${serializedError}`;
    const logData = {
      originalError: serializedError,
      classification,
      userMessage: classification.userMessage,
      suggestedAction: classification.suggestedAction,
      errorCode: classification.errorCode,
      isRetryable: classification.isRetryable,
      ...this.serializeData(data)
    };
    
    const entry: SyncLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      category: LogCategory.SYNC,
      message: enhancedMessage,
      data: logData,
      correlation: syncId,
      phase,
      operation,
      syncId
    };

    this.addToHistory(entry);
    console.error(this.formatLogMessage(entry), logData);
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
    this.errorClassifications.clear();
  }

  /**
   * Get error statistics by type
   */
  getErrorStats(since?: Date): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<string, number>;
    retryableErrors: number;
    nonRetryableErrors: number;
  } {
    const errorEntries = this.getLogHistory(LogCategory.ERROR, LogLevel.ERROR, since);
    
    const stats = {
      totalErrors: errorEntries.length,
      errorsByType: {} as Record<ErrorType, number>,
      errorsBySeverity: {} as Record<string, number>,
      retryableErrors: 0,
      nonRetryableErrors: 0
    };
    
    // Initialize counters
    Object.values(ErrorType).forEach(type => {
      stats.errorsByType[type] = 0;
    });
    
    ['critical', 'high', 'medium', 'low', 'info'].forEach(severity => {
      stats.errorsBySeverity[severity] = 0;
    });
    
    errorEntries.forEach(entry => {
      const data = entry.data;
      if (data?.classification) {
        const classification = data.classification as ErrorClassification;
        stats.errorsByType[classification.type]++;
        stats.errorsBySeverity[classification.severity]++;
        
        if (classification.isRetryable) {
          stats.retryableErrors++;
        } else {
          stats.nonRetryableErrors++;
        }
      }
    });
    
    return stats;
  }

  /**
   * Get user-friendly error summary for display
   */
  getErrorSummary(since?: Date): {
    recentErrors: Array<{
      timestamp: string;
      message: string;
      userMessage: string;
      suggestedAction: string;
      isRetryable: boolean;
    }>;
    criticalIssues: number;
    retryableIssues: number;
  } {
    const errorEntries = this.getLogHistory(LogCategory.ERROR, LogLevel.ERROR, since);
    
    const recentErrors = errorEntries
      .filter(entry => entry.data?.classification)
      .slice(-10) // Get last 10 errors
      .map(entry => ({
        timestamp: entry.timestamp,
        message: entry.message,
        userMessage: entry.data.userMessage || 'An error occurred',
        suggestedAction: entry.data.suggestedAction || 'Try again',
        isRetryable: entry.data.isRetryable || false
      }));
    
    const criticalIssues = errorEntries.filter(entry => 
      entry.data?.classification?.severity === 'critical'
    ).length;
    
    const retryableIssues = errorEntries.filter(entry => 
      entry.data?.classification?.isRetryable === true
    ).length;
    
    return {
      recentErrors,
      criticalIssues,
      retryableIssues
    };
  }

  exportLogs(category?: LogCategory, level?: LogLevel, since?: Date): string {
    const logs = this.getLogHistory(category, level, since);
    return logs.map(entry => this.formatLogMessage(entry)).join('\n');
  }
}

export const logger = new EnhancedLogger();
