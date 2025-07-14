import { configureStore, ConfigureStoreOptions } from '@reduxjs/toolkit';
import { useDispatch, TypedUseSelectorHook, useSelector } from 'react-redux';
import articlesReducer from './slices/articlesSlice';
import authReducer from './slices/authSlice';
import syncReducer from './slices/syncSlice';
import {
  loggerMiddleware,
  errorHandlerMiddleware,
  performanceMiddleware,
  productionErrorMiddleware,
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
  middleware: getDefaultMiddleware => {
    // Production optimized middleware configuration
    const middlewareConfig = {
      // Optimize serializable check for production
      serializableCheck: __DEV__
        ? {
            ignoredActions: [],
            ignoredActionsPaths: ['meta.requestId', 'meta.requestStatus'],
            ignoredPaths: ['articles.items.content', 'auth.user'],
            warnAfter: 128,
          }
        : false,
      // Disable immutability check in production for performance
      immutableCheck: __DEV__
        ? {
            warnAfter: 128,
            ignoredPaths: ['articles.items.content'],
          }
        : false,
      // Disable thunk middleware checks in production
      thunk: __DEV__
        ? {
            extraArgument: undefined,
          }
        : true,
    };

    const baseMiddleware = getDefaultMiddleware(middlewareConfig);

    // Add custom middleware - optimized for production vs development
    return baseMiddleware.concat(
      __DEV__ ? errorHandlerMiddleware : productionErrorMiddleware,
      ...(__DEV__ ? [loggerMiddleware, performanceMiddleware] : [])
    );
  },
  // Optimize Redux DevTools for development
  devTools: __DEV__ && {
    name: 'Mobdeck Redux Store',
    trace: false, // Disable trace for better performance
    traceLimit: 10, // Reduce trace limit
    maxAge: 50, // Limit action history
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
