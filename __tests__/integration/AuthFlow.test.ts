/**
 * Integration tests for complete authentication flow from backend services
 * Tests the full workflow including Redux state management, secure storage, API calls.
 * Note: UI testing is handled separately in screen-specific test files.
 */

import { configureStore, Store } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import * as Keychain from 'react-native-keychain';

// Import services  
import { authStorageService } from '../../src/services/AuthStorageService';
import { readeckApiService } from '../../src/services/ReadeckApiService';

// Import Redux slices
import authReducer, { 
  loginUser, 
  logoutUser, 
  initializeAuth, 
  refreshToken,
  clearError, 
  setUser, 
  clearAuth 
} from '../../src/store/slices/authSlice';
import articlesReducer from '../../src/store/slices/articlesSlice';
import syncReducer from '../../src/store/slices/syncSlice';

// Import types
import { 
  AuthState, 
  AuthenticatedUser, 
  AuthCredentials,
  TokenValidationResult,
  StorageErrorCode 
} from '../../src/types/auth';
import { ReadeckApiResponse, ReadeckLoginResponse, ReadeckUser } from '../../src/types/readeck';

// Mock external dependencies
jest.mock('react-native-keychain');
jest.mock('../../src/services/AuthStorageService');
jest.mock('../../src/services/ReadeckApiService');

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock Alert.alert
jest.spyOn(Alert, 'alert');

// Create a test store factory
const createTestStore = (preloadedState?: Partial<{ auth: AuthState }>) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      articles: articlesReducer,
      sync: syncReducer,
    },
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
  });
};

// Test data
const validServerUrl = 'https://readeck.example.com';
const validBearerToken = 'valid-bearer-token-1234567890';
const mockUser: AuthenticatedUser = {
  id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
  serverUrl: validServerUrl,
  lastLoginAt: new Date().toISOString(),
  tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

const mockLoginResponse: ReadeckLoginResponse = {
  token: validBearerToken,
  user: {
    id: mockUser.id,
    username: mockUser.username,
    email: mockUser.email,
  },
  expiresIn: 86400, // 24 hours
};

describe('Authentication Flow Integration Tests', () => {
  let store: Store;
  const mockKeychainModule = Keychain as jest.Mocked<typeof Keychain>;
  const mockAuthStorageService = authStorageService as jest.Mocked<typeof authStorageService>;
  const mockReadeckApiService = readeckApiService as jest.Mocked<typeof readeckApiService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();
    
    // Reset console mocks
    (console.log as jest.Mock).mockClear();
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    
    // Create fresh store for each test
    store = createTestStore();
    
    // Setup default mock implementations
    mockKeychainModule.setInternetCredentials.mockResolvedValue(true);
    mockKeychainModule.getInternetCredentials.mockResolvedValue({
      username: 'bearer_token',
      password: JSON.stringify({
        token: validBearerToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        issuedAt: new Date().toISOString(),
        serverUrl: validServerUrl,
      }),
      server: 'mobdeck_auth_tokens',
    });
    mockKeychainModule.resetInternetCredentials.mockResolvedValue(true);
    
    mockAuthStorageService.storeToken.mockResolvedValue(true);
    mockAuthStorageService.retrieveToken.mockResolvedValue(validBearerToken);
    mockAuthStorageService.deleteToken.mockResolvedValue(true);
    mockAuthStorageService.isTokenStored.mockResolvedValue(true);
    mockAuthStorageService.validateStoredToken.mockResolvedValue({
      isValid: true,
      isExpired: false,
      expiresIn: 86400,
    });
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockLoginResponse),
      headers: new Headers(),
    });
  });

  describe('Redux State Management Integration', () => {
    it('should handle loginUser async thunk successfully', async () => {
      // Arrange
      const credentials: AuthCredentials = {
        username: 'testuser',
        password: 'testpass',
        serverUrl: validServerUrl,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockLoginResponse),
      });

      // Act
      const action = await store.dispatch(loginUser(credentials));

      // Assert
      expect(action.type).toBe('auth/loginUser/fulfilled');
      
      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(expect.objectContaining({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        serverUrl: validServerUrl,
      }));
      expect(state.token).toBe(validBearerToken);
      expect(state.error).toBeNull();

      expect(mockAuthStorageService.storeToken).toHaveBeenCalledWith(validBearerToken);
    });

    it('should handle loginUser async thunk failure', async () => {
      // Arrange
      const credentials: AuthCredentials = {
        username: 'testuser',
        password: 'wrongpass',
        serverUrl: validServerUrl,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      });

      // Act
      const action = await store.dispatch(loginUser(credentials));

      // Assert
      expect(action.type).toBe('auth/loginUser/rejected');
      
      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.error).toBe('Invalid credentials');
    });

    it('should handle logoutUser async thunk', async () => {
      // Arrange - Set initial authenticated state
      store.dispatch(setUser(mockUser));
      let state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);

      // Act
      const action = await store.dispatch(logoutUser());

      // Assert
      expect(action.type).toBe('auth/logoutUser/fulfilled');
      
      const finalState = store.getState().auth;
      expect(finalState.loading).toBe(false);
      expect(finalState.isAuthenticated).toBe(false);
      expect(finalState.user).toBeNull();
      expect(finalState.token).toBeNull();
      expect(finalState.error).toBeNull();
      expect(finalState.lastTokenRefresh).toBeUndefined();

      expect(mockAuthStorageService.deleteToken).toHaveBeenCalled();
    });

    it('should handle initializeAuth async thunk with valid token', async () => {
      // Arrange
      mockAuthStorageService.retrieveToken.mockResolvedValue(validBearerToken);
      mockAuthStorageService.validateStoredToken.mockResolvedValue({
        isValid: true,
        isExpired: false,
        expiresIn: 86400,
      });

      // Act
      const action = await store.dispatch(initializeAuth());

      // Assert
      expect(action.type).toBe('auth/initializeAuth/fulfilled');
      
      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe(validBearerToken);
      expect(state.error).toBeNull();
    });

    it('should handle initializeAuth async thunk with expired token', async () => {
      // Arrange
      mockAuthStorageService.retrieveToken.mockResolvedValue(validBearerToken);
      mockAuthStorageService.validateStoredToken.mockResolvedValue({
        isValid: false,
        isExpired: true,
        error: 'Token expired',
      });

      // Act
      const action = await store.dispatch(initializeAuth());

      // Assert
      expect(action.type).toBe('auth/initializeAuth/fulfilled');
      
      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();

      expect(mockAuthStorageService.deleteToken).toHaveBeenCalled();
    });

    it('should handle refreshToken async thunk successfully', async () => {
      // Arrange
      const newToken = 'new-refreshed-token-123';
      mockAuthStorageService.retrieveToken.mockResolvedValue(validBearerToken);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: newToken }),
      });

      // Act
      const action = await store.dispatch(refreshToken(validServerUrl));

      // Assert
      expect(action.type).toBe('auth/refreshToken/fulfilled');
      
      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.token).toBe(newToken);
      expect(state.lastTokenRefresh).toBeTruthy();
      expect(state.error).toBeNull();

      expect(mockAuthStorageService.storeToken).toHaveBeenCalledWith(newToken);
    });

    it('should handle refreshToken async thunk failure', async () => {
      // Arrange
      mockAuthStorageService.retrieveToken.mockResolvedValue(validBearerToken);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Act
      const action = await store.dispatch(refreshToken(validServerUrl));

      // Assert
      expect(action.type).toBe('auth/refreshToken/rejected');
      
      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.error).toContain('Token refresh failed');
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should handle clearError action', () => {
      // Arrange - Set initial error state
      store.dispatch({ type: 'auth/loginUser/rejected', payload: 'Test error' });
      let state = store.getState().auth;
      expect(state.error).toBe('Test error');

      // Act
      store.dispatch(clearError());

      // Assert
      state = store.getState().auth;
      expect(state.error).toBeNull();
    });

    it('should handle clearAuth action', () => {
      // Arrange - Set initial authenticated state
      store.dispatch(setUser(mockUser));
      let state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);

      // Act
      store.dispatch(clearAuth());

      // Assert
      state = store.getState().auth;
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastTokenRefresh).toBeUndefined();
    });
  });

  describe('Storage Integration', () => {
    it('should handle secure token storage and retrieval', async () => {
      // Test storage
      const storeResult = await authStorageService.storeToken(validBearerToken);
      expect(storeResult).toBe(true);
      expect(mockAuthStorageService.storeToken).toHaveBeenCalledWith(validBearerToken);

      // Test retrieval
      const retrievedToken = await authStorageService.retrieveToken();
      expect(retrievedToken).toBe(validBearerToken);
      expect(mockAuthStorageService.retrieveToken).toHaveBeenCalled();

      // Test validation
      const validation = await authStorageService.validateStoredToken();
      expect(validation.isValid).toBe(true);
      expect(validation.isExpired).toBe(false);
      expect(mockAuthStorageService.validateStoredToken).toHaveBeenCalled();

      // Test deletion
      const deleteResult = await authStorageService.deleteToken();
      expect(deleteResult).toBe(true);
      expect(mockAuthStorageService.deleteToken).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      // Arrange
      mockAuthStorageService.storeToken.mockResolvedValue(false);
      mockAuthStorageService.retrieveToken.mockResolvedValue(null);
      mockAuthStorageService.validateStoredToken.mockResolvedValue({
        isValid: false,
        isExpired: true,
        error: 'Storage error',
      });

      // Act & Assert
      const storeResult = await authStorageService.storeToken(validBearerToken);
      expect(storeResult).toBe(false);

      const retrievedToken = await authStorageService.retrieveToken();
      expect(retrievedToken).toBeNull();

      const validation = await authStorageService.validateStoredToken();
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Storage error');
    });
  });

  describe('Error Scenarios Integration', () => {
    it('should handle network connection failures', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network unavailable'));

      const credentials: AuthCredentials = {
        username: 'testuser',
        password: 'testpass',
        serverUrl: validServerUrl,
      };

      // Act
      const action = await store.dispatch(loginUser(credentials));

      // Assert
      expect(action.type).toBe('auth/loginUser/rejected');
      
      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toContain('Network unavailable');
    });

    it('should handle server authentication errors', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      const credentials: AuthCredentials = {
        username: 'testuser',
        password: 'wrongpass',
        serverUrl: validServerUrl,
      };

      // Act
      const action = await store.dispatch(loginUser(credentials));

      // Assert
      expect(action.type).toBe('auth/loginUser/rejected');
      
      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Unauthorized');
    });

    it('should handle server unavailability', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ message: 'Service unavailable' }),
      });

      const credentials: AuthCredentials = {
        username: 'testuser',
        password: 'testpass',
        serverUrl: validServerUrl,
      };

      // Act
      const action = await store.dispatch(loginUser(credentials));

      // Assert
      expect(action.type).toBe('auth/loginUser/rejected');
      
      const state = store.getState().auth;
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Service unavailable');
    });
  });

  describe('Token Validation Scenarios', () => {
    it('should handle expired token validation', async () => {
      // Arrange
      mockAuthStorageService.validateStoredToken.mockResolvedValue({
        isValid: false,
        isExpired: true,
        expiresIn: 0,
        error: 'Token expired',
      });

      // Act
      const action = await store.dispatch(initializeAuth());

      // Assert
      expect(action.type).toBe('auth/initializeAuth/fulfilled');
      
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();

      expect(mockAuthStorageService.deleteToken).toHaveBeenCalled();
    });

    it('should handle malformed token data', async () => {
      // Arrange
      mockAuthStorageService.retrieveToken.mockResolvedValue(null);
      mockAuthStorageService.validateStoredToken.mockResolvedValue({
        isValid: false,
        isExpired: true,
        error: 'Invalid token format',
      });

      // Act
      const action = await store.dispatch(initializeAuth());

      // Assert
      expect(action.type).toBe('auth/initializeAuth/fulfilled');
      
      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
    });
  });

  describe('State Persistence Integration', () => {
    it('should maintain auth state consistency across actions', async () => {
      // Test complete authentication flow
      const credentials: AuthCredentials = {
        username: 'testuser',
        password: 'testpass',
        serverUrl: validServerUrl,
      };

      // Login
      await store.dispatch(loginUser(credentials));
      let state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toBeTruthy();
      expect(state.token).toBe(validBearerToken);

      // Clear error (should not affect auth status)
      store.dispatch(clearError());
      state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toBeTruthy();

      // Logout
      await store.dispatch(logoutUser());
      const finalState = store.getState().auth;
      expect(finalState.isAuthenticated).toBe(false);
      expect(finalState.user).toBeNull();
      expect(finalState.token).toBeNull();
    });

    it('should handle concurrent auth actions correctly', async () => {
      // Arrange
      const credentials: AuthCredentials = {
        username: 'testuser',
        password: 'testpass',
        serverUrl: validServerUrl,
      };

      // Act - Dispatch multiple actions concurrently
      const loginPromise = store.dispatch(loginUser(credentials));
      const initPromise = store.dispatch(initializeAuth());

      // Assert - Wait for both to complete
      await Promise.all([loginPromise, initPromise]);

      const state = store.getState().auth;
      // State should be consistent (one of the actions should succeed)
      expect(state.loading).toBe(false);
    });
  });

  describe('API Service Integration', () => {
    it('should handle API service configuration updates', () => {
      // Test that readeck API service methods exist and are callable
      expect(mockReadeckApiService.login).toBeDefined();
      expect(mockReadeckApiService.validateToken).toBeDefined();
      expect(mockReadeckApiService.refreshToken).toBeDefined();
      expect(mockReadeckApiService.updateConfig).toBeDefined();

      // Test configuration update
      const newConfig = {
        baseUrl: 'https://new-readeck.example.com/api/v1',
        timeout: 45000,
        retryAttempts: 5,
      };

      readeckApiService.updateConfig(newConfig);
      expect(mockReadeckApiService.updateConfig).toHaveBeenCalledWith(newConfig);
    });

    it('should handle API network state updates', () => {
      const networkState = {
        isConnected: true,
        isWifiEnabled: true,
        isCellularEnabled: false,
        networkType: 'wifi' as const,
      };

      readeckApiService.updateNetworkState(networkState);
      expect(mockReadeckApiService.updateNetworkState).toHaveBeenCalledWith(networkState);

      const isOnline = readeckApiService.isOnline();
      expect(mockReadeckApiService.isOnline).toHaveBeenCalled();
    });
  });

  describe('Full Authentication Workflow Integration', () => {
    it('should complete full authentication workflow from start to finish', async () => {
      // 1. Initialize auth (no stored token)
      mockAuthStorageService.retrieveToken.mockResolvedValueOnce(null);
      await store.dispatch(initializeAuth());
      
      let state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);

      // 2. Login with credentials
      const credentials: AuthCredentials = {
        username: 'testuser',
        password: 'testpass',
        serverUrl: validServerUrl,
      };

      await store.dispatch(loginUser(credentials));
      state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toBeTruthy();
      expect(state.token).toBe(validBearerToken);

      // 3. Refresh token
      const newToken = 'refreshed-token-456';
      mockAuthStorageService.storeToken.mockClear();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: newToken }),
      });

      await store.dispatch(refreshToken(validServerUrl));
      state = store.getState().auth;
      expect(state.token).toBe(newToken);
      expect(state.lastTokenRefresh).toBeTruthy();

      // 4. Logout
      await store.dispatch(logoutUser());
      state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();

      // Verify all storage operations occurred
      expect(mockAuthStorageService.storeToken).toHaveBeenCalledWith(newToken);
      expect(mockAuthStorageService.deleteToken).toHaveBeenCalled();
    });

    it('should handle authentication errors and recovery', async () => {
      // 1. Failed login attempt
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      });

      const badCredentials: AuthCredentials = {
        username: 'testuser',
        password: 'wrongpass',
        serverUrl: validServerUrl,
      };

      await store.dispatch(loginUser(badCredentials));
      let state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toBe('Invalid credentials');

      // 2. Clear error and retry with correct credentials
      store.dispatch(clearError());
      state = store.getState().auth;
      expect(state.error).toBeNull();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockLoginResponse),
      });

      const goodCredentials: AuthCredentials = {
        username: 'testuser',
        password: 'correctpass',
        serverUrl: validServerUrl,
      };

      await store.dispatch(loginUser(goodCredentials));
      state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.error).toBeNull();

      // 3. Failed token refresh should clear auth
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await store.dispatch(refreshToken(validServerUrl));
      state = store.getState().auth;
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });
  });
});