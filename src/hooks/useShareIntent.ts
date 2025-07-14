import { useEffect, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { ShareService } from '../services/ShareService';
import { SharedData } from '../types';

interface UseShareIntentResult {
  sharedData: SharedData | null;
  isProcessing: boolean;
  error: string | null;
  clearSharedData: () => void;
  processSharedData: () => Promise<void>;
}

export const useShareIntent = (): UseShareIntentResult => {
  const [sharedData, setSharedData] = useState<SharedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processSharedData = useCallback(async () => {
    console.log('useShareIntent: Starting processSharedData...');
    setIsProcessing(true);
    setError(null);

    try {
      console.log('useShareIntent: Calling ShareService.getSharedData()...');
      const data = await ShareService.getSharedData();

      if (data) {
        console.log('useShareIntent: Share intent detected:', data);
        setSharedData(data);
      } else {
        console.log('useShareIntent: No shared data found');
      }
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : 'Failed to process shared data';
      console.error(
        'useShareIntent: Error processing shared data:',
        errorMessage
      );
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
      console.log('useShareIntent: Finished processSharedData');
    }
  }, []);

  const clearSharedData = useCallback(async () => {
    setSharedData(null);
    setError(null);
    await ShareService.clearSharedData();
  }, []);

  // Check for shared data when app becomes active
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        processSharedData();
      }
    };

    // Check immediately when hook is mounted
    processSharedData();

    // Listen for app state changes
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => subscription?.remove();
  }, [processSharedData]);

  return {
    sharedData,
    isProcessing,
    error,
    clearSharedData,
    processSharedData,
  };
};
