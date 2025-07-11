import { useEffect, useState } from 'react';
import { readeckApiService } from '../services/ReadeckApiService';

/**
 * Network status information
 */
interface NetworkStatus {
  /** Whether the app is online */
  isOnline: boolean;
  /** Whether connected to the network */
  isConnected: boolean;
}

/**
 * Hook to monitor network connectivity status
 * 
 * @returns NetworkStatus object with connectivity information
 * @example
 * ```tsx
 * const { isOnline, isConnected } = useNetworkStatus();
 * 
 * if (!isOnline) {
 *   return <OfflineBanner />;
 * }
 * ```
 */
export const useNetworkStatus = (): NetworkStatus => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: true,
    isConnected: true,
  });

  useEffect(() => {
    const updateNetworkStatus = () => {
      const isOnline = readeckApiService.isOnline();
      const networkState = readeckApiService.getNetworkState();
      
      setNetworkStatus({
        isOnline,
        isConnected: networkState.isConnected,
      });
    };

    // Initial check
    updateNetworkStatus();

    // For now, we'll check periodically
    // TODO: Implement proper network monitoring with NetInfo
    const interval = setInterval(updateNetworkStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  return networkStatus;
};