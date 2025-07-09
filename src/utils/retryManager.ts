import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

interface RetryState {
  attempts: number;
  lastError: any;
  nextDelay: number;
}

export class RetryManager {
  private static defaultOptions: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    retryCondition: (error) => {
      // Retry on network errors and 5xx errors
      return error.code === 'CONNECTION_ERROR' ||
             error.code === 'ECONNREFUSED' ||
             error.code === 'TIMEOUT_ERROR' ||
             (error.response?.status >= 500 && error.response?.status < 600);
    },
    onRetry: () => {},
  };
  
  /**
   * Execute a function with exponential backoff retry logic
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    const state: RetryState = {
      attempts: 0,
      lastError: null,
      nextDelay: opts.initialDelay,
    };
    
    while (state.attempts <= opts.maxRetries) {
      try {
        // If not the first attempt, wait before retrying
        if (state.attempts > 0) {
          logger.debug(`[RetryManager] Waiting ${state.nextDelay}ms before retry attempt ${state.attempts}`);
          await this.delay(state.nextDelay);
        }
        
        // Try to execute the function
        const result = await fn();
        
        // Success! Reset any retry state if needed
        if (state.attempts > 0) {
          logger.info(`[RetryManager] Succeeded after ${state.attempts} retries`);
        }
        
        return result;
      } catch (error) {
        state.lastError = error;
        state.attempts++;
        
        // Check if we should retry
        if (state.attempts > opts.maxRetries || !opts.retryCondition(error)) {
          logger.warn(`[RetryManager] Failed after ${state.attempts} attempts: ${error.message || error}`);
          throw error;
        }
        
        // Call onRetry callback
        opts.onRetry(error, state.attempts);
        
        // Calculate next delay with exponential backoff
        state.nextDelay = Math.min(
          state.nextDelay * opts.backoffMultiplier,
          opts.maxDelay
        );
        
        logger.debug(`[RetryManager] Attempt ${state.attempts} failed, will retry in ${state.nextDelay}ms: ${error.message || error}`);
      }
    }
    
    // This should never be reached, but just in case
    throw state.lastError;
  }
  
  /**
   * Create a retry wrapper for a specific function
   */
  static createRetryWrapper<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: RetryOptions = {}
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.withRetry(() => fn(...args), options);
    }) as T;
  }
  
  /**
   * Calculate delay for a specific attempt number
   */
  static calculateDelay(
    attempt: number,
    options: Pick<RetryOptions, 'initialDelay' | 'maxDelay' | 'backoffMultiplier'> = {}
  ): number {
    const opts = { ...this.defaultOptions, ...options };
    const delay = opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1);
    return Math.min(delay, opts.maxDelay);
  }
  
  /**
   * Check if an error is retryable based on default conditions
   */
  static isRetryableError(error: any): boolean {
    return this.defaultOptions.retryCondition(error);
  }
  
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Decorator for adding retry logic to async methods
 */
export function WithRetry(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return RetryManager.withRetry(
        () => originalMethod.apply(this, args),
        options
      );
    };
    
    return descriptor;
  };
}