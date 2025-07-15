/**
 * Simple Error Handling for Mobile App
 * Basic error classification and user-friendly messaging
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  VALIDATION = 'VALIDATION',
  STORAGE = 'STORAGE',
  SYNC = 'SYNC',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
}

export function classifyError(error: unknown): ErrorType {
  const message = getErrorMessage(error).toLowerCase();
  
  if (message.includes('network') || message.includes('fetch')) {
    return ErrorType.NETWORK;
  }
  if (message.includes('unauthorized') || message.includes('auth')) {
    return ErrorType.AUTH;
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorType.VALIDATION;
  }
  if (message.includes('storage') || message.includes('database')) {
    return ErrorType.STORAGE;
  }
  if (message.includes('sync')) {
    return ErrorType.SYNC;
  }
  
  return ErrorType.UNKNOWN;
}

export function createAppError(error: unknown): AppError {
  const type = classifyError(error);
  const message = getErrorMessage(error);
  
  return {
    type,
    message,
    userMessage: getUserFriendlyMessage(type),
    retryable: isRetryable(type)
  };
}

function getUserFriendlyMessage(type: ErrorType): string {
  switch (type) {
    case ErrorType.NETWORK:
      return 'Network connection failed. Please check your internet connection and try again.';
    case ErrorType.AUTH:
      return 'Authentication failed. Please check your credentials and try again.';
    case ErrorType.VALIDATION:
      return 'Invalid input. Please check your data and try again.';
    case ErrorType.STORAGE:
      return 'Storage error. Please try again.';
    case ErrorType.SYNC:
      return 'Sync failed. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function isRetryable(type: ErrorType): boolean {
  return type === ErrorType.NETWORK || type === ErrorType.SYNC;
}

export function handleError(error: unknown): AppError {
  const appError = createAppError(error);
  
  // Simple logging for development
  if (__DEV__) {
    console.error('App Error:', appError);
  }
  
  return appError;
}