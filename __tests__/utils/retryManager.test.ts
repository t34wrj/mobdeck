/**
 * Unit tests for RetryManager
 * Testing retry logic and exponential backoff
 */

import { RetryManager, RetryOptions, RetryContext, WithRetry } from '../../src/utils/retryManager';

describe('RetryManager', () => {
  let retryManager: RetryManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    retryManager = new RetryManager();
    // Mock console methods for cleaner test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      
      const result = await retryManager.retry(operation, { 
        maxAttempts: 3,
        initialDelay: 1 // Very short delay for testing
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new Error('Always fails'));
      
      await expect(retryManager.retry(operation, { 
        maxAttempts: 3,
        initialDelay: 1
      })).rejects.toThrow('Always fails');
      
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use default options when not specified', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const result = await retryManager.retry(operation, { initialDelay: 1 });
      
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
      
      // Expect the promise to reject with the fatal error
      try {
        await resultPromise;
        fail('Expected promise to reject');
      } catch (error) {
        expect(error.message).toBe('Fatal error');
      }
      
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
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success');
      
      const abortController = new AbortController();
      const options: RetryOptions = {
        signal: abortController.signal,
        maxAttempts: 3,
      };
      
      const resultPromise = retryManager.retry(operation, options);
      
      // Abort during the retry delay
      setTimeout(() => abortController.abort(), 500);
      
      await jest.runAllTimersAsync();
      
      // Expect the promise to reject with abort error
      try {
        await resultPromise;
        fail('Expected promise to reject');
      } catch (error) {
        expect(error.message).toBe('aborted');
      }
    });

    it('should not retry after abort', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Fail'));
      const abortController = new AbortController();
      
      const options: RetryOptions = {
        maxAttempts: 5,
        signal: abortController.signal,
      };
      
      const resultPromise = retryManager.retry(operation, options);
      
      // Let first attempt fail, then abort
      await jest.advanceTimersByTimeAsync(100);
      abortController.abort();
      
      await jest.runAllTimersAsync();
      
      // Expect the promise to reject with abort error
      try {
        await resultPromise;
        fail('Expected promise to reject');
      } catch (error) {
        expect(error.message).toBe('aborted');
      }
      
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

  describe('Static Methods', () => {
    describe('withRetry', () => {
      it('should execute function with retry logic', async () => {
        const fn = jest.fn()
          .mockRejectedValueOnce(new Error('Fail'))
          .mockResolvedValue('success');

        const result = await RetryManager.withRetry(fn, { maxRetries: 2 });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should handle default retry conditions', async () => {
        const networkError = new Error('Network error');
        networkError.code = 'CONNECTION_ERROR';
        
        const fn = jest.fn()
          .mockRejectedValueOnce(networkError)
          .mockResolvedValue('success');

        const result = await RetryManager.withRetry(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should not retry non-retryable errors', async () => {
        const nonRetryableError = new Error('Client error');
        
        const fn = jest.fn().mockRejectedValue(nonRetryableError);

        await expect(RetryManager.withRetry(fn, { maxRetries: 3 })).rejects.toThrow('Client error');
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should handle 5xx server errors', async () => {
        const serverError = new Error('Server error');
        serverError.response = { status: 500 };
        
        const fn = jest.fn()
          .mockRejectedValueOnce(serverError)
          .mockResolvedValue('success');

        const result = await RetryManager.withRetry(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should handle timeout errors', async () => {
        const timeoutError = new Error('Timeout');
        timeoutError.code = 'TIMEOUT_ERROR';
        
        const fn = jest.fn()
          .mockRejectedValueOnce(timeoutError)
          .mockResolvedValue('success');

        const result = await RetryManager.withRetry(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should handle connection refused errors', async () => {
        const connectionError = new Error('Connection refused');
        connectionError.code = 'ECONNREFUSED';
        
        const fn = jest.fn()
          .mockRejectedValueOnce(connectionError)
          .mockResolvedValue('success');

        const result = await RetryManager.withRetry(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should not retry 404 errors but log appropriately', async () => {
        const notFoundError = new Error('Not found');
        notFoundError.status = 404;
        
        const fn = jest.fn().mockRejectedValue(notFoundError);

        await expect(RetryManager.withRetry(fn, { maxRetries: 3 })).rejects.toThrow('Not found');
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should handle 404 in error message', async () => {
        const notFoundError = new Error('Resource 404 not found');
        
        const fn = jest.fn().mockRejectedValue(notFoundError);

        await expect(RetryManager.withRetry(fn, { maxRetries: 3 })).rejects.toThrow('Resource 404 not found');
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });

    describe('createRetryWrapper', () => {
      it('should create a retry wrapper function', async () => {
        const originalFn = jest.fn()
          .mockRejectedValueOnce(new Error('Fail'))
          .mockResolvedValue('success');

        const wrappedFn = RetryManager.createRetryWrapper(originalFn, { maxRetries: 2 });
        
        const result = await wrappedFn('arg1', 'arg2');

        expect(result).toBe('success');
        expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
        expect(originalFn).toHaveBeenCalledTimes(2);
      });

      it('should preserve function arguments', async () => {
        const originalFn = jest.fn().mockResolvedValue('success');
        const wrappedFn = RetryManager.createRetryWrapper(originalFn);
        
        await wrappedFn('test', 123, { prop: 'value' });

        expect(originalFn).toHaveBeenCalledWith('test', 123, { prop: 'value' });
      });
    });

    describe('calculateDelay', () => {
      it('should calculate exponential backoff delay', () => {
        const delay1 = RetryManager.calculateDelay(1, { initialDelay: 100, backoffMultiplier: 2 });
        const delay2 = RetryManager.calculateDelay(2, { initialDelay: 100, backoffMultiplier: 2 });
        const delay3 = RetryManager.calculateDelay(3, { initialDelay: 100, backoffMultiplier: 2 });

        expect(delay1).toBe(100);
        expect(delay2).toBe(200);
        expect(delay3).toBe(400);
      });

      it('should respect max delay', () => {
        const delay = RetryManager.calculateDelay(10, { 
          initialDelay: 100, 
          backoffMultiplier: 2, 
          maxDelay: 500 
        });

        expect(delay).toBe(500);
      });

      it('should use default options when not provided', () => {
        const delay = RetryManager.calculateDelay(2);
        
        expect(delay).toBe(2000); // 1000 * 2^(2-1)
      });
    });

    describe('isRetryableError', () => {
      it('should identify retryable connection errors', () => {
        const connectionError = new Error('Connection failed');
        connectionError.code = 'CONNECTION_ERROR';

        expect(RetryManager.isRetryableError(connectionError)).toBe(true);
      });

      it('should identify retryable timeout errors', () => {
        const timeoutError = new Error('Timeout');
        timeoutError.code = 'TIMEOUT_ERROR';

        expect(RetryManager.isRetryableError(timeoutError)).toBe(true);
      });

      it('should identify retryable server errors', () => {
        const serverError = new Error('Internal server error');
        serverError.response = { status: 500 };

        expect(RetryManager.isRetryableError(serverError)).toBe(true);
      });

      it('should not identify client errors as retryable', () => {
        const clientError = new Error('Bad request');
        clientError.response = { status: 400 };

        expect(RetryManager.isRetryableError(clientError)).toBe(false);
      });

      it('should handle errors without response', () => {
        const error = new Error('Generic error');

        expect(RetryManager.isRetryableError(error)).toBe(false);
      });
    });
  });

  describe('WithRetry Decorator', () => {
    it('should exist and be a function', () => {
      expect(typeof WithRetry).toBe('function');
    });

    it('should return a decorator function', () => {
      const decorator = WithRetry({ maxRetries: 2 });
      expect(typeof decorator).toBe('function');
    });

    it('should modify descriptor when applied', () => {
      const originalMethod = jest.fn().mockResolvedValue('success');
      const descriptor = { value: originalMethod };
      const target = {};
      const propertyKey = 'testMethod';

      const decorator = WithRetry({ maxRetries: 2 });
      const result = decorator(target, propertyKey, descriptor);

      expect(result).toBe(descriptor);
      expect(descriptor.value).not.toBe(originalMethod);
      expect(typeof descriptor.value).toBe('function');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle very long retry chains', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockRejectedValueOnce(new Error('Fail 4'))
        .mockRejectedValueOnce(new Error('Fail 5'))
        .mockResolvedValue('success');

      const options: RetryOptions = {
        maxAttempts: 6,
        initialDelay: 10
      };

      const resultPromise = retryManager.retry(operation, options);
      await jest.runAllTimersAsync();
      
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(6);
    });

    it('should handle undefined maxRetries in static withRetry', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('CONNECTION_ERROR'))
        .mockResolvedValue('success');
      
      // Should use default maxRetries
      const result = await RetryManager.withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle retryCondition precedence over shouldRetry', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Non-retryable'));
      
      const options: RetryOptions = {
        maxAttempts: 3,
        retryCondition: () => false, // Never retry
        shouldRetry: () => true // Always retry (should be ignored)
      };

      const resultPromise = retryManager.retry(operation, options);
      await jest.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('Non-retryable');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed maxRetries and maxAttempts options', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');

      // maxAttempts should take precedence
      const options: RetryOptions = {
        maxRetries: 5,
        maxAttempts: 2
      };

      const resultPromise = retryManager.retry(operation, options);
      await jest.runAllTimersAsync();
      
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle operation that throws during context creation', async () => {
      const operation = jest.fn().mockImplementation(() => {
        throw new Error('Immediate failure');
      });

      const resultPromise = retryManager.retry(operation, { maxAttempts: 3 });
      await jest.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('Immediate failure');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should handle delay capping edge case', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');

      const options: RetryOptions = {
        maxAttempts: 2,
        initialDelay: 100000, // Large initial delay
        backoffMultiplier: 10
      };

      const resultPromise = retryManager.retry(operation, options);
      
      // Should cap to 1 minute
      await jest.advanceTimersByTimeAsync(60000);
      
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    }, 70000);
  });
});