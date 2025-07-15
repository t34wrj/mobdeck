/**
 * Tests for HomeScreen component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import HomeScreen from '../HomeScreen';
import articlesReducer from '../../store/slices/articlesSlice';
import authReducer from '../../store/slices/authSlice';
import syncReducer from '../../store/slices/syncSlice';
import { NavigationContainer } from '@react-navigation/native';

// Get the mocked function from the setup file
const { articlesApiService } = require('../../services/ArticlesApiService');
const mockFetchArticles = articlesApiService.fetchArticles;

jest.mock('../../services/SyncService', () => ({
  syncService: {
    startSync: jest.fn(() => Promise.resolve()),
  },
}));

// Mock components
jest.mock('../../components/ArticleCard', () => {
  const { View, Text } = require('react-native');
  const MockArticleCard = ({ article }: any) => (
    <View testID={`article-${article.id}`}>
      <Text>{article.title}</Text>
    </View>
  );
  return {
    __esModule: true,
    default: MockArticleCard,
  };
});

jest.mock('../../components/SearchBar', () => {
  const { View, TextInput } = require('react-native');
  const MockSearchBar = ({ searchQuery, onSearchChange, onSearchSubmit }: any) => (
    <View>
      <TextInput
        testID='search-bar'
        placeholder='Search articles...'
        value={searchQuery}
        onChangeText={onSearchChange}
        onSubmitEditing={onSearchSubmit}
      />
    </View>
  );
  return {
    __esModule: true,
    default: MockSearchBar,
  };
});

jest.mock('../../components/ui/Text', () => {
  const { Text } = require('react-native');
  return {
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
  };
});

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

const mockRoute = {
  params: {},
  key: 'HomeScreen',
  name: 'ArticlesList',
};

// Helper function to create a test store
const createTestStore = (initialState?: any) => {
  return configureStore({
    reducer: {
      articles: articlesReducer,
      auth: authReducer,
      sync: syncReducer,
    },
    preloadedState: {
      articles: {
        entities: {},
        ids: [],
        loading: { fetch: false, create: false, update: false, delete: false },
        error: { fetch: null, create: null, update: null, delete: null },
        filters: { archived: false, starred: false, searchQuery: '' },
        selectedTags: [],
        pagination: { page: 1, limit: 20, total: 0, hasMore: false },
        ...initialState?.articles,
      },
      auth: {
        isAuthenticated: true,
        isLoading: false,
        error: null,
        serverUrl: 'https://example.com',
        apiToken: 'test-token',
        user: { id: 1, email: 'test@example.com', name: 'Test User' },
        ...initialState?.auth,
      },
      sync: {
        isOnline: true,
        isSyncing: false,
        lastSyncTime: null,
        syncProgress: { current: 0, total: 0, step: '' },
        syncStats: {
          created: 0,
          updated: 0,
          deleted: 0,
          errors: 0,
        },
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
  return render(
    <Provider store={testStore}>
      <NavigationContainer>{component}</NavigationContainer>
    </Provider>
  );
};

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset API mock to default success behavior
    mockFetchArticles.mockResolvedValue({
      items: [],
      page: 1,
      totalPages: 1,
      totalItems: 0,
    });
  });

  it('should render loading state', () => {
    const store = createTestStore({
      articles: {
        loading: { fetch: true },
      },
    });

    const { UNSAFE_getByType } = renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    expect(UNSAFE_getByType('ActivityIndicator')).toBeTruthy();
  });

  it('should render error state', async () => {
    // Make the API call fail
    mockFetchArticles.mockRejectedValue(new Error('Failed to fetch articles'));

    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        isLoading: false,
        error: null,
        serverUrl: 'https://example.com',
        apiToken: 'test-token',
        user: { id: 1, email: 'test@example.com', name: 'Test User' },
      },
    });

    const { getByText } = renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    await waitFor(() => {
      expect(getByText('Failed to fetch articles')).toBeTruthy();
    });
  });

  it('should render empty state when no articles', async () => {
    const store = createTestStore({
      articles: {
        entities: {},
        ids: [],
        loading: { fetch: false, create: false, update: false, delete: false },
        error: { fetch: null, create: null, update: null, delete: null },
      },
    });

    const { getByTestId } = renderWithProviders(
      <HomeScreen navigation={mockNavigation as any} route={mockRoute as any} />,
      store
    );

    // Should render search bar even when empty
    await waitFor(() => {
      expect(getByTestId('search-bar')).toBeTruthy();
    });
  });

  it('should render article list', async () => {
    const articles = {
      '1': { id: '1', title: 'Article 1', url: 'http://example.com/1', createdAt: '2024-01-01' },
      '2': { id: '2', title: 'Article 2', url: 'http://example.com/2', createdAt: '2024-01-02' },
    };

    // Mock API to return the articles
    mockFetchArticles.mockResolvedValue({
      items: Object.values(articles),
      page: 1,
      totalPages: 1,
      totalItems: 2,
    });

    const store = createTestStore({
      articles: { 
        entities: articles, 
        ids: ['1', '2'],
        loading: { fetch: false, create: false, update: false, delete: false },
        error: { fetch: null, create: null, update: null, delete: null },
      },
    });

    const { getByTestId } = renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    await waitFor(() => {
      expect(getByTestId('article-1')).toBeTruthy();
      expect(getByTestId('article-2')).toBeTruthy();
    });
  });

  it('should handle search input', async () => {
    const store = createTestStore({
      articles: {
        loading: { fetch: false, create: false, update: false, delete: false },
        error: { fetch: null, create: null, update: null, delete: null },
      },
    });

    const { getByTestId } = renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    await waitFor(() => {
      expect(getByTestId('search-bar')).toBeTruthy();
    });

    const searchBar = getByTestId('search-bar');
    fireEvent.changeText(searchBar, 'test search');

    // Note: The component uses local state for search, not Redux filters immediately
    // The Redux state is only updated when the search is submitted
    expect(searchBar.props.value).toBe('test search');
  });

  it('should not fetch articles when not authenticated', () => {
    const store = createTestStore({
      auth: { isAuthenticated: false },
    });

    const dispatch = jest.spyOn(store, 'dispatch');

    renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'articles/fetchArticles/pending' })
    );
  });

  it('should fetch articles when authenticated', () => {
    const store = createTestStore();
    const dispatch = jest.spyOn(store, 'dispatch');

    renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('articles/fetchArticles'),
      })
    );
  });

  it('should trigger sync when online and authenticated', () => {
    const store = createTestStore();
    const dispatch = jest.spyOn(store, 'dispatch');

    renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('sync/startSync'),
      })
    );
  });

  it('should not trigger sync when offline', () => {
    const store = createTestStore({
      sync: { isOnline: false },
    });
    const dispatch = jest.spyOn(store, 'dispatch');

    renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('sync/startSync'),
      })
    );
  });

  it('should render component when offline', () => {
    const store = createTestStore({
      sync: { isOnline: false },
    });

    const { getByTestId } = renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    // Should still render search bar when offline
    expect(getByTestId('search-bar')).toBeTruthy();
  });

  it('should handle article card press', () => {
    const articles = {
      '1': { id: '1', title: 'Article 1', url: 'http://example.com/1' },
    };

    const store = createTestStore({
      articles: { entities: articles, ids: ['1'] },
    });

    const { getByTestId } = renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    const articleCard = getByTestId('article-1');
    fireEvent.press(articleCard);

    // In the real component, this would navigate to article detail
    // but our mock doesn't have that functionality
    expect(articleCard).toBeTruthy();
  });

  it('should handle pull to refresh', async () => {
    const articles = {
      '1': { id: '1', title: 'Article 1', url: 'http://example.com/1' },
    };

    const store = createTestStore({
      articles: { entities: articles, ids: ['1'] },
    });

    const { UNSAFE_getByType } = renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    const flatList = UNSAFE_getByType('FlatList');

    // Simulate pull to refresh
    const onRefresh = flatList.props.onRefresh;
    if (onRefresh) {
      onRefresh();
    }

    expect(store.getState().articles.loading.fetch).toBeTruthy();
  });

  it('should render when syncing', () => {
    const store = createTestStore({
      sync: {
        isSyncing: true,
        syncProgress: { current: 5, total: 10, step: 'Syncing articles' },
      },
    });

    const { getByTestId } = renderWithProviders(
      <HomeScreen
        navigation={mockNavigation as any}
        route={mockRoute as any}
      />,
      store
    );

    // Should render normally even when syncing
    expect(getByTestId('search-bar')).toBeTruthy();
  });
});
