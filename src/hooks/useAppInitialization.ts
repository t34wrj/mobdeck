import { useEffect, useState } from 'react';
import { useAppDispatch } from '../store';
import { localStorageService } from '../services/LocalStorageService';
import {
  initializeSyncService,
  startSyncOperation,
} from '../store/thunks/syncThunks';
import { loadLocalArticles } from '../store/slices/articlesSlice';
import { useNetworkStatus } from './useNetworkStatus';

interface InitializationState {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
}

export const useAppInitialization = () => {
  const dispatch = useAppDispatch();
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

        // Load cached articles from database into Redux store
        console.log('[AppInit] Loading cached articles from database...');
        try {
          const loadResult = await dispatch(loadLocalArticles({}));
          if (loadResult.meta.requestStatus === 'fulfilled') {
            const articlesCount = loadResult.payload.items.length;
            console.log(`[AppInit] Loaded ${articlesCount} cached articles from database`);
          } else {
            console.log('[AppInit] No cached articles found in database');
          }
        } catch (loadError) {
          console.warn('[AppInit] Failed to load cached articles:', loadError);
          // Don't throw error - this is not critical for app startup
        }

        // Initialize sync service
        console.log('[AppInit] Initializing sync service...');
        const syncResult = await dispatch(initializeSyncService());
        if (syncResult.meta.requestStatus === 'rejected') {
          throw new Error(syncResult.error?.message || 'Sync service initialization failed');
        }
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
