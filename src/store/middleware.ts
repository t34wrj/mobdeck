import { Middleware, AnyAction } from '@reduxjs/toolkit';
import { RootState } from './index';

/**
 * Development logging middleware
 * Logs actions and state changes in development mode
 */
export const loggerMiddleware: Middleware<{}, RootState> =
  _store => next => (action: AnyAction) => {
    // Fast path for production - no conditional checks
    if (!__DEV__) {
      return next(action);
    }

    // Development logging with minimal overhead
    console.log(`🔥 Action: ${action.type}`);
    return next(action);
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
      // Optimized error logging - only log essential information
      console.error('🚨 Redux Error:', error);
      console.error('Action:', action.type);
      
      // Only log full state in development
      if (__DEV__) {
        console.error('State:', store.getState());
      }

      // Re-throw the error so it can be handled elsewhere if needed
      throw error;
    }
  };

/**
 * Production-only minimal error tracking middleware
 * Lightweight error handling for production builds
 */
export const productionErrorMiddleware: Middleware<{}, RootState> =
  _store => next => (action: AnyAction) => {
    try {
      return next(action);
    } catch (error) {
      // Minimal error logging for production
      console.error('Redux Error:', action.type, error);
      throw error;
    }
  };

/**
 * Performance monitoring middleware
 * Tracks action processing time in development
 */
export const performanceMiddleware: Middleware<{}, RootState> =
  _store => next => (action: AnyAction) => {
    // Fast path for production - no performance monitoring overhead
    if (!__DEV__) {
      return next(action);
    }

    // Optimized performance monitoring for development
    const startTime = performance.now();
    const result = next(action);
    const duration = performance.now() - startTime;

    // Only warn for truly slow actions (>100ms)
    if (duration > 100) {
      console.warn(
        `⚠️ Slow action detected: ${action.type} took ${duration.toFixed(2)}ms`
      );
    }

    return result;
  };
