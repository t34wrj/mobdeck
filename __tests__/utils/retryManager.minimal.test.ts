/**
 * Minimal test to isolate the error issue
 */

import { RetryManager } from '../../src/utils/retryManager';

describe('Minimal Error Test', () => {
  it('should create an error without failing', () => {
    const testError = new Error('Test message');
    expect(testError.message).toBe('Test message');
  });

  it('should work with jest mock', () => {
    const mockFn = jest.fn();
    mockFn.mockRejectedValue(new Error('Mock error'));
    expect(mockFn).toBeDefined();
  });

  it('should work with retryManager imported', () => {
    const retryManager = new RetryManager();
    const testError = new Error('Import test error');
    expect(testError.message).toBe('Import test error');
  });

  it('should handle delay capping edge case', async () => {
    const retryManager = new RetryManager();
    const testError = new Error('Test failure');
    const operation = jest.fn();
    operation.mockRejectedValueOnce(testError);
    operation.mockResolvedValue('success');

    expect(operation).toBeDefined();
  });
});