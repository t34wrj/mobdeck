import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: any) => boolean;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number, delay?: number) => void;
  jitter?: boolean;
  getDelay?: (attempt: number) => number;
  signal?: AbortSignal;
}

export interface RetryContext {
  attempt: number;
  previousError: any;
}

interface RetryState {
  attempts: number;
  lastError: any;
  nextDelay: number;
}

export class RetryManager {
  private static defaultOptions: Required<RetryOptions> = {
    maxRetries: 3,
    maxAttempts: 3,
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
    shouldRetry: () => true, // Default to retry all errors unless explicitly overridden
    onRetry: () => {},
    jitter: false,
    getDelay: undefined,
    signal: undefined,
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
          // Only log as warning if it's not a 404 error (which may be expected)
          const is404 = error.message?.includes('404') || error.status === 404;
          if (is404) {
            logger.debug(`[RetryManager] Resource not found after ${state.attempts} attempts: ${error.message || error}`);
          } else {
            logger.warn(`[RetryManager] Failed after ${state.attempts} attempts: ${error.message || error}`);
          }
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

  /**
   * Instance method to retry operations with context
   */
  async retry<T>(
    operation: (context?: RetryContext) => T | Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...RetryManager.defaultOptions, ...options };
    const maxAttempts = opts.maxAttempts ?? opts.maxRetries ?? 3;
    
    // Handle invalid max attempts
    if (maxAttempts <= 0) {
      throw new Error('Max attempts must be greater than 0');
    }
    
    let attempt = 0;
    let previousError: any = null;
    
    while (attempt < maxAttempts) {
      attempt++;
      
      // Check if operation was aborted
      if (opts.signal?.aborted) {
        throw new Error('aborted');
      }
      
      try {
        const context: RetryContext = {
          attempt,
          previousError,
        };
        
        const result = await Promise.resolve(operation(context));
        
        // Success!
        if (attempt > 1) {
          logger.info(`[RetryManager] Succeeded after ${attempt - 1} retries`);
        }
        
        return result;
      } catch (error) {
        // Check if we should retry this error
        let shouldRetryResult = true;
        
        if (opts.shouldRetry) {
          try {
            shouldRetryResult = opts.shouldRetry(error);
          } catch (e) {
            // If shouldRetry throws, treat as false
            shouldRetryResult = false;
          }
        } else {
          // Use default retry logic from retryCondition if no shouldRetry is provided
          shouldRetryResult = opts.retryCondition ? opts.retryCondition(error) : true;
        }
        
        // If this is the last attempt or we shouldn't retry, throw the error
        if (attempt >= maxAttempts || !shouldRetryResult) {
          if (attempt >= maxAttempts) {
            logger.warn(`[RetryManager] Failed after ${attempt} attempts: ${error.message || error}`);
          }
          throw error;
        }
        
        // Calculate delay for next retry
        let delay: number;
        if (opts.getDelay) {
          delay = opts.getDelay(attempt);
        } else {
          // For exponential backoff, use attempt number starting from 1 for the first retry
          delay = opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1);
          delay = Math.min(delay, opts.maxDelay);
          
          // Cap very large delays to 1 minute
          if (delay > 60000) {
            delay = 60000;
          }
        }
        
        // Add jitter if enabled
        if (opts.jitter) {
          const jitterFactor = 0.5 + Math.random() * 0.5; // 0.5 to 1.0
          delay = Math.floor(delay * jitterFactor);
        }
        
        // Call onRetry callback with next attempt number
        if (opts.onRetry) {
          try {
            opts.onRetry(error, attempt + 1, delay);
          } catch (e) {
            // Continue even if onRetry throws
          }
        }
        
        logger.debug(`[RetryManager] Attempt ${attempt} failed, will retry in ${delay}ms: ${error.message || error}`);
        
        // Set previous error for next attempt
        previousError = error;
        
        // Wait before retrying
        await this.delay(delay);
        
        // Check if operation was aborted during delay
        if (opts.signal?.aborted) {
          throw new Error('aborted');
        }
      }
    }
    
    // This should never be reached, but just in case
    throw new Error('Max attempts reached');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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