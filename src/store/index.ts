import { configureStore, ConfigureStoreOptions } from '@reduxjs/toolkit';
import { useDispatch, TypedUseSelectorHook, useSelector } from 'react-redux';
import articlesReducer from './slices/articlesSlice';
import authReducer from './slices/authSlice';
import syncReducer from './slices/syncSlice';
import {
  loggerMiddleware,
  errorHandlerMiddleware,
  performanceMiddleware,
} from './middleware';

// Root reducer configuration
const rootReducer = {
  articles: articlesReducer,
  auth: authReducer,
  sync: syncReducer,
};

// Store configuration
const storeConfig: ConfigureStoreOptions = {
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      // Configure RTK default middleware with performance optimizations
      serializableCheck: {
        // Ignore specific action types if needed
        ignoredActions: [],
        // Ignore specific paths in state/actions
        ignoredActionsPaths: ['meta.requestId', 'meta.requestStatus'],
        ignoredPaths: ['articles.items.content', 'auth.user'],
        // Reduce check frequency to improve performance
        warnAfter: 128,
      },
      // Optimize immutability check for large state objects
      immutableCheck: __DEV__ ? {
        warnAfter: 128,
        ignoredPaths: ['articles.items.content'],
      } : false,
    }).concat(
      // Add custom middleware
      errorHandlerMiddleware,
      ...(__DEV__ ? [loggerMiddleware, performanceMiddleware] : [])
    ),
  // Enable Redux DevTools in development
  devTools: __DEV__ && {
    name: 'Mobdeck Redux Store',
    trace: true,
    traceLimit: 25,
  },
  // Preloaded state (useful for SSR or state persistence)
  preloadedState: undefined,
  // Enhance store with additional capabilities if needed
  enhancers: defaultEnhancers => defaultEnhancers(),
};

// Create the store
export const store = configureStore(storeConfig);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Create typed hooks for use throughout the application
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Export store as default for backward compatibility
export default store;
