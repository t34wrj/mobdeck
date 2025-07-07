import { useEffect, useState } from 'react';
import { readeckApiService } from '../services/ReadeckApiService';

interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean;
}

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