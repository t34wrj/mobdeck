import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { localStorageService } from '../services/LocalStorageService';
import {
  initializeSyncService,
  startSyncOperation,
} from '../store/thunks/syncThunks';
import { useNetworkStatus } from './useNetworkStatus';

interface InitializationState {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
}

export const useAppInitialization = () => {
  const dispatch = useDispatch<AppDispatch>();
  const networkStatus = useNetworkStatus();
  const [state, setState] = useState<InitializationState>({
    isInitialized: false,
    isInitializing: false,
    error: null,
  });
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      if (state.isInitialized || state.isInitializing) {
        return;
      }

      setState(prev => ({ ...prev, isInitializing: true, error: null }));

      try {
        console.log('[AppInit] Starting app initialization...');

        // Initialize database first
        console.log('[AppInit] Initializing database...');
        try {
          await localStorageService.initialize();
          console.log('[AppInit] Database initialized successfully');
        } catch (dbError) {
          console.error('[AppInit] Database initialization failed:', {
            message: dbError?.message || 'Unknown database error',
            code: dbError?.code,
            stack: dbError?.stack,
            details: dbError,
          });
          throw new Error(
            `Database initialization failed: ${dbError?.message || 'Unknown error'}`
          );
        }

        // Initialize sync service
        console.log('[AppInit] Initializing sync service...');
        await dispatch(initializeSyncService()).unwrap();
        console.log('[AppInit] Sync service initialized successfully');

        setState({
          isInitialized: true,
          isInitializing: false,
          error: null,
        });

        console.log('[AppInit] App initialization completed successfully');
      } catch (error) {
        console.error('[AppInit] App initialization failed:', error);
        setState({
          isInitialized: false,
          isInitializing: false,
          error: error?.message || 'Failed to initialize app',
        });
      }
    };

    initializeApp();
  }, [dispatch, state.isInitialized, state.isInitializing]);

  // Monitor network status and trigger sync when coming back online
  useEffect(() => {
    if (!state.isInitialized) return;

    if (networkStatus.isOnline && wasOffline) {
      console.log(
        '[AppInit] Network came back online, triggering sync for pending operations'
      );
      dispatch(startSyncOperation({}));
      setWasOffline(false);
    } else if (!networkStatus.isOnline && !wasOffline) {
      console.log('[AppInit] Network went offline');
      setWasOffline(true);
    }
  }, [networkStatus.isOnline, wasOffline, state.isInitialized, dispatch]);

  return state;
};
