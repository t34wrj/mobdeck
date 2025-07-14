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
  SYNC_OPERATION = 'SYNC_OPERATION',
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
  isFatal?: boolean;
}

/**
 * Common error types that we handle
 */
export type KnownError =
  | Error
  | {
      code: string;
      message?: string;
      status?: number;
      response?: { status: number };
    }
  | { message: string; status?: number }
  | { status: number; message?: string }
  | string
  | unknown;

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if error has a code property
 */
export function hasErrorCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

/**
 * Type guard to check if error has a status property
 */
export function hasErrorStatus(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && 'status' in error;
}

/**
 * Type guard to check if error has a message property
 */
export function hasErrorMessage(error: unknown): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error;
}

/**
 * Extract error message from any error type safely
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (isError(error)) {
    return error.message;
  }
  if (hasErrorMessage(error)) {
    return error.message;
  }
  return 'Unknown error occurred';
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

      (global as any).ErrorUtils?.setGlobalHandler?.(
        (error: Error, isFatal: boolean) => {
          this.handleError(error, {
            category: ErrorCategory.RUNTIME,
            severity: isFatal ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
            context: { isFatal },
          });
        }
      );
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
    error: KnownError,
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
    error: KnownError,
    options: Partial<AppError>
  ): AppError {
    const id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    let message: string;
    let stack: string | undefined;

    if (isError(error)) {
      message = error.message;
      stack = error.stack;
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = getErrorMessage(error);
    }

    const category = options.category || this.categorizeError(error);
    const severity =
      options.severity || this.determineSeverity(category, error);
    const code = options.code || this.generateErrorCode(category, error);
    const userMessage =
      options.userMessage || this.getUserFriendlyMessage(category, code);
    const retryable = options.retryable ?? this.isRetryable(category, error);
    const reportable =
      options.reportable ?? this.isReportable(category, severity);

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

  private categorizeError(error: KnownError): ErrorCategory {
    if (
      hasErrorCode(error) &&
      (error.code === 'NETWORK_ERROR' ||
        error.code === 'AUTH_ERROR' ||
        error.code === 'NOT_FOUND')
    ) {
      if (error.code === 'NETWORK_ERROR') return ErrorCategory.NETWORK;
      if (error.code === 'AUTH_ERROR') return ErrorCategory.AUTHENTICATION;
      if (error.code === 'NOT_FOUND') return ErrorCategory.VALIDATION;
    }

    if (hasErrorStatus(error)) {
      if (error.status === 401) return ErrorCategory.AUTHENTICATION;
      if (error.status === 404) return ErrorCategory.VALIDATION;
      if (error.status >= 400 && error.status < 500)
        return ErrorCategory.VALIDATION;
    }

    const message = getErrorMessage(error);
    if (message.includes('network')) {
      return ErrorCategory.NETWORK;
    }

    if (message.includes('storage') || message.includes('database')) {
      return ErrorCategory.STORAGE;
    }

    if (message.includes('sync')) {
      return ErrorCategory.SYNC;
    }

    if (isError(error)) {
      return ErrorCategory.RUNTIME;
    }

    return ErrorCategory.UNKNOWN;
  }

  private determineSeverity(
    category: ErrorCategory,
    error: KnownError
  ): ErrorSeverity {
    if (category === ErrorCategory.AUTHENTICATION) {
      return ErrorSeverity.HIGH;
    }

    const message = getErrorMessage(error);
    if (category === ErrorCategory.STORAGE && message.includes('critical')) {
      return ErrorSeverity.CRITICAL;
    }

    if (
      category === ErrorCategory.NETWORK &&
      hasErrorStatus(error) &&
      error.status >= 500
    ) {
      return ErrorSeverity.MEDIUM;
    }

    if (category === ErrorCategory.VALIDATION) {
      return ErrorSeverity.LOW;
    }

    return ErrorSeverity.MEDIUM;
  }

  private generateErrorCode(
    category: ErrorCategory,
    error: KnownError
  ): string {
    const categoryPrefix = category.substr(0, 3).toUpperCase();
    const timestamp = Date.now().toString().substr(-6);

    let errorType = 'UNKNOWN';
    if (isError(error)) {
      errorType = error.name;
    } else if (hasErrorCode(error)) {
      errorType = error.code;
    }

    return `${categoryPrefix}_${errorType}_${timestamp}`;
  }

  private getUserFriendlyMessage(
    category: ErrorCategory,
    _code: string
  ): string {
    const messages: Record<ErrorCategory, string> = {
      [ErrorCategory.NETWORK]:
        'Unable to connect to the server. Please check your internet connection and try again.',
      [ErrorCategory.AUTHENTICATION]:
        'Authentication failed. Please check your credentials and try logging in again.',
      [ErrorCategory.VALIDATION]: 'Please check your input and try again.',
      [ErrorCategory.STORAGE]:
        'Unable to save data locally. Please ensure you have sufficient storage space.',
      [ErrorCategory.SYNC]:
        'Synchronization failed. Your changes will be synced when connection is restored.',
      [ErrorCategory.SYNC_OPERATION]:
        'Sync operation encountered an issue. Your data is safe and sync will retry automatically.',
      [ErrorCategory.RUNTIME]:
        'An unexpected error occurred. Please restart the app if the problem persists.',
      [ErrorCategory.UNKNOWN]:
        'Something went wrong. Please try again or contact support if the issue continues.',
    };

    return messages[category];
  }

  private isRetryable(category: ErrorCategory, error: KnownError): boolean {
    const retryableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.SYNC,
      ErrorCategory.SYNC_OPERATION,
    ];

    if (retryableCategories.includes(category)) {
      return true;
    }

    if (hasErrorStatus(error) && error.status >= 500 && error.status < 600) {
      return true;
    }

    if (hasErrorCode(error) && error.code === 'TIMEOUT_ERROR') {
      return true;
    }

    return false;
  }

  private isReportable(
    category: ErrorCategory,
    severity: ErrorSeverity
  ): boolean {
    if (severity === ErrorSeverity.LOW) {
      return false;
    }

    const nonReportableCategories = [ErrorCategory.VALIDATION];
    return !nonReportableCategories.includes(category);
  }

  private sanitizeDetails(
    details?: Record<string, any>
  ): Record<string, any> | undefined {
    if (!details) return undefined;

    const sanitized = { ...details };
    const sensitiveKeys = [
      'password',
      'token',
      'authorization',
      'secret',
      'key',
      'credential',
      'bearer',
      'session',
      'cookie',
      'auth',
    ];

    const sanitizeValue = (value: any, key: string): any => {
      if (value === null || value === undefined) return value;

      // Check if string value looks like sensitive data patterns first
      if (typeof value === 'string') {
        // Bearer token pattern
        if (/^Bearer\s+[A-Za-z0-9-_.]+$/i.test(value)) {
          return '[REDACTED_BEARER_TOKEN]';
        }
        // JWT pattern
        if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(value)) {
          return '[REDACTED_JWT]';
        }
        // API key pattern (long alphanumeric strings with underscores)
        if (/^[a-zA-Z0-9_]{20,}$/.test(value)) {
          return '[REDACTED_API_KEY]';
        }
      }

      // Then check if key contains sensitive information (only for string values)
      if (
        typeof value === 'string' &&
        sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))
      ) {
        return '[REDACTED]';
      }

      // Continue with other string patterns
      if (typeof value === 'string') {
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
          return value.replace(
            /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
            '[REDACTED_IP]'
          );
        }
      }

      // Recursively sanitize objects and arrays
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          return value.map((item, index) =>
            sanitizeValue(item, `${key}[${index}]`)
          );
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
        // Check for embedded credentials
        let hostname = url.hostname;
        if (url.username || url.password) {
          hostname = `%5BREDACTED%5D@${hostname}`;
        }
        // Remove any embedded credentials, path, and sensitive query params
        sanitized.serverUrl = `${url.protocol}//${hostname}${url.port ? `:${url.port}` : ''}`;
        // Remove sensitive query parameters
        if (url.search) {
          const searchParams = new URLSearchParams(url.search);
          const sensitiveParams = [
            'token',
            'key',
            'secret',
            'password',
            'auth',
            'session',
          ];
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
      sanitized.userId =
        sanitized.userId.length > 0 ? '[USER_ID_PRESENT]' : '[NO_USER_ID]';
    }

    // Sanitize API endpoint to remove sensitive path segments
    if (sanitized.apiEndpoint) {
      // Replace long IDs (12+ chars) with [REDACTED_ID]
      sanitized.apiEndpoint = sanitized.apiEndpoint.replace(
        /\/[a-zA-Z0-9]{12,}/g,
        '/[REDACTED_ID]'
      );
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

    // Sanitize the message before logging
    const sanitizedMessage = this.sanitizeErrorMessage(appError.message);

    // For sync operations and network errors, just log the message without full object details
    if (
      appError.category === ErrorCategory.SYNC_OPERATION ||
      appError.category === ErrorCategory.NETWORK
    ) {
      const operation =
        appError.context?.actionType || appError.category.toLowerCase();
      logger.log(logLevel, `[${operation}] ${sanitizedMessage}`);
    } else {
      logger.log(logLevel, 'Error handled', {
        errorId: appError.id,
        category: appError.category,
        severity: appError.severity,
        code: appError.code,
        message: sanitizedMessage,
        retryable: appError.retryable,
        context: appError.context,
      });
    }
  }

  private getLogLevel(
    severity: ErrorSeverity
  ): 'debug' | 'info' | 'warn' | 'error' {
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
    return (error: KnownError) => {
      return this.handleError(error, {
        category: ErrorCategory.NETWORK,
        context: { actionType: 'network_request' },
      });
    };
  }

  public getStorageErrorHandler() {
    return (error: KnownError) => {
      return this.handleError(error, {
        category: ErrorCategory.STORAGE,
        context: { actionType: 'storage_operation' },
      });
    };
  }

  public getSyncErrorHandler() {
    return (error: KnownError) => {
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
