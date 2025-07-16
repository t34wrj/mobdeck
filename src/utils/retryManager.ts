/**
 * Simple Retry Utility for Mobile App
 * Basic retry logic with exponential backoff
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxRetries) {
        throw lastError;
      }

      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('network') ||
      error.message.includes('timeout') ||
      error.message.includes('connection')
    );
  }
  return false;
}

export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoff: number;
}

export interface RetryManagerOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: number;
  shouldRetry?: (error: any) => boolean;
}

export class RetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: config.maxAttempts || 3,
      delay: config.delay || 1000,
      backoff: config.backoff || 2,
    };
  }

  async execute<T>(
    operation: () => Promise<T>,
    options: RetryManagerOptions = {}
  ): Promise<T> {
    const maxAttempts = options.maxAttempts || this.config.maxAttempts;
    const delay = options.delay || this.config.delay;
    const backoff = options.backoff || this.config.backoff;
    const shouldRetry = options.shouldRetry || this.defaultShouldRetry;

    let attempt = 0;
    let lastError: any;

    while (attempt < maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt >= maxAttempts || !shouldRetry(error)) {
          throw error;
        }

        // Wait before retrying
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        await this.sleep(waitTime);
      }
    }

    throw lastError;
  }

  private defaultShouldRetry(error: any): boolean {
    // Retry on network errors, timeouts, and server errors
    if (
      error?.code === 'NETWORK_ERROR' ||
      error?.code === 'TIMEOUT_ERROR' ||
      error?.status >= 500
    ) {
      return true;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
