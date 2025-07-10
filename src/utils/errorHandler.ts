/**
 * Centralized Error Handling Service for Mobdeck
 * Production-ready error classification, reporting, and user-friendly messaging
 */

import { logger } from './logger';

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  STORAGE = 'STORAGE',
  SYNC = 'SYNC',
  RUNTIME = 'RUNTIME',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AppError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  userMessage: string;
  details?: Record<string, any>;
  stack?: string;
  timestamp: string;
  context?: ErrorContext;
  retryable: boolean;
  reportable: boolean;
}

export interface ErrorContext {
  userId?: string;
  serverUrl?: string;
  actionType?: string;
  screenName?: string;
  apiEndpoint?: string;
  networkState?: string;
  deviceInfo?: Record<string, any>;
}

export interface ErrorReport {
  errorId: string;
  sanitizedError: Omit<AppError, 'context'>;
  sanitizedContext: Record<string, any>;
  breadcrumbs: string[];
  sessionId: string;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private breadcrumbs: string[] = [];
  private sessionId: string;
  private readonly maxBreadcrumbs = 50;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalErrorHandlers(): void {
    if (typeof global !== 'undefined') {
      // Only add breadcrumb without intercepting console.error to avoid double logging
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        this.addBreadcrumb(`Console Error: ${args.join(' ')}`);
        originalConsoleError.apply(console, args);
      };

      global.ErrorUtils?.setGlobalHandler?.((error: Error, isFatal: boolean) => {
        this.handleError(error, {
          category: ErrorCategory.RUNTIME,
          severity: isFatal ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
          context: { isFatal },
        });
      });
    }
  }

  public addBreadcrumb(message: string): void {
    const timestamp = new Date().toISOString();
    this.breadcrumbs.push(`[${timestamp}] ${message}`);
    
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  public handleError(
    error: Error | string | any,
    options: Partial<AppError> = {}
  ): AppError {
    const appError = this.createAppError(error, options);
    
    this.logError(appError);
    
    if (appError.reportable && appError.severity !== ErrorSeverity.LOW) {
      this.reportError(appError);
    }
    
    return appError;
  }

  private createAppError(
    error: Error | string | any,
    options: Partial<AppError>
  ): AppError {
    const id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    let message: string;
    let stack: string | undefined;
    
    if (error instanceof Error) {
      message = error.message;
      stack = error.stack;
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = 'Unknown error occurred';
    }

    const category = options.category || this.categorizeError(error);
    const severity = options.severity || this.determineSeverity(category, error);
    const code = options.code || this.generateErrorCode(category, error);
    const userMessage = options.userMessage || this.getUserFriendlyMessage(category, code);
    const retryable = options.retryable ?? this.isRetryable(category, error);
    const reportable = options.reportable ?? this.isReportable(category, severity);

    return {
      id,
      category,
      severity,
      code,
      message,
      userMessage,
      details: this.sanitizeDetails(options.details),
      stack,
      timestamp,
      context: this.sanitizeContext(options.context),
      retryable,
      reportable,
    };
  }

  private categorizeError(error: any): ErrorCategory {
    if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('network')) {
      return ErrorCategory.NETWORK;
    }
    
    if (error?.status === 401 || error?.code === 'AUTH_ERROR') {
      return ErrorCategory.AUTHENTICATION;
    }
    
    if (error?.status === 404 || error?.code === 'NOT_FOUND') {
      return ErrorCategory.VALIDATION;
    }
    
    if (error?.status >= 400 && error?.status < 500) {
      return ErrorCategory.VALIDATION;
    }
    
    if (error?.message?.includes('storage') || error?.message?.includes('database')) {
      return ErrorCategory.STORAGE;
    }
    
    if (error?.message?.includes('sync')) {
      return ErrorCategory.SYNC;
    }
    
    if (error instanceof Error) {
      return ErrorCategory.RUNTIME;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  private determineSeverity(category: ErrorCategory, error: any): ErrorSeverity {
    if (category === ErrorCategory.AUTHENTICATION) {
      return ErrorSeverity.HIGH;
    }
    
    if (category === ErrorCategory.STORAGE && error?.message?.includes('critical')) {
      return ErrorSeverity.CRITICAL;
    }
    
    if (category === ErrorCategory.NETWORK && error?.status >= 500) {
      return ErrorSeverity.MEDIUM;
    }
    
    if (category === ErrorCategory.VALIDATION) {
      return ErrorSeverity.LOW;
    }
    
    return ErrorSeverity.MEDIUM;
  }

  private generateErrorCode(category: ErrorCategory, error: any): string {
    const categoryPrefix = category.substr(0, 3).toUpperCase();
    const timestamp = Date.now().toString().substr(-6);
    const errorType = error?.name || error?.code || 'UNKNOWN';
    
    return `${categoryPrefix}_${errorType}_${timestamp}`;
  }

  private getUserFriendlyMessage(category: ErrorCategory, _code: string): string {
    const messages: Record<ErrorCategory, string> = {
      [ErrorCategory.NETWORK]: 'Unable to connect to the server. Please check your internet connection and try again.',
      [ErrorCategory.AUTHENTICATION]: 'Authentication failed. Please check your credentials and try logging in again.',
      [ErrorCategory.VALIDATION]: 'Please check your input and try again.',
      [ErrorCategory.STORAGE]: 'Unable to save data locally. Please ensure you have sufficient storage space.',
      [ErrorCategory.SYNC]: 'Synchronization failed. Your changes will be synced when connection is restored.',
      [ErrorCategory.RUNTIME]: 'An unexpected error occurred. Please restart the app if the problem persists.',
      [ErrorCategory.UNKNOWN]: 'Something went wrong. Please try again or contact support if the issue continues.',
    };
    
    return messages[category];
  }

  private isRetryable(category: ErrorCategory, error: any): boolean {
    const retryableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.SYNC,
    ];
    
    if (retryableCategories.includes(category)) {
      return true;
    }
    
    if (error?.status >= 500 && error?.status < 600) {
      return true;
    }
    
    if (error?.code === 'TIMEOUT_ERROR') {
      return true;
    }
    
    return false;
  }

  private isReportable(category: ErrorCategory, severity: ErrorSeverity): boolean {
    if (severity === ErrorSeverity.LOW) {
      return false;
    }
    
    const nonReportableCategories = [ErrorCategory.VALIDATION];
    return !nonReportableCategories.includes(category);
  }

  private sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
    if (!details) return undefined;
    
    const sanitized = { ...details };
    const sensitiveKeys = ['password', 'token', 'authorization', 'secret', 'key', 'credential', 'bearer', 'session', 'cookie', 'auth'];
    
    const sanitizeValue = (value: any, key: string): any => {
      if (value === null || value === undefined) return value;
      
      // Check if key contains sensitive information
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        return '[REDACTED]';
      }
      
      // Check if string value looks like sensitive data
      if (typeof value === 'string') {
        // Bearer token pattern
        if (/^Bearer\s+[A-Za-z0-9-_.]+$/i.test(value)) {
          return '[REDACTED_BEARER_TOKEN]';
        }
        // JWT pattern
        if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(value)) {
          return '[REDACTED_JWT]';
        }
        // API key pattern (long alphanumeric strings)
        if (/^[a-zA-Z0-9]{20,}$/.test(value)) {
          return '[REDACTED_API_KEY]';
        }
        // Email pattern
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return '[REDACTED_EMAIL]';
        }
        // URL with credentials
        if (/https?:\/\/[^\s]*:[^\s]*@/.test(value)) {
          return value.replace(/:([^@:]*):([^@]*)@/, ':[REDACTED]:[REDACTED]@');
        }
        // IP addresses
        if (/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(value)) {
          return value.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED_IP]');
        }
      }
      
      // Recursively sanitize objects and arrays
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          return value.map((item, index) => sanitizeValue(item, `${key}[${index}]`));
        } else {
          const sanitizedObj: any = {};
          Object.keys(value).forEach(subKey => {
            sanitizedObj[subKey] = sanitizeValue(value[subKey], subKey);
          });
          return sanitizedObj;
        }
      }
      
      return value;
    };
    
    Object.keys(sanitized).forEach(key => {
      sanitized[key] = sanitizeValue(sanitized[key], key);
    });
    
    return sanitized;
  }

  private sanitizeContext(context?: ErrorContext): ErrorContext | undefined {
    if (!context) return undefined;
    
    const sanitized = { ...context };
    
    // Sanitize server URL to remove credentials and sensitive info
    if (sanitized.serverUrl) {
      try {
        const url = new URL(sanitized.serverUrl);
        // Remove any embedded credentials and sensitive query params
        sanitized.serverUrl = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`;
        // Remove sensitive query parameters
        if (url.search) {
          const searchParams = new URLSearchParams(url.search);
          const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth', 'session'];
          sensitiveParams.forEach(param => {
            if (searchParams.has(param)) {
              searchParams.set(param, '[REDACTED]');
            }
          });
          const cleanSearch = searchParams.toString();
          if (cleanSearch) {
            sanitized.serverUrl += `?${cleanSearch}`;
          }
        }
      } catch {
        sanitized.serverUrl = '[INVALID_URL]';
      }
    }
    
    // Sanitize user ID
    if (sanitized.userId) {
      sanitized.userId = sanitized.userId.length > 0 ? '[USER_ID_PRESENT]' : '[NO_USER_ID]';
    }
    
    // Sanitize API endpoint to remove sensitive path segments
    if (sanitized.apiEndpoint) {
      sanitized.apiEndpoint = sanitized.apiEndpoint.replace(/\/api\/[^/]*\/[a-zA-Z0-9]{20,}/g, '/api/[ENDPOINT]/[REDACTED_ID]');
    }
    
    // Sanitize device info
    if (sanitized.deviceInfo) {
      sanitized.deviceInfo = this.sanitizeDetails(sanitized.deviceInfo) || {};
    }
    
    return sanitized;
  }

  /**
   * Sanitize error messages to remove sensitive information
   * @private
   */
  private sanitizeErrorMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      return message;
    }
    
    return message
      .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]')
      .replace(/[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*/g, '[JWT_TOKEN]')
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[EMAIL]')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_ADDRESS]')
      .replace(/password[\s=:]+[\S]+/gi, 'password=[REDACTED]')
      .replace(/api[_-]?key[\s=:]+[\S]+/gi, 'api_key=[REDACTED]')
      .replace(/token[\s=:]+[\S]+/gi, 'token=[REDACTED]')
      .replace(/secret[\s=:]+[\S]+/gi, 'secret=[REDACTED]');
  }

  /**
   * Sanitize stack traces to remove sensitive file paths and data
   * @private
   */
  private sanitizeStackTrace(stack?: string): string {
    if (!stack) {
      return '';
    }
    
    return stack
      .replace(/\/Users\/[^\s/]+/g, '/Users/[USERNAME]')
      .replace(/\/home\/[^\s/]+/g, '/home/[USERNAME]')
      .replace(/C:\\Users\\[^\s\\]+/g, 'C:\\Users\\[USERNAME]')
      .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]')
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[EMAIL]');
  }

  private logError(appError: AppError): void {
    const logLevel = this.getLogLevel(appError.severity);
    
    // For sync operations and network errors, just log the message without full object details
    if (appError.category === ErrorCategory.SYNC_OPERATION || 
        appError.category === ErrorCategory.NETWORK) {
      const operation = appError.context?.actionType || appError.category.toLowerCase();
      logger.log(logLevel, `[${operation}] ${appError.message}`);
    } else {
      logger.log(logLevel, 'Error handled', {
        errorId: appError.id,
        category: appError.category,
        severity: appError.severity,
        code: appError.code,
        message: appError.message,
        retryable: appError.retryable,
        context: appError.context,
      });
    }
  }

  private getLogLevel(severity: ErrorSeverity): 'debug' | 'info' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'debug';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error';
      default:
        return 'error';
    }
  }

  private reportError(appError: AppError): void {
    try {
      const report: ErrorReport = {
        errorId: appError.id,
        sanitizedError: {
          id: appError.id,
          category: appError.category,
          severity: appError.severity,
          code: appError.code,
          message: appError.message,
          userMessage: appError.userMessage,
          details: appError.details,
          stack: appError.stack,
          timestamp: appError.timestamp,
          retryable: appError.retryable,
          reportable: appError.reportable,
        },
        sanitizedContext: appError.context || {},
        breadcrumbs: [...this.breadcrumbs],
        sessionId: this.sessionId,
      };
      
      if (__DEV__) {
        console.log('[ErrorHandler] Error report generated:', report);
      }
      
    } catch (reportingError) {
      logger.error('Failed to generate error report', { reportingError });
    }
  }

  public getNetworkErrorHandler() {
    return (error: any) => {
      return this.handleError(error, {
        category: ErrorCategory.NETWORK,
        context: { actionType: 'network_request' },
      });
    };
  }

  public getStorageErrorHandler() {
    return (error: any) => {
      return this.handleError(error, {
        category: ErrorCategory.STORAGE,
        context: { actionType: 'storage_operation' },
      });
    };
  }

  public getSyncErrorHandler() {
    return (error: any) => {
      return this.handleError(error, {
        category: ErrorCategory.SYNC,
        context: { actionType: 'sync_operation' },
      });
    };
  }

  public createReduxErrorAction(error: AppError) {
    return {
      type: 'error/errorOccurred',
      payload: {
        id: error.id,
        message: error.userMessage,
        category: error.category,
        severity: error.severity,
        retryable: error.retryable,
        timestamp: error.timestamp,
      },
    };
  }

  public getBreadcrumbs(): string[] {
    return [...this.breadcrumbs];
  }

  public clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  public getSessionId(): string {
    return this.sessionId;
  }
}

export const errorHandler = ErrorHandler.getInstance();
export default errorHandler;