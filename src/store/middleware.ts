import { Middleware, AnyAction } from '@reduxjs/toolkit';
import { RootState } from './index';

/**
 * Simple development logging middleware
 */
export const loggerMiddleware: Middleware<{}, RootState> =
  _store => next => (action: AnyAction) => {
    if (__DEV__) {
      console.log(`Action: ${action.type}`);
    }
    return next(action);
  };

/**
 * Basic error handling middleware
 */
export const errorHandlerMiddleware: Middleware<{}, RootState> =
  _store => next => (action: AnyAction) => {
    try {
      return next(action);
    } catch (error) {
      console.error('Redux Error:', action.type, error);
      throw error;
    }
  };
