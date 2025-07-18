import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { localStorageService } from '../../services/LocalStorageService';
// import { handleError, ErrorType } from '../../utils/errorHandler'; // TODO: Use this for error handling
import { logger } from '../../utils/logger';
import {
  AuthState,
  AuthCredentials,
  LoginResponse,
  AuthenticatedUser,
} from '../../types/auth';

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  lastTokenRefresh: undefined,
};

export const loginUser = createAsyncThunk<
  { user: AuthenticatedUser; token: string },
  AuthCredentials,
  { rejectValue: string }
>('auth/loginUser', async (credentials, { rejectWithValue }) => {
  try {
    logger.info('Login attempt initiated', {
      serverUrl: credentials.serverUrl,
      username: credentials.username,
    });
    const response = await fetch(`${credentials.serverUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Login failed: ${response.status}`);
    }

    const loginResponse: LoginResponse = await response.json();

    const user: AuthenticatedUser = {
      id: loginResponse.user.id,
      username: loginResponse.user.username,
      email: loginResponse.user.email,
      serverUrl: credentials.serverUrl,
      lastLoginAt: new Date().toISOString(),
      tokenExpiresAt: new Date(
        Date.now() + loginResponse.expiresIn * 1000
      ).toISOString(),
    };

    const tokenStored = await localStorageService.storeToken(
      loginResponse.token,
      user
    );
    if (!tokenStored) {
      logger.warn('Failed to store token securely');
    }

    logger.info('Login successful', { userId: user.id });
    return { user, token: loginResponse.token };
  } catch (error) {
    // TODO: Implement proper error handling with errorHandler
    // const handledError = errorHandler.handleError(error, {
    //   category: ErrorCategory.AUTHENTICATION,
    //   context: {
    //     actionType: 'login',
    //     serverUrl: credentials.serverUrl,
    //   },
    // });

    const errorMessage =
      error instanceof Error ? error.message : 'Login failed';
    logger.error('Login failed', { error: errorMessage });
    return rejectWithValue(errorMessage);
  }
});

export const logoutUser = createAsyncThunk<
  void,
  void,
  { rejectValue: string; dispatch: any }
>('auth/logoutUser', async (_, { rejectWithValue, dispatch }) => {
  try {
    // Clear auth token from secure storage
    const tokenDeleted = await localStorageService.deleteToken();
    if (!tokenDeleted) {
      console.warn('[AuthSlice] Failed to delete token from secure storage');
    }

    // Clear all locally stored data
    try {
      // Import here to avoid circular dependencies
      const { clearAll: clearAllArticles } = await import('./articlesSlice');
      const { resetSyncState, resetSyncStats } = await import('./syncSlice');
      // Clear Redux state
      dispatch(clearAllArticles());
      dispatch(resetSyncState());
      dispatch(resetSyncStats());

      // Clear all local storage data
      const clearResult = await localStorageService.clearAllData();
      if (!clearResult.success) {
        console.warn(
          '[AuthSlice] Failed to clear database data:',
          clearResult.error
        );
      }

      logger.info('User logged out - all local data cleared');
    } catch (error) {
      console.warn(
        '[AuthSlice] Error clearing local data during logout:',
        error
      );
      // Don't fail the logout if data cleanup fails
    }

    return undefined; // Explicit return for consistency
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Logout failed';
    return rejectWithValue(errorMessage);
  }
});

export const initializeAuth = createAsyncThunk<
  { user: AuthenticatedUser; token: string } | null,
  void,
  { rejectValue: string }
>('auth/initializeAuth', async (_, { rejectWithValue }) => {
  try {
    // Check if token is stored and valid
    const isTokenStored = await localStorageService.isTokenStored();
    if (!isTokenStored) {
      return null;
    }

    const token = await localStorageService.retrieveToken();
    if (!token) {
      return null;
    }

    const validation = await localStorageService.validateStoredToken();
    const authData = {
      token,
      isValid: validation.isValid,
      isExpired: validation.isExpired,
    };

    if (authData && authData.token && authData.isValid && !authData.isExpired) {
      // Get complete auth data including serverUrl
      const completeAuthData = await localStorageService.retrieveAuthData();
      
      if (!completeAuthData || !completeAuthData.serverUrl) {
        console.warn('[AuthSlice] No complete auth data or server URL found');
        await localStorageService.deleteToken();
        return null;
      }

      // Create user data from stored auth data
      const user: AuthenticatedUser = {
        id: completeAuthData.user?.id || 'readeck-user',
        username: completeAuthData.user?.username || 'Readeck User',
        email: completeAuthData.user?.email || 'user@readeck.local',
        serverUrl: completeAuthData.serverUrl,
        lastLoginAt: completeAuthData.user?.lastLoginAt || new Date().toISOString(),
        tokenExpiresAt:
          validation.expiresAt || new Date(Date.now() + 86400000).toISOString(), // 24h default
      };

      console.log('[AuthSlice] Restoring auth for user:', user.username, 'Server:', user.serverUrl);

      // Configure the ReadeckApiService with the restored server URL
      if (user.serverUrl) {
        try {
          const { readeckApiService } = await import(
            '../../services/ReadeckApiService'
          );
          const cleanUrl = user.serverUrl.trim().replace(/\/$/, '');
          const apiUrl = cleanUrl.includes('/api')
            ? cleanUrl
            : `${cleanUrl}/api`;

          console.log('[AuthSlice] Configuring API service on auth restore:', {
            originalUrl: user.serverUrl,
            cleanUrl,
            apiUrl,
          });

          readeckApiService.updateConfig({
            baseUrl: apiUrl,
          });

          logger.info('API service configured for restored session', {
            serverUrl: user.serverUrl,
            apiUrl,
          });
        } catch (error) {
          console.error('[AuthSlice] Failed to configure API service:', error);
        }
      } else {
        console.warn('[AuthSlice] No server URL found in restored auth data');
      }

      logger.info('Auth initialized successfully', {
        userId: user.id,
        serverUrl: user.serverUrl,
      });
      return { user, token: authData.token };
    } else {
      logger.info('Stored token is invalid or expired, clearing auth data');
      await localStorageService.deleteToken();
      return null;
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Auth initialization failed';
    logger.error('Auth initialization failed', { error: errorMessage });
    return rejectWithValue(errorMessage);
  }
});

// Helper thunk to restore full auth state from storage
export const restoreAuthState = createAsyncThunk<
  { user: AuthenticatedUser; token: string } | null,
  void,
  { rejectValue: string }
>('auth/restoreAuthState', async (_, { rejectWithValue }) => {
  try {
    const token = await localStorageService.retrieveToken();

    if (!token) {
      return null;
    }

    // TODO: Properly restore user data including serverUrl from storage
    // For now, we'll need to handle this in the app initialization

    return null;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Auth restoration failed';
    return rejectWithValue(errorMessage);
  }
});

export const refreshToken = createAsyncThunk<
  { token: string },
  string,
  { rejectValue: string }
>('auth/refreshToken', async (serverUrl, { rejectWithValue }) => {
  try {
    const currentToken = await localStorageService.retrieveToken();

    if (!currentToken) {
      throw new Error('No token available for refresh');
    }

    const response = await fetch(`${serverUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const refreshResponse = await response.json();

    const tokenStored = await localStorageService.storeToken(
      refreshResponse.token
    );
    if (!tokenStored) {
      console.warn('[AuthSlice] Failed to store refreshed token securely');
    }

    return { token: refreshResponse.token };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Token refresh failed';
    return rejectWithValue(errorMessage);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: state => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<AuthenticatedUser>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearAuth: state => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.lastTokenRefresh = undefined;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loginUser.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = action.payload || 'Login failed';
      })
      .addCase(logoutUser.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, state => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
        state.lastTokenRefresh = undefined;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Logout failed';
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.lastTokenRefresh = undefined;
      })
      .addCase(initializeAuth.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.isAuthenticated = true;
        } else {
          state.isAuthenticated = false;
        }
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Auth initialization failed';
        state.isAuthenticated = false;
      })
      .addCase(refreshToken.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.lastTokenRefresh = new Date().toISOString();
        state.error = null;
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Token refresh failed';
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.lastTokenRefresh = undefined;
      });
  },
});

export const { clearError, setUser, clearAuth } = authSlice.actions;

export default authSlice.reducer;
