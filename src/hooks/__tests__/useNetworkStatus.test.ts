/**
 * Tests for useNetworkStatus hook
 */

import { renderHook, act } from '@testing-library/react-native';
import { useNetworkStatus } from '../useNetworkStatus';
import { readeckApiService } from '../../services/ReadeckApiService';

// Mock the ReadeckApiService
jest.mock('../../services/ReadeckApiService', () => ({
  readeckApiService: {
    isOnline: jest.fn(),
    getNetworkState: jest.fn(),
  },
}));

const mockReadeckApiService = readeckApiService as jest.Mocked<
  typeof readeckApiService
>;

describe('useNetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock implementations
    mockReadeckApiService.isOnline.mockReturnValue(true);
    mockReadeckApiService.getNetworkState.mockReturnValue({
      isConnected: true,
      isOnline: true,
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial network status', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current).toEqual({
      isOnline: true,
      isConnected: true,
    });
  });

  it('should call readeckApiService methods on mount', () => {
    renderHook(() => useNetworkStatus());

    expect(mockReadeckApiService.isOnline).toHaveBeenCalled();
    expect(mockReadeckApiService.getNetworkState).toHaveBeenCalled();
  });

  it('should update status when network state changes', () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Initial state
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isConnected).toBe(true);

    // Mock offline state
    mockReadeckApiService.isOnline.mockReturnValue(false);
    mockReadeckApiService.getNetworkState.mockReturnValue({
      isConnected: false,
      isOnline: false,
      isAuthenticated: false,
    });

    // Advance timers to trigger the interval
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isConnected).toBe(false);
  });

  it('should handle different combinations of online/connected states', () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Test case: Connected but not online (server unreachable)
    mockReadeckApiService.isOnline.mockReturnValue(false);
    mockReadeckApiService.getNetworkState.mockReturnValue({
      isConnected: true,
      isOnline: false,
      isAuthenticated: false,
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isConnected).toBe(true);
  });

  it('should poll network status every 5 seconds', () => {
    renderHook(() => useNetworkStatus());

    // Initial call
    expect(mockReadeckApiService.isOnline).toHaveBeenCalledTimes(1);
    expect(mockReadeckApiService.getNetworkState).toHaveBeenCalledTimes(1);

    // After 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockReadeckApiService.isOnline).toHaveBeenCalledTimes(2);
    expect(mockReadeckApiService.getNetworkState).toHaveBeenCalledTimes(2);

    // After another 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockReadeckApiService.isOnline).toHaveBeenCalledTimes(3);
    expect(mockReadeckApiService.getNetworkState).toHaveBeenCalledTimes(3);
  });

  it('should clean up interval on unmount', () => {
    const { unmount } = renderHook(() => useNetworkStatus());

    // Mock clearInterval to spy on cleanup
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });

  it('should handle errors from readeckApiService gracefully', () => {
    mockReadeckApiService.isOnline.mockImplementation(() => {
      throw new Error('Network error');
    });

    // Should not crash when rendering
    expect(() => {
      renderHook(() => useNetworkStatus());
    }).not.toThrow();
  });

  it('should use default state when readeckApiService returns undefined', () => {
    mockReadeckApiService.getNetworkState.mockReturnValue(undefined as any);

    const { result } = renderHook(() => useNetworkStatus());

    // Should still work with some fallback behavior
    expect(result.current).toBeDefined();
    expect(typeof result.current.isOnline).toBe('boolean');
    expect(typeof result.current.isConnected).toBe('boolean');
  });
});
