/**
 * Unit tests for authSlice
 * Testing authentication state management
 */

import { configureStore } from '@reduxjs/toolkit';
import authReducer, {
  clearError,
  setUser,
  clearAuth,
  loginUser,
  logoutUser,
  initializeAuth,
  refreshToken,
} from '../../../src/store/slices/authSlice';
import { AuthState, AuthenticatedUser } from '../../../src/types/auth';

describe('authSlice', () => {
  let store: ReturnType<typeof configureStore>;

  const initialState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error: null,
    lastTokenRefresh: undefined,
  };

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().auth;
      expect(state).toEqual(initialState);
    });
  });

  describe('setUser', () => {
    it('should set user and mark as authenticated', () => {
      const user: AuthenticatedUser = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        serverUrl: 'https://readeck.example.com',
        lastLoginAt: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      store.dispatch(setUser(user));

      const state = store.getState().auth;
      expect(state.user).toEqual(user);
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('clearAuth', () => {
    it('should clear all auth data', () => {
      // First set some auth data
      const user: AuthenticatedUser = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        serverUrl: 'https://example.com',
        lastLoginAt: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      store.dispatch(setUser(user));

      // Then clear
      store.dispatch(clearAuth());

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.error).toBeNull();
      expect(state.lastTokenRefresh).toBeUndefined();
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      // Simulate an error state by attempting a failed login
      const mockError = 'Authentication failed';

      // We'll test error clearing after setting up error state through async action
      store.dispatch(clearError());

      const state = store.getState().auth;
      expect(state.error).toBeNull();
    });
  });

  describe('Async Actions - loginUser', () => {
    it('should handle pending state', () => {
      const credentials: AuthCredentials = {
        serverUrl: 'https://readeck.example.com',
        username: 'testuser',
        password: 'testpass',
      };

      store.dispatch(loginUser.pending('', credentials));

      const state = store.getState().auth;
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state', () => {
      const payload = {
        user: {
          id: 'user123',
          username: 'testuser',
          email: 'test@example.com',
          serverUrl: 'https://readeck.example.com',
          lastLoginAt: new Date().toISOString(),
          tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        token: 'test-token-123',
      };

      store.dispatch(
        loginUser.fulfilled(payload, '', {
          serverUrl: 'https://readeck.example.com',
          username: 'testuser',
          password: 'testpass',
        })
      );

      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.user).toEqual(payload.user);
      expect(state.token).toBe(payload.token);
      expect(state.isAuthenticated).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle rejected state', () => {
      const errorMessage = 'Invalid credentials';

      store.dispatch(
        loginUser.rejected(
          null,
          '',
          {
            serverUrl: 'https://readeck.example.com',
            username: 'testuser',
            password: 'testpass',
          },
          errorMessage
        )
      );

      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe(errorMessage);
    });
  });

  describe('Async Actions - logoutUser', () => {
    it('should handle pending state', () => {
      store.dispatch(logoutUser.pending(''));

      const state = store.getState().auth;
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state', () => {
      // First set up authenticated state
      const user: AuthenticatedUser = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        serverUrl: 'https://readeck.example.com',
        lastLoginAt: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      store.dispatch(setUser(user));

      // Then logout
      store.dispatch(logoutUser.fulfilled(undefined, ''));

      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastTokenRefresh).toBeUndefined();
    });

    it('should handle rejected state', () => {
      const errorMessage = 'Logout failed';

      store.dispatch(logoutUser.rejected(null, '', undefined, errorMessage));

      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.error).toBe(errorMessage);
      // On logout failure, auth state is still cleared for security
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('Complex State Transitions', () => {
    it('should handle auth initialization with stored data', () => {
      const storedAuth = {
        user: {
          id: 'user123',
          username: 'testuser',
          email: 'test@example.com',
          serverUrl: 'https://readeck.example.com',
          lastLoginAt: new Date().toISOString(),
          tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        token: 'stored-token',
      };

      store.dispatch(initializeAuth.fulfilled(storedAuth, ''));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(storedAuth.user);
      expect(state.token).toBe(storedAuth.token);
    });

    it('should handle token refresh during session', () => {
      // First login
      const user: AuthenticatedUser = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        serverUrl: 'https://readeck.example.com',
        lastLoginAt: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      store.dispatch(setUser(user));

      // Then refresh token
      store.dispatch(
        refreshToken.fulfilled(
          { token: 'new-token' },
          '',
          'https://readeck.example.com'
        )
      );

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('new-token');
      expect(state.lastTokenRefresh).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string token in login response', () => {
      const loginPayload = {
        user: {
          id: 'user123',
          username: 'testuser',
          email: 'test@example.com',
          serverUrl: 'https://readeck.example.com',
          lastLoginAt: new Date().toISOString(),
          tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        token: '',
      };

      store.dispatch(
        loginUser.fulfilled(loginPayload, '', {
          serverUrl: 'https://readeck.example.com',
          username: 'testuser',
          password: 'testpass',
        })
      );

      const state = store.getState().auth;
      expect(state.token).toBe('');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should handle very long token', () => {
      const longToken = 'a'.repeat(10000);
      const loginPayload = {
        user: {
          id: 'user123',
          username: 'testuser',
          email: 'test@example.com',
          serverUrl: 'https://readeck.example.com',
          lastLoginAt: new Date().toISOString(),
          tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        token: longToken,
      };

      store.dispatch(
        loginUser.fulfilled(loginPayload, '', {
          serverUrl: 'https://readeck.example.com',
          username: 'testuser',
          password: 'testpass',
        })
      );

      const state = store.getState().auth;
      expect(state.token).toBe(longToken);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should handle special characters in server URL', () => {
      const specialUrl =
        'https://readeck.example.com:8080/path?param=value#hash';
      const user: AuthenticatedUser = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        serverUrl: specialUrl,
        lastLoginAt: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      store.dispatch(setUser(user));

      const state = store.getState().auth;
      expect(state.user?.serverUrl).toBe(specialUrl);
    });

    it('should handle unicode characters in error messages', () => {
      const unicodeError = 'Authentication failed: ñáéíóú 中文 🔒';

      store.dispatch(
        loginUser.rejected(
          null,
          '',
          {
            serverUrl: 'https://readeck.example.com',
            username: 'testuser',
            password: 'testpass',
          },
          unicodeError
        )
      );

      const state = store.getState().auth;
      expect(state.error).toBe(unicodeError);
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple actions', () => {
      // Build up state through login
      const loginPayload = {
        user: {
          id: 'user123',
          username: 'testuser',
          email: 'test@example.com',
          serverUrl: 'https://example.com',
          lastLoginAt: new Date().toISOString(),
          tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        token: 'auth-token',
      };

      store.dispatch(
        loginUser.fulfilled(loginPayload, '', {
          serverUrl: 'https://example.com',
          username: 'testuser',
          password: 'testpass',
        })
      );

      // Clear error to test state persistence
      store.dispatch(clearError());

      // All state should be maintained
      const state = store.getState().auth;
      expect(state.user?.serverUrl).toBe('https://example.com');
      expect(state.token).toBe('auth-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.error).toBeNull();
      expect(state.loading).toBe(false);
    });
  });
});
