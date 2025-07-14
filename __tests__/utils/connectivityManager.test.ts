/**
 * Unit tests for ConnectivityManager
 * Testing network state management and monitoring
 */

import NetInfo from '@react-native-community/netinfo';
import { connectivityManager, ConnectivityStatus } from '../../src/utils/connectivityManager';
import { NetworkType } from '../../src/types/sync';

// Mock NetInfo
jest.mock('@react-native-community/netinfo');

describe('ConnectivityManager', () => {
  const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;
  let unsubscribe: jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribe = jest.fn();
    
    // Mock NetInfo methods
    mockNetInfo.addEventListener.mockReturnValue(unsubscribe);
    mockNetInfo.fetch.mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: {
        isConnectionExpensive: false,
        cellularGeneration: null,
        ipAddress: '192.168.1.100',
        subnet: '255.255.255.0',
      },
    } as any);
  });

  afterEach(() => {
    // Clean up listeners
    connectivityManager.removeAllListeners();
    
    // Reset the singleton's state for clean test isolation
    // This is needed because ConnectivityManager is a singleton
    (connectivityManager as any).currentStatus = {
      isConnected: false,
      isInternetReachable: false,
      networkType: NetworkType.NONE,
      isConnectionExpensive: false,
    };
  });

  describe('Initialization', () => {
    it('should initialize with default offline state', () => {
      const status = connectivityManager.getStatus();
      const details = connectivityManager.getDetails();
      
      expect(status).toBe(ConnectivityStatus.OFFLINE);
      expect(details.isConnected).toBe(false);
      expect(details.networkType).toBe(NetworkType.NONE);
      expect(details.isInternetReachable).toBe(false);
    });

    it('should start monitoring on first listener', async () => {
      const listener = jest.fn();
      
      connectivityManager.addListener(listener);
      
      expect(mockNetInfo.addEventListener).toHaveBeenCalled();
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockNetInfo.fetch).toHaveBeenCalled();
    });

    it('should not start monitoring multiple times', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      connectivityManager.addListener(listener1);
      connectivityManager.addListener(listener2);
      
      expect(mockNetInfo.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network State Updates', () => {
    it('should update state when network changes', async () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      // Simulate network state change
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      netInfoListener({
        type: 'cellular' as any,
        isConnected: true,
        isInternetReachable: true,
        details: {
          isConnectionExpensive: true,
          cellularGeneration: '4g',
        },
      });
      
      const status = connectivityManager.getStatus();
      const details = connectivityManager.getDetails();
      
      expect(status).toBe(ConnectivityStatus.ONLINE);
      expect(details.isConnected).toBe(true);
      expect(details.networkType).toBe(NetworkType.CELLULAR);
      expect(details.isInternetReachable).toBe(true);
      expect(listener).toHaveBeenCalledWith(details);
    });

    it('should handle WiFi connection', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
      });
      
      const details = connectivityManager.getDetails();
      expect(details.networkType).toBe(NetworkType.WIFI);
    });

    it('should handle cellular connection', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'cellular' as any,
        isConnected: true,
        isInternetReachable: true,
      });
      
      const details = connectivityManager.getDetails();
      expect(details.networkType).toBe(NetworkType.CELLULAR);
    });

    it('should handle ethernet connection', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'ethernet',
        isConnected: true,
        isInternetReachable: true,
      });
      
      const details = connectivityManager.getDetails();
      expect(details.networkType).toBe(NetworkType.ETHERNET);
    });

    it('should handle bluetooth connection', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'bluetooth',
        isConnected: true,
        isInternetReachable: true,
      });
      
      const details = connectivityManager.getDetails();
      expect(details.networkType).toBe(NetworkType.OTHER);
    });

    it('should handle no connection', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'none',
        isConnected: false,
        isInternetReachable: false,
      });
      
      const status = connectivityManager.getStatus();
      const details = connectivityManager.getDetails();
      expect(status).toBe(ConnectivityStatus.OFFLINE);
      expect(details.networkType).toBe(NetworkType.NONE);
      expect(details.isConnected).toBe(false);
    });

    it('should handle unknown connection type', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'unknown',
        isConnected: true,
        isInternetReachable: true,
      });
      
      const details = connectivityManager.getDetails();
      expect(details.networkType).toBe(NetworkType.OTHER);
    });
  });

  describe('Internet Reachability', () => {
    it('should track internet reachability separately from connection', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      // Connected but no internet
      netInfoListener({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: false,
      });
      
      const status = connectivityManager.getStatus();
      const details = connectivityManager.getDetails();
      expect(status).toBe(ConnectivityStatus.OFFLINE);
      expect(details.isConnected).toBe(true);
      expect(details.isInternetReachable).toBe(false);
    });

    it('should handle null internet reachability', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: null,
      });
      
      const details = connectivityManager.getDetails();
      expect(details.isInternetReachable).toBe(false);
    });
  });

  describe('Connection Details', () => {
    it('should track connection expense for cellular', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'cellular' as any,
        isConnected: true,
        isInternetReachable: true,
        details: {
          isConnectionExpensive: true,
          cellularGeneration: '4g',
        },
      });
      
      const details = connectivityManager.getDetails();
      expect(details.isConnectionExpensive).toBe(true);
      expect(details.details?.cellularGeneration).toBe('4g');
    });

    it('should include WiFi details when available', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
        details: {
          ssid: 'TestNetwork',
          ipAddress: '192.168.1.100',
          subnet: '255.255.255.0',
        },
      });
      
      const details = connectivityManager.getDetails();
      expect(details.details?.ssid).toBe('TestNetwork');
      expect(details.details?.ipAddress).toBe('192.168.1.100');
    });
  });

  describe('Listener Management', () => {
    it('should notify all listeners on state change', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      connectivityManager.addListener(listener1);
      connectivityManager.addListener(listener2);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      // Trigger a state change - this should trigger listeners
      netInfoListener({
        type: 'cellular' as any,
        isConnected: true,
        isInternetReachable: true,
        details: {
          isConnectionExpensive: true,
        },
      });
      
      expect(listener1).toHaveBeenCalledTimes(1); // Called for the change
      expect(listener2).toHaveBeenCalledTimes(1); // Called for the change
    });

    it('should remove specific listener', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      connectivityManager.addListener(listener1);
      connectivityManager.addListener(listener2);
      connectivityManager.removeListener(listener1);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      // Trigger a state change to test listeners
      netInfoListener({
        type: 'cellular' as any,
        isConnected: true,
        isInternetReachable: true,
      });
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      connectivityManager.addListener(listener1);
      connectivityManager.addListener(listener2);
      connectivityManager.removeAllListeners();
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      netInfoListener({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
      });
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('should stop monitoring when all listeners removed', () => {
      const listener = jest.fn();
      
      connectivityManager.addListener(listener);
      connectivityManager.removeAllListeners();
      
      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should handle removing non-existent listener', () => {
      const listener = jest.fn();
      
      // Should not throw
      connectivityManager.removeListener(listener);
    });
  });

  describe('Async Operations', () => {
    it('should refresh connection status', async () => {
      mockNetInfo.fetch.mockResolvedValue({
        type: 'cellular' as any,
        isConnected: true,
        isInternetReachable: true,
        details: {
          cellularGeneration: '5g',
        },
      } as any);
      
      await connectivityManager.refresh();
      
      const details = connectivityManager.getDetails();
      expect(details.networkType).toBe(NetworkType.CELLULAR);
      expect(details.details?.cellularGeneration).toBe('5g');
    });

    it('should handle refresh errors', async () => {
      mockNetInfo.fetch.mockRejectedValue(new Error('Network error'));
      
      // Should not throw
      await connectivityManager.refresh();
      
      // Status should remain unchanged
      const status = connectivityManager.getStatus();
      expect(status).toBeDefined();
    });

    it('should wait for connection', async () => {
      // Set up listener first
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      // Start with no connection
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      netInfoListener({
        type: 'none',
        isConnected: false,
        isInternetReachable: false,
      });
      
      // Wait for connection with timeout
      const waitPromise = connectivityManager.waitForConnection(1000);
      
      // Simulate connection after delay
      setTimeout(() => {
        netInfoListener({
          type: 'wifi',
          isConnected: true,
          isInternetReachable: true,
        });
      }, 500);
      
      const connected = await waitPromise;
      expect(connected).toBe(true);
    });

    it('should timeout waiting for connection', async () => {
      // First, override the mock to return disconnected state
      mockNetInfo.fetch.mockResolvedValue({
        type: 'none',
        isConnected: false,
        isInternetReachable: false,
      } as any);
      
      // Set up listener (this will trigger startMonitoring and fetch)
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      // Wait for the async fetch to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify we're actually disconnected before testing timeout
      const status = connectivityManager.getStatus();
      const details = connectivityManager.getDetails();
      expect(status).toBe(ConnectivityStatus.OFFLINE);
      expect(details.isConnected).toBe(false);
      expect(details.isInternetReachable).toBe(false);
      
      const connected = await connectivityManager.waitForConnection(100);
      expect(connected).toBe(false);
    });

    it('should resolve immediately if already connected', async () => {
      // Set up listener first
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      netInfoListener({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
      });
      
      const connected = await connectivityManager.waitForConnection(1000);
      expect(connected).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle NetInfo errors gracefully', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      // Should not throw
      netInfoListener(null);
      netInfoListener(undefined);
      netInfoListener({});
    });

    it('should log errors appropriately', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockNetInfo.fetch.mockRejectedValue(new Error('Test error'));
      
      connectivityManager.refresh();
      
      // Wait for async operation
      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      }, 100);
    });
  });

  describe('Special Cases', () => {
    it('should handle VPN connections', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'vpn',
        isConnected: true,
        isInternetReachable: true,
      });
      
      const details = connectivityManager.getDetails();
      expect(details.networkType).toBe(NetworkType.VPN);
    });

    it('should handle other connection types', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'other',
        isConnected: true,
        isInternetReachable: true,
      });
      
      const details = connectivityManager.getDetails();
      expect(details.networkType).toBe(NetworkType.OTHER);
    });

    it('should provide connection type string', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
      });
      
      const typeString = connectivityManager.getConnectionTypeString();
      expect(typeString).toBe('WiFi');
    });

    it('should check if connection is expensive', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'cellular' as any,
        isConnected: true,
        isInternetReachable: true,
        details: {
          isConnectionExpensive: true,
        },
      });
      
      expect(connectivityManager.isConnectionExpensive()).toBe(true);
    });

    it('should check if on WiFi', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
      });
      
      expect(connectivityManager.isWifi()).toBe(true);
      expect(connectivityManager.isCellular()).toBe(false);
    });

    it('should check if on cellular', () => {
      const listener = jest.fn();
      connectivityManager.addListener(listener);
      
      const netInfoListener = mockNetInfo.addEventListener.mock.calls[0][0];
      
      netInfoListener({
        type: 'cellular' as any,
        isConnected: true,
        isInternetReachable: true,
      });
      
      expect(connectivityManager.isCellular()).toBe(true);
      expect(connectivityManager.isWifi()).toBe(false);
    });
  });
});