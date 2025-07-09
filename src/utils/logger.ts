/**
 * Centralized Logging Service for Mobdeck
 * Production-ready logging with configurable levels, storage rotation, and performance optimization
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  data?: Record<string, any>;
  timestamp: string;
  context: LogContext;
}

export interface LogContext {
  sessionId?: string;
  userId?: string;
  screenName?: string;
  actionType?: string;
  platform: string;
  version: string;
  networkState?: string;
  memoryUsage?: number;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  enablePerformanceLogging: boolean;
  maxStorageSize: number; // in bytes
  maxStorageEntries: number;
  rotationThreshold: number; // percentage (0-100)
  sensitiveKeys: string[];
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: string;
  context?: Record<string, any>;
}

class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private context: Partial<LogContext>;
  private performanceMarks: Map<string, number> = new Map();
  private storageKey = '@mobdeck_logs';
  private performanceKey = '@mobdeck_performance';

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  private constructor() {
    this.config = this.getDefaultConfig();
    this.context = this.getDefaultContext();
    this.initialize();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getDefaultConfig(): LoggerConfig {
    return {
      level: (typeof __DEV__ !== 'undefined' && __DEV__) ? 'debug' : 'warn',
      enableConsole: (typeof __DEV__ !== 'undefined' && __DEV__),
      enableStorage: true,
      enablePerformanceLogging: (typeof __DEV__ !== 'undefined' && __DEV__),
      maxStorageSize: 1024 * 1024 * 2, // 2MB
      maxStorageEntries: 1000,
      rotationThreshold: 80, // 80%
      sensitiveKeys: [
        'password',
        'token',
        'authorization',
        'secret',
        'key',
        'credential',
        'bearer',
        'session',
      ],
    };
  }

  private getDefaultContext(): Partial<LogContext> {
    return {
      platform: Platform.OS,
      version: '1.0.0', // Should be read from package.json or build config
    };
  }

  private async initialize(): Promise<void> {
    try {
      await this.checkStorageRotation();
    } catch (error) {
      console.warn('[Logger] Failed to initialize:', error);
    }
  }

  public updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public updateContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  public debug(message: string, data?: Record<string, any>): void {
    this.log('debug', message, data);
  }

  public info(message: string, data?: Record<string, any>): void {
    this.log('info', message, data);
  }

  public warn(message: string, data?: Record<string, any>): void {
    this.log('warn', message, data);
  }

  public error(message: string, data?: Record<string, any>): void {
    this.log('error', message, data);
  }

  public fatal(message: string, data?: Record<string, any>): void {
    this.log('fatal', message, data);
  }

  public log(level: LogLevel, message: string, data?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = this.createLogEntry(level, message, data);

    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    if (this.config.enableStorage) {
      this.logToStorage(logEntry).catch(error => {
        console.warn('[Logger] Failed to store log entry:', error);
      });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.config.level];
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: Record<string, any>
  ): LogEntry {
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    const sanitizedData = data ? this.sanitizeData(data) : undefined;
    
    const context: LogContext = {
      ...this.context,
      platform: this.context.platform!,
      version: this.context.version!,
    };

    if (this.config.enablePerformanceLogging) {
      context.memoryUsage = this.getMemoryUsage();
    }

    return {
      id,
      level,
      message,
      data: sanitizedData,
      timestamp,
      context,
    };
  }

  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };
    
    const sanitizeObject = (obj: any, depth = 0): any => {
      if (depth > 5) return '[MAX_DEPTH_REACHED]';
      
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, depth + 1));
      }
      
      const result: any = {};
      Object.keys(obj).forEach(key => {
        if (this.config.sensitiveKeys.some(sensitive => 
          key.toLowerCase().includes(sensitive.toLowerCase())
        )) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitizeObject(obj[key], depth + 1);
        }
      });
      
      return result;
    };
    
    return sanitizeObject(sanitized);
  }

  private logToConsole(logEntry: LogEntry): void {
    const { level, message, data, timestamp } = logEntry;
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(logMessage, data);
        break;
      case 'info':
        console.info(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'error':
      case 'fatal':
        console.error(logMessage, data);
        break;
      default:
        console.log(logMessage, data);
    }
  }

  private async logToStorage(logEntry: LogEntry): Promise<void> {
    try {
      const existingLogs = await this.getStoredLogs();
      const updatedLogs = [...existingLogs, logEntry];
      
      await this.checkAndRotateLogs(updatedLogs);
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(updatedLogs));
    } catch (error) {
      if (__DEV__) {
        console.error('[Logger] Storage error:', error);
      }
    }
  }

  private async getStoredLogs(): Promise<LogEntry[]> {
    try {
      const storedLogs = await AsyncStorage.getItem(this.storageKey);
      return storedLogs ? JSON.parse(storedLogs) : [];
    } catch (error) {
      return [];
    }
  }

  private async checkAndRotateLogs(logs: LogEntry[]): Promise<LogEntry[]> {
    if (logs.length <= this.config.maxStorageEntries) {
      return logs;
    }
    
    const rotateCount = Math.floor(logs.length * (this.config.rotationThreshold / 100));
    const rotatedLogs = logs.slice(rotateCount);
    
    this.debug('Log rotation performed', {
      originalCount: logs.length,
      rotatedCount: rotatedLogs.length,
      removedCount: rotateCount,
    });
    
    return rotatedLogs;
  }

  private async checkStorageRotation(): Promise<void> {
    try {
      const logs = await this.getStoredLogs();
      const logsSize = JSON.stringify(logs).length;
      
      if (logsSize > this.config.maxStorageSize) {
        const rotatedLogs = await this.checkAndRotateLogs(logs);
        await AsyncStorage.setItem(this.storageKey, JSON.stringify(rotatedLogs));
      }
    } catch (error) {
      console.warn('[Logger] Storage rotation check failed:', error);
    }
  }

  private getMemoryUsage(): number {
    try {
      if (global.performance?.memory) {
        return global.performance.memory.usedJSHeapSize;
      }
    } catch (error) {
      // Memory API not available
    }
    return 0;
  }

  // Performance logging methods
  public startPerformanceTimer(operation: string): void {
    if (!this.config.enablePerformanceLogging) return;
    
    this.performanceMarks.set(operation, Date.now());
  }

  public endPerformanceTimer(
    operation: string,
    context?: Record<string, any>
  ): void {
    if (!this.config.enablePerformanceLogging) return;
    
    const startTime = this.performanceMarks.get(operation);
    if (!startTime) {
      this.warn('Performance timer not found', { operation });
      return;
    }
    
    const duration = Date.now() - startTime;
    this.performanceMarks.delete(operation);
    
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      context: context ? this.sanitizeData(context) : undefined,
    };
    
    this.logPerformanceMetric(metric);
    
    this.debug('Performance metric recorded', {
      operation,
      duration,
      context,
    });
    
    // Log slow operations as warning
    if (duration > 1000) { // > 1 second
      this.warn('Slow operation detected', {
        operation,
        duration: `${duration}ms`,
        context,
      });
    }
  }

  private async logPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const existingMetrics = await this.getStoredPerformanceMetrics();
      const updatedMetrics = [...existingMetrics, metric];
      
      // Keep only last 100 performance metrics
      const trimmedMetrics = updatedMetrics.slice(-100);
      
      await AsyncStorage.setItem(
        this.performanceKey,
        JSON.stringify(trimmedMetrics)
      );
    } catch (error) {
      if (__DEV__) {
        console.error('[Logger] Performance metric storage error:', error);
      }
    }
  }

  private async getStoredPerformanceMetrics(): Promise<PerformanceMetric[]> {
    try {
      const storedMetrics = await AsyncStorage.getItem(this.performanceKey);
      return storedMetrics ? JSON.parse(storedMetrics) : [];
    } catch (error) {
      return [];
    }
  }

  // Log retrieval methods for debugging
  public async getLogs(
    level?: LogLevel,
    limit?: number
  ): Promise<LogEntry[]> {
    try {
      const logs = await this.getStoredLogs();
      
      let filteredLogs = logs;
      
      if (level) {
        filteredLogs = logs.filter(log => log.level === level);
      }
      
      if (limit) {
        filteredLogs = filteredLogs.slice(-limit);
      }
      
      return filteredLogs;
    } catch (error) {
      this.error('Failed to retrieve logs', { error });
      return [];
    }
  }

  public async getPerformanceMetrics(limit?: number): Promise<PerformanceMetric[]> {
    try {
      const metrics = await this.getStoredPerformanceMetrics();
      return limit ? metrics.slice(-limit) : metrics;
    } catch (error) {
      this.error('Failed to retrieve performance metrics', { error });
      return [];
    }
  }

  public async clearLogs(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(this.storageKey);
      await AsyncStorage.removeItem(this.performanceKey);
      return true;
    } catch (error) {
      this.error('Failed to clear logs', { error });
      return false;
    }
  }

  public async exportLogs(): Promise<string | null> {
    try {
      const logs = await this.getStoredLogs();
      const metrics = await this.getStoredPerformanceMetrics();
      
      const exportData = {
        logs,
        performanceMetrics: metrics,
        exportTimestamp: new Date().toISOString(),
        config: {
          level: this.config.level,
          platform: this.context.platform,
          version: this.context.version,
        },
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.error('Failed to export logs', { error });
      return null;
    }
  }
}

export const logger = Logger.getInstance();
export default logger;