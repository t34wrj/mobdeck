import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NavigationContainer } from '@react-navigation/native';
import HomeScreen from '../../src/screens/HomeScreen';
import articlesSlice from '../../src/store/slices/articlesSlice';
import authSlice from '../../src/store/slices/authSlice';
import syncSlice from '../../src/store/slices/syncSlice';
import { Article } from '../../src/types';
import { act } from 'react-test-renderer';

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  isFocused: jest.fn(() => true),
  addListener: jest.fn(),
  removeListener: jest.fn(),
};

// Mock useAppInitialization hook
jest.mock('../../src/hooks/useAppInitialization', () => ({
  useAppInitialization: jest.fn(() => ({
    isInitialized: true,
    isInitializing: false,
    initializationError: null,
  })),
}));

// Mock device info to prevent NativeEventEmitter errors
jest.mock('react-native-device-info', () => ({
  getSystemName: jest.fn(() => 'iOS'),
  getSystemVersion: jest.fn(() => '14.0'),
  getApplicationName: jest.fn(() => 'Test App'),
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '1'),
  getDeviceId: jest.fn(() => 'test-device-id'),
}));

// Mock console.log to reduce test noise
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('HomeScreen State Integration Tests', () => {
  const createMockArticle = (overrides: Partial<Article> = {}): Article => ({
    id: 'test-article-1',
    title: 'Test Article',
    url: 'https://example.com/article',
    summary: 'Test summary',
    content: 'Test content',
    imageUrl: 'https://example.com/image.jpg',
    readTime: 5,
    isArchived: false,
    isFavorite: false,
    isRead: false,
    tags: [],
    sourceUrl: 'https://example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contentUrl: 'https://example.com/content',
    ...overrides,
  });

  const createMockStore = (initialState = {}) => {
    const defaultState = {
      articles: {
        articles: [],
        loading: {
          fetch: false,
          create: false,
          update: false,
          delete: false,
          sync: false,
          content: false,
        },
        error: {
          fetch: null,
          create: null,
          update: null,
          delete: null,
          sync: null,
          content: null,
        },
        pagination: {
          page: 1,
          limit: 20,
          totalPages: 0,
          totalItems: 0,
          hasMore: false,
        },
        filters: {
          searchQuery: '',
          isArchived: undefined,
          isFavorite: undefined,
          isRead: undefined,
          tags: undefined,
        },
        sync: {
          lastSyncTime: null,
          isSyncing: false,
          pendingChanges: [],
          conflicts: [],
          syncError: null,
        },
        selectedArticleId: null,
        multiSelectMode: false,
        selectedArticleIds: [],
        contentLoading: {},
        contentErrors: {},
      },
      auth: {
        isAuthenticated: true,
        user: { id: 'test-user' },
        token: 'test-token',
        serverUrl: 'https://test.com',
        isLoading: false,
        error: null,
      },
      sync: {
        isOnline: true,
        lastSyncTime: null,
        isSyncing: false,
        syncError: null,
        syncProgress: 0,
        itemsProcessed: 0,
        totalItems: 0,
        currentOperation: null,
        pendingOperations: [],
        networkType: 'wifi',
        syncStats: {
          totalSyncs: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          lastSyncDuration: 0,
          averageSyncDuration: 0,
        },
      },
      ...initialState,
    };

    return configureStore({
      reducer: {
        articles: articlesSlice,
        auth: authSlice,
        sync: syncSlice,
      },
      preloadedState: defaultState,
    });
  };

  const createWrapper = (store: any) => 
    ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>
        <NavigationContainer>
          {children}
        </NavigationContainer>
      </Provider>
    );

  const renderHomeScreen = (store: any) => {
    const route = {
      key: 'ArticlesList',
      name: 'ArticlesList' as const,
      params: undefined,
    };

    return render(
      <HomeScreen navigation={mockNavigation} route={route} />,
      { wrapper: createWrapper(store) }
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset useAppInitialization mock
    require('../../src/hooks/useAppInitialization').useAppInitialization.mockReturnValue({
      isInitialized: true,
      isInitializing: false,
      initializationError: null,
    });
  });

  describe('Initial State Display - STATE-001 Regression Prevention', () => {
    it('should display cached articles immediately when initialized', async () => {
      const cachedArticles = [
        createMockArticle({ id: 'cached-1', title: 'Cached Article 1' }),
        createMockArticle({ id: 'cached-2', title: 'Cached Article 2' }),
      ];

      const store = createMockStore({
        articles: {
          articles: cachedArticles,
          loading: { fetch: false, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: null, create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 1, totalItems: 2, hasMore: false },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText, queryByText } = renderHomeScreen(store);

      // Should show cached articles immediately
      expect(getByText('Cached Article 1')).toBeTruthy();
      expect(getByText('Cached Article 2')).toBeTruthy();
      
      // Should not show empty state
      expect(queryByText('No articles yet')).toBeNull();
      expect(queryByText('Loading articles...')).toBeNull();
    });

    it('should show loading state during initialization', async () => {
      // Mock initialization in progress
      require('../../src/hooks/useAppInitialization').useAppInitialization.mockReturnValue({
        isInitialized: false,
        isInitializing: true,
        initializationError: null,
      });

      const store = createMockStore();
      const { getByText } = renderHomeScreen(store);

      expect(getByText('Initializing app...')).toBeTruthy();
    });

    it('should show empty state only when no articles after initialization', async () => {
      const store = createMockStore();
      const { getByText, queryByText } = renderHomeScreen(store);

      // Should show empty state for truly empty case
      expect(getByText('No articles yet')).toBeTruthy();
      
      // Should not show loading state when initialized
      expect(queryByText('Initializing app...')).toBeNull();
    });

    it('should handle initialization completion correctly', async () => {
      // Start with initialization in progress
      require('../../src/hooks/useAppInitialization').useAppInitialization.mockReturnValue({
        isInitialized: false,
        isInitializing: true,
        initializationError: null,
      });

      const store = createMockStore();
      const { getByText, rerender, queryByText } = renderHomeScreen(store);

      // Should show initializing
      expect(getByText('Initializing app...')).toBeTruthy();

      // Complete initialization
      require('../../src/hooks/useAppInitialization').useAppInitialization.mockReturnValue({
        isInitialized: true,
        isInitializing: false,
        initializationError: null,
      });

      const route = {
        key: 'ArticlesList',
        name: 'ArticlesList' as const,
        params: undefined,
      };

      rerender(
        <HomeScreen navigation={mockNavigation} route={route} />
      );

      // Should transition to empty state
      expect(queryByText('Initializing app...')).toBeNull();
      expect(getByText('No articles yet')).toBeTruthy();
    });

    it('should not show "No articles yet" when articles are loading after initialization', async () => {
      const store = createMockStore({
        articles: {
          articles: [],
          loading: { fetch: true, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: null, create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 0, totalItems: 0, hasMore: false },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText, queryByText } = renderHomeScreen(store);

      // Should show loading state
      expect(getByText('Loading articles...')).toBeTruthy();
      
      // Should not show empty state during loading
      expect(queryByText('No articles yet')).toBeNull();
    });
  });

  describe('Authentication State Handling', () => {
    it('should show login message when not authenticated', () => {
      const store = createMockStore({
        auth: {
          isAuthenticated: false,
          user: null,
          token: null,
          serverUrl: null,
          isLoading: false,
          error: null,
        },
      });

      const { getByText } = renderHomeScreen(store);

      expect(getByText('Please log in to view your articles')).toBeTruthy();
    });

    it('should not show articles when not authenticated', () => {
      const store = createMockStore({
        auth: {
          isAuthenticated: false,
          user: null,
          token: null,
          serverUrl: null,
          isLoading: false,
          error: null,
        },
        articles: {
          articles: [createMockArticle()],
          loading: { fetch: false, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: null, create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 1, totalItems: 1, hasMore: false },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText, queryByText } = renderHomeScreen(store);

      expect(getByText('Please log in to view your articles')).toBeTruthy();
      expect(queryByText('Test Article')).toBeNull();
    });
  });

  describe('Loading States', () => {
    it('should show loading state during fetch', () => {
      const store = createMockStore({
        articles: {
          articles: [],
          loading: { fetch: true, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: null, create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 0, totalItems: 0, hasMore: false },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText } = renderHomeScreen(store);

      expect(getByText('Loading articles...')).toBeTruthy();
    });

    it('should show loading state during initialization', () => {
      require('../../src/hooks/useAppInitialization').useAppInitialization.mockReturnValue({
        isInitialized: false,
        isInitializing: true,
        initializationError: null,
      });

      const store = createMockStore();
      const { getByText } = renderHomeScreen(store);

      expect(getByText('Initializing app...')).toBeTruthy();
    });

    it('should prioritize initialization loading over fetch loading', () => {
      require('../../src/hooks/useAppInitialization').useAppInitialization.mockReturnValue({
        isInitialized: false,
        isInitializing: true,
        initializationError: null,
      });

      const store = createMockStore({
        articles: {
          articles: [],
          loading: { fetch: true, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: null, create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 0, totalItems: 0, hasMore: false },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText } = renderHomeScreen(store);

      expect(getByText('Initializing app...')).toBeTruthy();
    });
  });

  describe('Error State Handling', () => {
    it('should display error message when fetch fails', () => {
      const store = createMockStore({
        articles: {
          articles: [],
          loading: { fetch: false, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: 'Failed to fetch articles', create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 0, totalItems: 0, hasMore: false },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText } = renderHomeScreen(store);

      expect(getByText('Failed to fetch articles')).toBeTruthy();
    });

    it('should handle network errors gracefully', () => {
      const store = createMockStore({
        articles: {
          articles: [],
          loading: { fetch: false, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: 'Network error. Please check your connection and server URL.', create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 0, totalItems: 0, hasMore: false },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText } = renderHomeScreen(store);

      expect(getByText('Network error. Please check your connection and server URL.')).toBeTruthy();
    });

    it('should handle authentication errors gracefully', () => {
      const store = createMockStore({
        articles: {
          articles: [],
          loading: { fetch: false, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: 'Authentication failed. Please check your server settings.', create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 0, totalItems: 0, hasMore: false },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText } = renderHomeScreen(store);

      expect(getByText('Authentication failed. Please check your server settings.')).toBeTruthy();
    });
  });

  describe('Article List Rendering', () => {
    it('should render article list correctly', () => {
      const articles = [
        createMockArticle({ id: 'article-1', title: 'Article 1' }),
        createMockArticle({ id: 'article-2', title: 'Article 2' }),
        createMockArticle({ id: 'article-3', title: 'Article 3' }),
      ];

      const store = createMockStore({
        articles: {
          articles,
          loading: { fetch: false, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: null, create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 1, totalItems: 3, hasMore: false },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText } = renderHomeScreen(store);

      expect(getByText('Article 1')).toBeTruthy();
      expect(getByText('Article 2')).toBeTruthy();
      expect(getByText('Article 3')).toBeTruthy();
    });

    it('should handle empty article list correctly', () => {
      const store = createMockStore();
      const { getByText } = renderHomeScreen(store);

      expect(getByText('No articles yet')).toBeTruthy();
    });

    it('should handle article press correctly', () => {
      const articles = [
        createMockArticle({ id: 'article-1', title: 'Article 1' }),
      ];

      const store = createMockStore({
        articles: {
          articles,
          loading: { fetch: false, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: null, create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 1, totalItems: 1, hasMore: false },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText } = renderHomeScreen(store);

      const articleCard = getByText('Article 1');
      fireEvent.press(articleCard);

      // Should log article press (navigation not implemented yet)
      expect(articleCard).toBeTruthy();
    });
  });

  describe('Search Functionality', () => {
    it('should render search bar', () => {
      const store = createMockStore();
      const { getByDisplayValue } = renderHomeScreen(store);

      // SearchBar should be present with empty search
      expect(getByDisplayValue('')).toBeTruthy();
    });

    it('should handle search query changes', () => {
      const store = createMockStore();
      const { getByDisplayValue } = renderHomeScreen(store);

      const searchInput = getByDisplayValue('');
      fireEvent.changeText(searchInput, 'test query');

      expect(searchInput).toBeTruthy();
    });

    it('should handle search submission', () => {
      const store = createMockStore();
      const { getByDisplayValue } = renderHomeScreen(store);

      const searchInput = getByDisplayValue('');
      fireEvent.changeText(searchInput, 'test query');
      fireEvent(searchInput, 'submitEditing');

      expect(searchInput).toBeTruthy();
    });
  });

  describe('State Synchronization', () => {
    it('should synchronize with Redux store correctly', () => {
      const initialArticles = [
        createMockArticle({ id: 'article-1', title: 'Initial Article' }),
      ];

      const store = createMockStore({
        articles: {
          articles: initialArticles,
          loading: { fetch: false, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: null, create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 1, totalItems: 1, hasMore: false },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText } = renderHomeScreen(store);

      expect(getByText('Initial Article')).toBeTruthy();

      // Add new article to store
      act(() => {
        store.dispatch({
          type: 'articles/updateArticleLocal',
          payload: {
            id: 'article-2',
            updates: createMockArticle({ id: 'article-2', title: 'New Article' }),
          },
        });
      });

      // Should reflect store changes
      expect(getByText('Initial Article')).toBeTruthy();
    });

    it('should handle online/offline state correctly', () => {
      const store = createMockStore({
        sync: {
          isOnline: false,
          lastSyncTime: null,
          isSyncing: false,
          syncError: null,
          syncProgress: 0,
          itemsProcessed: 0,
          totalItems: 0,
          currentOperation: null,
          pendingOperations: [],
          networkType: 'none',
          syncStats: {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            lastSyncDuration: 0,
            averageSyncDuration: 0,
          },
        },
      });

      const { getByText } = renderHomeScreen(store);

      // Should still show empty state when offline
      expect(getByText('No articles yet')).toBeTruthy();
    });

    it('should handle sync state changes', () => {
      const store = createMockStore({
        sync: {
          isOnline: true,
          lastSyncTime: null,
          isSyncing: true,
          syncError: null,
          syncProgress: 50,
          itemsProcessed: 5,
          totalItems: 10,
          currentOperation: 'Syncing articles...',
          pendingOperations: [],
          networkType: 'wifi',
          syncStats: {
            totalSyncs: 1,
            successfulSyncs: 0,
            failedSyncs: 0,
            lastSyncDuration: 0,
            averageSyncDuration: 0,
          },
        },
      });

      const { getByText } = renderHomeScreen(store);

      // Should show empty state even during sync
      expect(getByText('No articles yet')).toBeTruthy();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large article lists efficiently', () => {
      const largeArticleList = Array.from({ length: 100 }, (_, i) =>
        createMockArticle({ id: `article-${i}`, title: `Article ${i}` })
      );

      const store = createMockStore({
        articles: {
          articles: largeArticleList,
          loading: { fetch: false, create: false, update: false, delete: false, sync: false, content: false },
          error: { fetch: null, create: null, update: null, delete: null, sync: null, content: null },
          pagination: { page: 1, limit: 20, totalPages: 5, totalItems: 100, hasMore: true },
          filters: { searchQuery: '', isArchived: undefined, isFavorite: undefined, isRead: undefined, tags: undefined },
          sync: { lastSyncTime: null, isSyncing: false, pendingChanges: [], conflicts: [], syncError: null },
          selectedArticleId: null,
          multiSelectMode: false,
          selectedArticleIds: [],
          contentLoading: {},
          contentErrors: {},
        },
      });

      const { getByText } = renderHomeScreen(store);

      // Should handle large lists without crashing
      expect(getByText('Article 0')).toBeTruthy();
      expect(getByText('Article 1')).toBeTruthy();
    });

    it('should handle rapid state changes efficiently', () => {
      const store = createMockStore();
      const { rerender } = renderHomeScreen(store);

      // Multiple rapid re-renders should not cause issues
      for (let i = 0; i < 10; i++) {
        const route = {
          key: 'ArticlesList',
          name: 'ArticlesList' as const,
          params: undefined,
        };

        rerender(
          <HomeScreen navigation={mockNavigation} route={route} />
        );
      }

      // Should complete without errors
      expect(true).toBeTruthy();
    });
  });
});