/**
 * Unit tests for authSlice
 * Testing authentication state management
 */

import { configureStore } from '@reduxjs/toolkit';
import authSlice, {
  setAuthToken,
  clearAuth,
  setServerUrl,
  setAuthLoading,
  setAuthError,
  validateTokenStart,
  validateTokenSuccess,
  validateTokenFailure,
} from '../../../src/store/slices/authSlice';
import { AuthState } from '../../../src/types/auth';

describe('authSlice', () => {
  let store: ReturnType<typeof configureStore>;
  
  const initialState: AuthState = {
    isAuthenticated: false,
    token: null,
    serverUrl: null,
    isLoading: false,
    error: null,
    isValidatingToken: false,
    tokenValidation: {
      isValid: false,
      isExpired: false,
      error: null,
    },
  };

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authSlice.reducer,
      },
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().auth;
      expect(state).toEqual(initialState);
    });
  });

  describe('setAuthToken', () => {
    it('should set auth token and mark as authenticated', () => {
      const token = 'test-token-123';
      
      store.dispatch(setAuthToken(token));
      
      const state = store.getState().auth;
      expect(state.token).toBe(token);
      expect(state.isAuthenticated).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should clear error when setting token', () => {
      // First set an error
      store.dispatch(setAuthError('Previous error'));
      
      // Then set token
      store.dispatch(setAuthToken('new-token'));
      
      const state = store.getState().auth;
      expect(state.error).toBeNull();
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('clearAuth', () => {
    it('should clear all auth data', () => {
      // First set some auth data
      store.dispatch(setAuthToken('token'));
      store.dispatch(setServerUrl('https://example.com'));
      store.dispatch(setAuthError('error'));
      
      // Then clear
      store.dispatch(clearAuth());
      
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.serverUrl).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isValidatingToken).toBe(false);
      expect(state.tokenValidation).toEqual({
        isValid: false,
        isExpired: false,
        error: null,
      });
    });

    it('should reset loading state', () => {
      // Set loading state
      store.dispatch(setAuthLoading(true));
      
      // Clear auth
      store.dispatch(clearAuth());
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
    });
  });

  describe('setServerUrl', () => {
    it('should set server URL', () => {
      const url = 'https://readeck.example.com';
      
      store.dispatch(setServerUrl(url));
      
      const state = store.getState().auth;
      expect(state.serverUrl).toBe(url);
    });

    it('should handle null server URL', () => {
      // First set a URL
      store.dispatch(setServerUrl('https://example.com'));
      
      // Then clear it
      store.dispatch(setServerUrl(null));
      
      const state = store.getState().auth;
      expect(state.serverUrl).toBeNull();
    });
  });

  describe('setAuthLoading', () => {
    it('should set loading state to true', () => {
      store.dispatch(setAuthLoading(true));
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(true);
    });

    it('should set loading state to false', () => {
      // First set to true
      store.dispatch(setAuthLoading(true));
      
      // Then set to false
      store.dispatch(setAuthLoading(false));
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
    });

    it('should clear error when starting to load', () => {
      // First set an error
      store.dispatch(setAuthError('Login failed'));
      
      // Start loading
      store.dispatch(setAuthLoading(true));
      
      const state = store.getState().auth;
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(true);
    });
  });

  describe('setAuthError', () => {
    it('should set error message', () => {
      const error = 'Invalid credentials';
      
      store.dispatch(setAuthError(error));
      
      const state = store.getState().auth;
      expect(state.error).toBe(error);
      expect(state.isLoading).toBe(false);
    });

    it('should stop loading when error is set', () => {
      // Start loading
      store.dispatch(setAuthLoading(true));
      
      // Set error
      store.dispatch(setAuthError('Network error'));
      
      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Network error');
    });

    it('should handle null error', () => {
      // First set an error
      store.dispatch(setAuthError('Some error'));
      
      // Then clear it
      store.dispatch(setAuthError(null));
      
      const state = store.getState().auth;
      expect(state.error).toBeNull();
    });
  });

  describe('Token Validation Actions', () => {
    describe('validateTokenStart', () => {
      it('should set validation loading state', () => {
        store.dispatch(validateTokenStart());
        
        const state = store.getState().auth;
        expect(state.isValidatingToken).toBe(true);
        expect(state.tokenValidation.error).toBeNull();
      });

      it('should clear previous validation error', () => {
        // Set a validation error first
        store.dispatch(validateTokenFailure('Previous error'));
        
        // Start new validation
        store.dispatch(validateTokenStart());
        
        const state = store.getState().auth;
        expect(state.tokenValidation.error).toBeNull();
      });
    });

    describe('validateTokenSuccess', () => {
      it('should set token as valid', () => {
        const validationResult = {
          isValid: true,
          isExpired: false,
          expiresIn: 3600,
        };
        
        store.dispatch(validateTokenSuccess(validationResult));
        
        const state = store.getState().auth;
        expect(state.isValidatingToken).toBe(false);
        expect(state.tokenValidation.isValid).toBe(true);
        expect(state.tokenValidation.isExpired).toBe(false);
        expect(state.tokenValidation.expiresIn).toBe(3600);
        expect(state.tokenValidation.error).toBeNull();
      });

      it('should handle expired token', () => {
        const validationResult = {
          isValid: false,
          isExpired: true,
          expiresIn: 0,
        };
        
        store.dispatch(validateTokenSuccess(validationResult));
        
        const state = store.getState().auth;
        expect(state.tokenValidation.isValid).toBe(false);
        expect(state.tokenValidation.isExpired).toBe(true);
        expect(state.tokenValidation.expiresIn).toBe(0);
      });

      it('should stop validation loading', () => {
        // Start validation
        store.dispatch(validateTokenStart());
        
        // Complete validation
        store.dispatch(validateTokenSuccess({
          isValid: true,
          isExpired: false,
        }));
        
        const state = store.getState().auth;
        expect(state.isValidatingToken).toBe(false);
      });
    });

    describe('validateTokenFailure', () => {
      it('should set validation error', () => {
        const error = 'Token validation failed';
        
        store.dispatch(validateTokenFailure(error));
        
        const state = store.getState().auth;
        expect(state.isValidatingToken).toBe(false);
        expect(state.tokenValidation.error).toBe(error);
        expect(state.tokenValidation.isValid).toBe(false);
      });

      it('should stop validation loading on error', () => {
        // Start validation
        store.dispatch(validateTokenStart());
        
        // Fail validation
        store.dispatch(validateTokenFailure('Network error'));
        
        const state = store.getState().auth;
        expect(state.isValidatingToken).toBe(false);
        expect(state.tokenValidation.error).toBe('Network error');
      });
    });
  });

  describe('Complex State Transitions', () => {
    it('should handle login flow', () => {
      // Start loading
      store.dispatch(setAuthLoading(true));
      expect(store.getState().auth.isLoading).toBe(true);
      
      // Set server URL
      store.dispatch(setServerUrl('https://readeck.example.com'));
      
      // Set token (successful login)
      store.dispatch(setAuthToken('auth-token-123'));
      
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('auth-token-123');
      expect(state.serverUrl).toBe('https://readeck.example.com');
      expect(state.error).toBeNull();
    });

    it('should handle login failure', () => {
      // Start loading
      store.dispatch(setAuthLoading(true));
      
      // Set server URL
      store.dispatch(setServerUrl('https://readeck.example.com'));
      
      // Login fails
      store.dispatch(setAuthError('Invalid credentials'));
      
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid credentials');
      expect(state.serverUrl).toBe('https://readeck.example.com'); // Should persist
    });

    it('should handle logout flow', () => {
      // First login
      store.dispatch(setServerUrl('https://readeck.example.com'));
      store.dispatch(setAuthToken('token'));
      
      // Then logout
      store.dispatch(clearAuth());
      
      const state = store.getState().auth;
      expect(state).toEqual(initialState);
    });

    it('should handle token validation during session', () => {
      // Login first
      store.dispatch(setAuthToken('token'));
      
      // Start token validation
      store.dispatch(validateTokenStart());
      
      // Token is valid
      store.dispatch(validateTokenSuccess({
        isValid: true,
        isExpired: false,
        expiresIn: 1800,
      }));
      
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.tokenValidation.isValid).toBe(true);
      expect(state.tokenValidation.expiresIn).toBe(1800);
    });

    it('should handle expired token detection', () => {
      // Login first
      store.dispatch(setAuthToken('expired-token'));
      
      // Validate token
      store.dispatch(validateTokenStart());
      store.dispatch(validateTokenSuccess({
        isValid: false,
        isExpired: true,
        expiresIn: 0,
      }));
      
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true); // Still authenticated until logout
      expect(state.tokenValidation.isValid).toBe(false);
      expect(state.tokenValidation.isExpired).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string token', () => {
      store.dispatch(setAuthToken(''));
      
      const state = store.getState().auth;
      expect(state.token).toBe('');
      expect(state.isAuthenticated).toBe(true); // Still authenticated with empty token
    });

    it('should handle very long token', () => {
      const longToken = 'a'.repeat(10000);
      
      store.dispatch(setAuthToken(longToken));
      
      const state = store.getState().auth;
      expect(state.token).toBe(longToken);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should handle special characters in server URL', () => {
      const specialUrl = 'https://readeck.example.com:8080/path?param=value#hash';
      
      store.dispatch(setServerUrl(specialUrl));
      
      const state = store.getState().auth;
      expect(state.serverUrl).toBe(specialUrl);
    });

    it('should handle unicode characters in error messages', () => {
      const unicodeError = 'Authentication failed: ñáéíóú 中文 🔒';
      
      store.dispatch(setAuthError(unicodeError));
      
      const state = store.getState().auth;
      expect(state.error).toBe(unicodeError);
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple actions', () => {
      // Build up state
      store.dispatch(setServerUrl('https://example.com'));
      store.dispatch(setAuthToken('token'));
      store.dispatch(validateTokenSuccess({
        isValid: true,
        isExpired: false,
        expiresIn: 3600,
      }));
      
      // All state should be maintained
      const state = store.getState().auth;
      expect(state.serverUrl).toBe('https://example.com');
      expect(state.token).toBe('token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.tokenValidation.isValid).toBe(true);
      expect(state.tokenValidation.expiresIn).toBe(3600);
    });
  });
});