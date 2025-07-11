/**
 * Unit tests for RetryManager
 * Testing retry logic and exponential backoff
 */

import { RetryManager, RetryOptions, RetryContext } from '../../src/utils/retryManager';

describe('RetryManager', () => {
  let retryManager: RetryManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    retryManager = new RetryManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Retry Operations', () => {
    it('should execute operation successfully on first try', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await retryManager.retry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry failed operations', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');
      
      const resultPromise = retryManager.retry(operation, { maxAttempts: 3 });
      
      // Fast-forward through retries
      await jest.runAllTimersAsync();
      
      const result = await resultPromise;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      const resultPromise = retryManager.retry(operation, { maxAttempts: 3 });
      
      // Fast-forward through all retries
      await jest.runAllTimersAsync();
      
      await expect(resultPromise).rejects.toThrow('Always fails');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use default options when not specified', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const resultPromise = retryManager.retry(operation);
      
      await jest.runAllTimersAsync();
      
      const result = await resultPromise;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Context', () => {
    it('should provide context to operation', async () => {
      const operation = jest.fn().mockImplementation((context: RetryContext) => {
        expect(context.attempt).toBeDefined();
        expect(context.previousError).toBeDefined();
        return Promise.resolve(`Attempt ${context.attempt}`);
      });
      
      const result = await retryManager.retry(operation);
      
      expect(result).toBe('Attempt 1');
      expect(operation).toHaveBeenCalledWith({
        attempt: 1,
        previousError: null,
      });
    });

    it('should increment attempt number on retries', async () => {
      const attempts: number[] = [];
      const operation = jest.fn().mockImplementation((context: RetryContext) => {
        attempts.push(context.attempt);
        if (context.attempt < 3) {
          return Promise.reject(new Error(`Fail ${context.attempt}`));
        }
        return Promise.resolve('success');
      });
      
      const resultPromise = retryManager.retry(operation, { maxAttempts: 5 });
      
      await jest.runAllTimersAsync();
      
      await resultPromise;
      
      expect(attempts).toEqual([1, 2, 3]);
    });

    it('should provide previous error in context', async () => {
      const errors: Array<Error | null> = [];
      const operation = jest.fn().mockImplementation((context: RetryContext) => {
        errors.push(context.previousError);
        if (context.attempt === 1) {
          return Promise.reject(new Error('First error'));
        }
        return Promise.resolve('success');
      });
      
      const resultPromise = retryManager.retry(operation);
      
      await jest.runAllTimersAsync();
      
      await resultPromise;
      
      expect(errors[0]).toBeNull();
      expect(errors[1]?.message).toBe('First error');
    });
  });

  describe('Exponential Backoff', () => {
    it('should use exponential backoff', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const options: RetryOptions = {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
      };
      
      retryManager.retry(operation, options);
      
      // First attempt - immediate
      expect(operation).toHaveBeenCalledTimes(1);
      
      // Second attempt after 100ms
      await jest.advanceTimersByTimeAsync(100);
      expect(operation).toHaveBeenCalledTimes(2);
      
      // Third attempt after 200ms more (100 * 2)
      await jest.advanceTimersByTimeAsync(200);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect max delay', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      const options: RetryOptions = {
        maxAttempts: 5,
        initialDelay: 100,
        maxDelay: 300,
        backoffMultiplier: 3,
      };
      
      retryManager.retry(operation, options).catch(() => {});
      
      // First retry: 100ms
      await jest.advanceTimersByTimeAsync(100);
      expect(operation).toHaveBeenCalledTimes(2);
      
      // Second retry: 300ms (would be 300ms but capped)
      await jest.advanceTimersByTimeAsync(300);
      expect(operation).toHaveBeenCalledTimes(3);
      
      // Third retry: 300ms (capped again)
      await jest.advanceTimersByTimeAsync(300);
      expect(operation).toHaveBeenCalledTimes(4);
    });

    it('should add jitter when enabled', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      const options: RetryOptions = {
        maxAttempts: 3,
        initialDelay: 1000,
        jitter: true,
      };
      
      // Spy on Math.random to control jitter
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      
      retryManager.retry(operation, options).catch(() => {});
      
      // With jitter at 0.5, delay should be 1000 * 0.75 = 750ms
      await jest.advanceTimersByTimeAsync(750);
      expect(operation).toHaveBeenCalledTimes(2);
      
      randomSpy.mockRestore();
    });
  });

  describe('Retry Conditions', () => {
    it('should check if error is retryable', async () => {
      const shouldRetry = jest.fn().mockImplementation((error: Error) => {
        return error.message !== 'Fatal error';
      });
      
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Fatal error'));
      
      const options: RetryOptions = {
        maxAttempts: 5,
        shouldRetry,
      };
      
      const resultPromise = retryManager.retry(operation, options);
      
      await jest.runAllTimersAsync();
      
      await expect(resultPromise).rejects.toThrow('Fatal error');
      
      // Should stop after fatal error
      expect(operation).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledTimes(2);
    });

    it('should not retry when shouldRetry returns false', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Error'));
      const shouldRetry = jest.fn().mockReturnValue(false);
      
      const options: RetryOptions = {
        maxAttempts: 3,
        shouldRetry,
      };
      
      await expect(retryManager.retry(operation, options)).rejects.toThrow('Error');
      
      expect(operation).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
    });

    it('should handle shouldRetry exceptions', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Error'));
      const shouldRetry = jest.fn().mockImplementation(() => {
        throw new Error('shouldRetry error');
      });
      
      const options: RetryOptions = {
        maxAttempts: 3,
        shouldRetry,
      };
      
      await expect(retryManager.retry(operation, options)).rejects.toThrow('Error');
      
      // Should treat exception as false and not retry
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Callbacks', () => {
    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const options: RetryOptions = {
        maxAttempts: 3,
        onRetry,
      };
      
      const resultPromise = retryManager.retry(operation, options);
      
      await jest.runAllTimersAsync();
      
      await resultPromise;
      
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        2,
        expect.any(Number)
      );
    });

    it('should handle onRetry exceptions', async () => {
      const onRetry = jest.fn().mockImplementation(() => {
        throw new Error('onRetry error');
      });
      
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const options: RetryOptions = {
        maxAttempts: 2,
        onRetry,
      };
      
      const resultPromise = retryManager.retry(operation, options);
      
      await jest.runAllTimersAsync();
      
      // Should continue despite onRetry error
      const result = await resultPromise;
      expect(result).toBe('success');
    });
  });

  describe('Abort Controller', () => {
    it('should abort retry operation', async () => {
      const operation = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'success';
      });
      
      const abortController = new AbortController();
      const options: RetryOptions = {
        signal: abortController.signal,
      };
      
      const resultPromise = retryManager.retry(operation, options);
      
      // Abort after starting
      setTimeout(() => abortController.abort(), 100);
      
      await jest.runAllTimersAsync();
      
      await expect(resultPromise).rejects.toThrow('aborted');
    });

    it('should not retry after abort', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Fail'));
      const abortController = new AbortController();
      
      const options: RetryOptions = {
        maxAttempts: 5,
        signal: abortController.signal,
      };
      
      const resultPromise = retryManager.retry(operation, options);
      
      // Let first attempt fail
      await jest.advanceTimersByTimeAsync(100);
      
      // Abort before retry
      abortController.abort();
      
      await jest.runAllTimersAsync();
      
      await expect(resultPromise).rejects.toThrow();
      
      // Should only have attempted once
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Special Cases', () => {
    it('should handle synchronous operations', async () => {
      const operation = jest.fn().mockReturnValue('sync result');
      
      const result = await retryManager.retry(operation);
      
      expect(result).toBe('sync result');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle zero max attempts', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const options: RetryOptions = {
        maxAttempts: 0,
      };
      
      await expect(retryManager.retry(operation, options)).rejects.toThrow();
      expect(operation).not.toHaveBeenCalled();
    });

    it('should handle negative max attempts', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const options: RetryOptions = {
        maxAttempts: -1,
      };
      
      await expect(retryManager.retry(operation, options)).rejects.toThrow();
      expect(operation).not.toHaveBeenCalled();
    });

    it('should handle very large delays', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const options: RetryOptions = {
        initialDelay: Number.MAX_SAFE_INTEGER,
        maxAttempts: 2,
      };
      
      const resultPromise = retryManager.retry(operation, options);
      
      // Should cap to reasonable delay
      await jest.advanceTimersByTimeAsync(60000); // 1 minute max
      
      await resultPromise;
      
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Patterns', () => {
    it('should support custom backoff strategy', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const options: RetryOptions = {
        maxAttempts: 3,
        getDelay: (attempt) => attempt * 50, // Linear backoff
      };
      
      retryManager.retry(operation, options);
      
      // First retry after 50ms
      await jest.advanceTimersByTimeAsync(50);
      expect(operation).toHaveBeenCalledTimes(2);
      
      // Second retry after 100ms
      await jest.advanceTimersByTimeAsync(100);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should support constant delay', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const options: RetryOptions = {
        maxAttempts: 2,
        backoffMultiplier: 1, // Constant delay
        initialDelay: 200,
      };
      
      retryManager.retry(operation, options);
      
      await jest.advanceTimersByTimeAsync(200);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});