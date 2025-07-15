/**
 * Tests for LoginScreen component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import LoginScreen from '../LoginScreen';
import authReducer from '../../../store/slices/authSlice';
import syncReducer from '../../../store/slices/syncSlice';
import { authStorageService } from '../../../services/AuthStorageService';
import { validateApiToken } from '../../../services/api';
import { readeckApiService } from '../../../services/ReadeckApiService';

// Mock dependencies
jest.mock('../../../services/AuthStorageService');
jest.mock('../../../services/api');
jest.mock('../../../services/ReadeckApiService');
jest.mock('../../../components/ui/Button', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    Button: ({ onPress, children, disabled, testID, ...props }: any) => (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        testID={testID}
        {...props}
      >
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('../../../components/ui/Text', () => {
  const { Text } = require('react-native');
  return {
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
  };
});

jest.mock('../../../components/MobdeckLogo', () => {
  const { View } = require('react-native');
  return () => <View testID='mobdeck-logo' />;
});

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
};

// Helper function to create a test store
const createTestStore = (initialState?: any) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      sync: syncReducer,
    },
    preloadedState: {
      auth: {
        isAuthenticated: false,
        isLoading: false,
        error: null,
        serverUrl: null,
        apiToken: null,
        ...initialState?.auth,
      },
      sync: {
        isOnline: true,
        isSyncing: false,
        lastSyncTime: null,
        syncProgress: { current: 0, total: 0, step: '' },
        syncStats: { created: 0, updated: 0, deleted: 0, errors: 0 },
        syncErrors: [],
        syncHistory: [],
        ...initialState?.sync,
      },
    },
  });
};

// Helper function to render with providers
const renderWithProviders = (component: React.ReactElement, store?: any) => {
  const testStore = store || createTestStore();
  return {
    ...render(<Provider store={testStore}>{component}</Provider>),
    store: testStore,
  };
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authStorageService.storeToken as jest.Mock).mockResolvedValue(true);
    (readeckApiService.updateConfig as jest.Mock).mockReturnValue(undefined);
  });

  it('should render login form', () => {
    const { getByPlaceholderText, getByText, getByTestId } =
      renderWithProviders(
        <LoginScreen navigation={mockNavigation as any} route={{} as any} />
      );

    expect(getByTestId('mobdeck-logo')).toBeTruthy();
    expect(
      getByPlaceholderText('https://readeck.example.com')
    ).toBeTruthy();
    expect(getByPlaceholderText('Enter your API token')).toBeTruthy();
    expect(getByText('Connect to Server')).toBeTruthy();
  });

  it('should validate empty server URL', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation as any} route={{} as any} />
    );

    const connectButton = getByText('Connect to Server');
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(getByText('Server URL is required')).toBeTruthy();
    });
  });

  it('should validate invalid URL format', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation as any} route={{} as any} />
    );

    const urlInput = getByPlaceholderText('https://readeck.example.com');
    fireEvent.changeText(urlInput, 'invalid-url');

    const connectButton = getByText('Connect to Server');
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(getByText('Please enter a valid URL')).toBeTruthy();
    });
  });

  it('should validate URL protocol', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation as any} route={{} as any} />
    );

    const urlInput = getByPlaceholderText('https://readeck.example.com');
    fireEvent.changeText(urlInput, 'ftp://example.com');

    const connectButton = getByText('Connect to Server');
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(getByText('URL must start with http:// or https://')).toBeTruthy();
    });
  });

  it('should validate empty API token', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation as any} route={{} as any} />
    );

    const urlInput = getByPlaceholderText('https://readeck.example.com');
    fireEvent.changeText(urlInput, 'https://example.com');

    const connectButton = getByText('Connect to Server');
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(getByText('API token is required')).toBeTruthy();
    });
  });

  it('should successfully connect with valid credentials', async () => {
    (validateApiToken as jest.Mock).mockResolvedValue({ valid: true });

    const { getByPlaceholderText, getByText, store } = renderWithProviders(
      <LoginScreen navigation={mockNavigation as any} route={{} as any} />
    );

    const urlInput = getByPlaceholderText('https://readeck.example.com');
    const tokenInput = getByPlaceholderText('Enter your API token');

    fireEvent.changeText(urlInput, 'https://example.com');
    fireEvent.changeText(tokenInput, 'valid-token');

    const connectButton = getByText('Connect to Server');
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(validateApiToken).toHaveBeenCalledWith(
        'https://example.com',
        'valid-token'
      );
      expect(authStorageService.storeToken).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({
          serverUrl: 'https://example.com',
        })
      );
      expect(readeckApiService.updateConfig).toHaveBeenCalledWith({
        baseUrl: 'https://example.com/api',
      });
    });
  });

  it('should handle invalid credentials', async () => {
    (validateApiToken as jest.Mock).mockResolvedValue({ valid: false });

    const { getByPlaceholderText, getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation as any} route={{} as any} />
    );

    const urlInput = getByPlaceholderText('https://readeck.example.com');
    const tokenInput = getByPlaceholderText('Enter your API token');

    fireEvent.changeText(urlInput, 'https://example.com');
    fireEvent.changeText(tokenInput, 'invalid-token');

    const connectButton = getByText('Connect to Server');
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Login Failed',
        'Invalid credentials. Please check your server URL and API token.',
        [{ text: 'OK' }]
      );
    });
  });

  it('should handle network error during validation', async () => {
    (validateApiToken as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const { getByPlaceholderText, getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation as any} route={{} as any} />
    );

    const urlInput = getByPlaceholderText('https://readeck.example.com');
    const tokenInput = getByPlaceholderText('Enter your API token');

    fireEvent.changeText(urlInput, 'https://example.com');
    fireEvent.changeText(tokenInput, 'some-token');

    const connectButton = getByText('Connect to Server');
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Login Failed',
        'Network error',
        [{ text: 'OK' }]
      );
    });
  });

  it('should show loading state during validation', async () => {
    (validateApiToken as jest.Mock).mockImplementation(
      () =>
        new Promise(resolve => setTimeout(() => resolve({ valid: true }), 100))
    );

    const { getByPlaceholderText, getByText, UNSAFE_queryByType } =
      renderWithProviders(
        <LoginScreen navigation={mockNavigation as any} route={{} as any} />
      );

    const urlInput = getByPlaceholderText('https://readeck.example.com');
    const tokenInput = getByPlaceholderText('Enter your API token');

    fireEvent.changeText(urlInput, 'https://example.com');
    fireEvent.changeText(tokenInput, 'valid-token');

    const connectButton = getByText('Connect to Server');
    fireEvent.press(connectButton);

    // Should show loading indicator
    expect(UNSAFE_queryByType('ActivityIndicator')).toBeTruthy();

    await waitFor(() => {
      expect(authStorageService.storeToken).toHaveBeenCalled();
    });
  });

  it('should clear error on mount', () => {
    const store = createTestStore({
      auth: { error: 'Previous error' },
    });

    renderWithProviders(
      <LoginScreen navigation={mockNavigation as any} route={{} as any} />,
      store
    );

    expect(store.getState().auth.error).toBeNull();
  });

  it('should navigate to setup screen', () => {
    const { getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation as any} route={{} as any} />
    );

    const setupLink = getByText('Need help? Setup Guide');
    fireEvent.press(setupLink);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('Setup');
  });

  it('should trim whitespace from inputs', async () => {
    (validateApiToken as jest.Mock).mockResolvedValue({ valid: true });

    const { getByPlaceholderText, getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation as any} route={{} as any} />
    );

    const urlInput = getByPlaceholderText('https://readeck.example.com');
    const tokenInput = getByPlaceholderText('Enter your API token');

    fireEvent.changeText(urlInput, '  https://example.com  ');
    fireEvent.changeText(tokenInput, '  valid-token  ');

    const connectButton = getByText('Connect to Server');
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(validateApiToken).toHaveBeenCalledWith(
        'https://example.com',
        'valid-token'
      );
    });
  });

  it('should normalize server URL', async () => {
    (validateApiToken as jest.Mock).mockResolvedValue({ valid: true });

    const { getByPlaceholderText, getByText } = renderWithProviders(
      <LoginScreen navigation={mockNavigation as any} route={{} as any} />
    );

    const urlInput = getByPlaceholderText('https://readeck.example.com');
    const tokenInput = getByPlaceholderText('Enter your API token');

    fireEvent.changeText(urlInput, 'https://example.com/');
    fireEvent.changeText(tokenInput, 'valid-token');

    const connectButton = getByText('Connect to Server');
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(authStorageService.storeToken).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({
          serverUrl: 'https://example.com',
        })
      );
    });
  });
});
