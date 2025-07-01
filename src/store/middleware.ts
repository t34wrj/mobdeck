import { Middleware, AnyAction } from '@reduxjs/toolkit';
import { RootState } from './index';

/**
 * Development logging middleware
 * Logs actions and state changes in development mode
 */
export const loggerMiddleware: Middleware<{}, RootState> =
  store => next => (action: AnyAction) => {
    if (__DEV__) {
      console.group(`🔥 Action: ${action.type}`);
      console.log('Payload:', action.payload);
      console.log('Previous State:', store.getState());
    }

    const result = next(action);

    if (__DEV__) {
      console.log('New State:', store.getState());
      console.groupEnd();
    }

    return result;
  };

/**
 * Error handling middleware
 * Catches and logs any errors that occur during action processing
 */
export const errorHandlerMiddleware: Middleware<{}, RootState> =
  store => next => (action: AnyAction) => {
    try {
      return next(action);
    } catch (error) {
      console.error('🚨 Redux Error:', error);
      console.error('Action:', action);
      console.error('State:', store.getState());

      // Re-throw the error so it can be handled elsewhere if needed
      throw error;
    }
  };

/**
 * Performance monitoring middleware
 * Tracks action processing time in development
 */
export const performanceMiddleware: Middleware<{}, RootState> =
  store => next => (action: AnyAction) => {
    if (__DEV__) {
      const startTime = performance.now();
      const result = next(action);
      const endTime = performance.now();

      if (endTime - startTime > 10) {
        console.warn(
          `⚠️ Slow action detected: ${action.type} took ${(endTime - startTime).toFixed(2)}ms`
        );
      }

      return result;
    }

    return next(action);
  };
