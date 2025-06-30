import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authStorageService } from '../../services/AuthStorageService';
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
      tokenExpiresAt: new Date(Date.now() + loginResponse.expiresIn * 1000).toISOString(),
    };

    const tokenStored = await authStorageService.storeToken(loginResponse.token);
    if (!tokenStored) {
      console.warn('[AuthSlice] Failed to store token securely');
    }

    return { user, token: loginResponse.token };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Login failed';
    return rejectWithValue(errorMessage);
  }
});

export const logoutUser = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>('auth/logoutUser', async (_, { rejectWithValue }) => {
  try {
    const tokenDeleted = await authStorageService.deleteToken();
    if (!tokenDeleted) {
      console.warn('[AuthSlice] Failed to delete token from secure storage');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Logout failed';
    return rejectWithValue(errorMessage);
  }
});

export const initializeAuth = createAsyncThunk<
  { token: string } | null,
  void,
  { rejectValue: string }
>('auth/initializeAuth', async (_, { rejectWithValue }) => {
  try {
    const token = await authStorageService.retrieveToken();
    
    if (token) {
      const validation = await authStorageService.validateStoredToken();
      
      if (validation.isValid && !validation.isExpired) {
        return { token };
      } else {
        await authStorageService.deleteToken();
        return null;
      }
    }
    
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Auth initialization failed';
    return rejectWithValue(errorMessage);
  }
});

export const refreshToken = createAsyncThunk<
  { token: string },
  string,
  { rejectValue: string }
>('auth/refreshToken', async (serverUrl, { rejectWithValue }) => {
  try {
    const currentToken = await authStorageService.retrieveToken();
    
    if (!currentToken) {
      throw new Error('No token available for refresh');
    }

    const response = await fetch(`${serverUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const refreshResponse = await response.json();
    
    const tokenStored = await authStorageService.storeToken(refreshResponse.token);
    if (!tokenStored) {
      console.warn('[AuthSlice] Failed to store refreshed token securely');
    }

    return { token: refreshResponse.token };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
    return rejectWithValue(errorMessage);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<AuthenticatedUser>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.lastTokenRefresh = undefined;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
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
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
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
      .addCase(initializeAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
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
      .addCase(refreshToken.pending, (state) => {
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