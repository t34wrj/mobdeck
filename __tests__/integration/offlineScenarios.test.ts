import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { renderHook } from '@testing-library/react-native';
import { Provider, useSelector } from 'react-redux';
import articlesSlice, { loadLocalArticles, fetchArticles } from '../../src/store/slices/articlesSlice';
import authSlice from '../../src/store/slices/authSlice';
import syncSlice from '../../src/store/slices/syncSlice';
import { useAppInitialization } from '../../src/hooks/useAppInitialization';
import { Article } from '../../src/types';
import { RootState } from '../../src/store';

// Mock the hooks and services
jest.mock('../../src/hooks/useAppInitialization');
jest.mock('../../src/services/ReadeckApiService');
jest.mock('../../src/services/LocalStorageService');
jest.mock('../../src/services/DatabaseService');

// Mock console.log to reduce test noise
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('Offline Scenarios - Database → Redux → UI Pipeline Tests', () => {
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
    syncedAt: new Date().toISOString(),
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
        isOnline: false, // Start offline
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
    ({ children }: { children: React.ReactNode }) => {
      return React.createElement(Provider, { store }, children);
    };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks
    const mockUseAppInitialization = useAppInitialization as jest.MockedFunction<typeof useAppInitialization>;
    mockUseAppInitialization.mockReturnValue({
      isInitialized: true,
      isInitializing: false,
      initializationError: null,
    });
  });

  describe('Database → Redux Pipeline', () => {
    it('should load cached articles from database into Redux store', async () => {
      const cachedArticles = [
        createMockArticle({ id: 'cached-1', title: 'Cached Article 1' }),
        createMockArticle({ id: 'cached-2', title: 'Cached Article 2' }),
      ];

      // Mock local storage service
      const { localStorageService } = require('../../src/services/LocalStorageService');
      localStorageService.getArticles.mockResolvedValue({
        success: true,
        data: {
          items: cachedArticles.map(article => ({
            id: article.id,
            title: article.title,
            url: article.url,
            summary: article.summary,
            content: article.content,
            image_url: article.imageUrl,
            read_time: article.readTime,
            is_archived: article.isArchived ? 1 : 0,
            is_favorite: article.isFavorite ? 1 : 0,
            is_read: article.isRead ? 1 : 0,
            source_url: article.sourceUrl,
            created_at: new Date(article.createdAt).getTime() / 1000,
            updated_at: new Date(article.updatedAt).getTime() / 1000,
            synced_at: article.syncedAt ? new Date(article.syncedAt).getTime() / 1000 : null,
          })),
          totalCount: 2,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      });

      const store = createMockStore();

      // Dispatch loadLocalArticles
      await store.dispatch(loadLocalArticles({}));

      const state = store.getState();
      expect(state.articles.articles).toHaveLength(2);
      expect(state.articles.articles[0].title).toBe('Cached Article 1');
      expect(state.articles.articles[1].title).toBe('Cached Article 2');
      expect(state.articles.loading.fetch).toBe(false);
      expect(state.articles.error.fetch).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const { localStorageService } = require('../../src/services/LocalStorageService');
      localStorageService.getArticles.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      const store = createMockStore();

      // Dispatch loadLocalArticles
      await store.dispatch(loadLocalArticles({}));

      const state = store.getState();
      expect(state.articles.articles).toHaveLength(0);
      expect(state.articles.loading.fetch).toBe(false);
      expect(state.articles.error.fetch).toBe('Database connection failed');
    });

    it('should handle empty database correctly', async () => {
      // Mock empty database
      const { localStorageService } = require('../../src/services/LocalStorageService');
      localStorageService.getArticles.mockResolvedValue({
        success: true,
        data: {
          items: [],
          totalCount: 0,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      });

      const store = createMockStore();

      // Dispatch loadLocalArticles
      await store.dispatch(loadLocalArticles({}));

      const state = store.getState();
      expect(state.articles.articles).toHaveLength(0);
      expect(state.articles.loading.fetch).toBe(false);
      expect(state.articles.error.fetch).toBeNull();
      expect(state.articles.pagination.totalItems).toBe(0);
    });
  });

  describe('Offline API Fallback', () => {
    it('should fallback to local database when API fails due to offline status', async () => {
      const cachedArticles = [
        createMockArticle({ id: 'offline-1', title: 'Offline Article 1' }),
        createMockArticle({ id: 'offline-2', title: 'Offline Article 2' }),
      ];

      // Mock API failure
      const { readeckApiService } = require('../../src/services/ReadeckApiService');
      readeckApiService.fetchArticlesWithFilters.mockRejectedValue(new Error('Network error'));

      // Mock successful local storage fallback
      const { localStorageService } = require('../../src/services/LocalStorageService');
      localStorageService.getArticles.mockResolvedValue({
        success: true,
        data: {
          items: cachedArticles.map(article => ({
            id: article.id,
            title: article.title,
            url: article.url,
            summary: article.summary,
            content: article.content,
            image_url: article.imageUrl,
            read_time: article.readTime,
            is_archived: article.isArchived ? 1 : 0,
            is_favorite: article.isFavorite ? 1 : 0,
            is_read: article.isRead ? 1 : 0,
            source_url: article.sourceUrl,
            created_at: new Date(article.createdAt).getTime() / 1000,
            updated_at: new Date(article.updatedAt).getTime() / 1000,
            synced_at: article.syncedAt ? new Date(article.syncedAt).getTime() / 1000 : null,
          })),
          totalCount: 2,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      });

      const store = createMockStore();

      // Dispatch fetchArticles (should fallback to local)
      await store.dispatch(fetchArticles({}));

      const state = store.getState();
      expect(state.articles.articles).toHaveLength(2);
      expect(state.articles.articles[0].title).toBe('Offline Article 1');
      expect(state.articles.articles[1].title).toBe('Offline Article 2');
      expect(state.articles.loading.fetch).toBe(false);
      expect(state.articles.error.fetch).toBeNull();
    });

    it('should handle offline state with connection errors', async () => {
      // Mock network connection error
      const { readeckApiService } = require('../../src/services/ReadeckApiService');
      readeckApiService.fetchArticlesWithFilters.mockRejectedValue(new Error('CONNECTION_ERROR'));

      // Mock successful local storage fallback
      const { localStorageService } = require('../../src/services/LocalStorageService');
      localStorageService.getArticles.mockResolvedValue({
        success: true,
        data: {
          items: [
            {
              id: 'offline-article',
              title: 'Offline Article',
              url: 'https://example.com',
              summary: 'Cached offline',
              content: 'Offline content',
              image_url: null,
              read_time: 3,
              is_archived: 0,
              is_favorite: 0,
              is_read: 0,
              source_url: 'https://example.com',
              created_at: Date.now() / 1000,
              updated_at: Date.now() / 1000,
              synced_at: Date.now() / 1000,
            },
          ],
          totalCount: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      });

      const store = createMockStore();

      // Dispatch fetchArticles
      await store.dispatch(fetchArticles({}));

      const state = store.getState();
      expect(state.articles.articles).toHaveLength(1);
      expect(state.articles.articles[0].title).toBe('Offline Article');
      expect(state.articles.loading.fetch).toBe(false);
      expect(state.articles.error.fetch).toBeNull();
    });

    it('should handle offline state with no cached data', async () => {
      // Mock API failure
      const { readeckApiService } = require('../../src/services/ReadeckApiService');
      readeckApiService.fetchArticlesWithFilters.mockRejectedValue(new Error('offline'));

      // Mock empty local storage
      const { localStorageService } = require('../../src/services/LocalStorageService');
      localStorageService.getArticles.mockResolvedValue({
        success: true,
        data: {
          items: [],
          totalCount: 0,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      });

      const store = createMockStore();

      // Dispatch fetchArticles
      await store.dispatch(fetchArticles({}));

      const state = store.getState();
      expect(state.articles.articles).toHaveLength(0);
      expect(state.articles.loading.fetch).toBe(false);
      expect(state.articles.error.fetch).toBeNull();
      expect(state.articles.pagination.totalItems).toBe(0);
    });
  });

  describe('App Initialization Offline Scenarios', () => {
    it('should initialize app with cached articles when offline', async () => {
      const cachedArticles = [
        createMockArticle({ id: 'init-1', title: 'Initialization Article 1' }),
        createMockArticle({ id: 'init-2', title: 'Initialization Article 2' }),
      ];

      // Mock useAppInitialization to trigger loadLocalArticles
      const mockUseAppInitialization = useAppInitialization as jest.MockedFunction<typeof useAppInitialization>;
      mockUseAppInitialization.mockReturnValue({
        isInitialized: true,
        isInitializing: false,
        initializationError: null,
      });

      // Mock local storage service
      const { localStorageService } = require('../../src/services/LocalStorageService');
      localStorageService.getArticles.mockResolvedValue({
        success: true,
        data: {
          items: cachedArticles.map(article => ({
            id: article.id,
            title: article.title,
            url: article.url,
            summary: article.summary,
            content: article.content,
            image_url: article.imageUrl,
            read_time: article.readTime,
            is_archived: article.isArchived ? 1 : 0,
            is_favorite: article.isFavorite ? 1 : 0,
            is_read: article.isRead ? 1 : 0,
            source_url: article.sourceUrl,
            created_at: new Date(article.createdAt).getTime() / 1000,
            updated_at: new Date(article.updatedAt).getTime() / 1000,
            synced_at: article.syncedAt ? new Date(article.syncedAt).getTime() / 1000 : null,
          })),
          totalCount: 2,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      });

      const store = createMockStore();

      // Simulate app initialization loading cached articles
      await store.dispatch(loadLocalArticles({}));

      const state = store.getState();
      expect(state.articles.articles).toHaveLength(2);
      expect(state.articles.articles[0].title).toBe('Initialization Article 1');
      expect(state.articles.articles[1].title).toBe('Initialization Article 2');
      expect(state.sync.isOnline).toBe(false);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock initialization error
      const mockUseAppInitialization = useAppInitialization as jest.MockedFunction<typeof useAppInitialization>;
      mockUseAppInitialization.mockReturnValue({
        isInitialized: false,
        isInitializing: false,
        initializationError: 'Database initialization failed',
      });

      const store = createMockStore();
      const state = store.getState();

      // Should maintain safe state even with initialization error
      expect(state.articles.articles).toHaveLength(0);
      expect(state.articles.loading.fetch).toBe(false);
    });
  });

  describe('Content Loading Offline Scenarios', () => {
    it('should load content from cached articles when offline', async () => {
      const articleWithContent = createMockArticle({
        id: 'content-test',
        title: 'Article with Content',
        content: 'This is cached content that should be available offline',
      });

      const store = createMockStore({
        articles: {
          articles: [articleWithContent],
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

      // Test selector for content availability
      const { result } = renderHook(
        () => useSelector((state: RootState) => state.articles.articles.find(a => a.id === 'content-test')),
        { wrapper: createWrapper(store) }
      );

      expect(result.current).toBeTruthy();
      expect(result.current?.content).toBe('This is cached content that should be available offline');
    });

    it('should handle content loading errors in offline mode', async () => {
      const store = createMockStore();

      // Set content loading error
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId: 'offline-article', error: 'Content not available offline' },
      });

      const state = store.getState();
      expect(state.articles.contentErrors['offline-article']).toBe('Content not available offline');
      expect(state.articles.contentLoading['offline-article']).toBe(false);
    });
  });

  describe('Sync State Integration in Offline Mode', () => {
    it('should handle sync state when offline', async () => {
      const store = createMockStore({
        sync: {
          isOnline: false,
          lastSyncTime: null,
          isSyncing: false,
          syncError: 'Network unavailable',
          syncProgress: 0,
          itemsProcessed: 0,
          totalItems: 0,
          currentOperation: null,
          pendingOperations: [],
          networkType: 'none',
          syncStats: {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 1,
            lastSyncDuration: 0,
            averageSyncDuration: 0,
          },
        },
      });

      const { result } = renderHook(
        () => useSelector((state: RootState) => state.sync),
        { wrapper: createWrapper(store) }
      );

      expect(result.current.isOnline).toBe(false);
      expect(result.current.syncError).toBe('Network unavailable');
      expect(result.current.networkType).toBe('none');
      expect(result.current.syncStats.failedSyncs).toBe(1);
    });

    it('should handle transition from offline to online', async () => {
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

      let state = store.getState();
      expect(state.sync.isOnline).toBe(false);
      expect(state.sync.networkType).toBe('none');

      // Simulate coming online
      store.dispatch({
        type: 'sync/setOnline',
        payload: {
          isOnline: true,
          networkType: 'wifi',
        },
      });

      state = store.getState();
      expect(state.sync.isOnline).toBe(true);
      expect(state.sync.networkType).toBe('wifi');
    });
  });

  describe('Offline Data Persistence', () => {
    it('should maintain article data across offline sessions', async () => {
      const persistedArticles = [
        createMockArticle({ id: 'persist-1', title: 'Persisted Article 1' }),
        createMockArticle({ id: 'persist-2', title: 'Persisted Article 2' }),
      ];

      // Mock local storage with persisted data
      const { localStorageService } = require('../../src/services/LocalStorageService');
      localStorageService.getArticles.mockResolvedValue({
        success: true,
        data: {
          items: persistedArticles.map(article => ({
            id: article.id,
            title: article.title,
            url: article.url,
            summary: article.summary,
            content: article.content,
            image_url: article.imageUrl,
            read_time: article.readTime,
            is_archived: article.isArchived ? 1 : 0,
            is_favorite: article.isFavorite ? 1 : 0,
            is_read: article.isRead ? 1 : 0,
            source_url: article.sourceUrl,
            created_at: new Date(article.createdAt).getTime() / 1000,
            updated_at: new Date(article.updatedAt).getTime() / 1000,
            synced_at: article.syncedAt ? new Date(article.syncedAt).getTime() / 1000 : null,
          })),
          totalCount: 2,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      });

      const store = createMockStore();

      // Load persisted articles
      await store.dispatch(loadLocalArticles({}));

      const state = store.getState();
      expect(state.articles.articles).toHaveLength(2);
      expect(state.articles.articles[0].title).toBe('Persisted Article 1');
      expect(state.articles.articles[1].title).toBe('Persisted Article 2');
    });

    it('should handle local article modifications in offline mode', async () => {
      const store = createMockStore();
      const article = createMockArticle({ id: 'local-modify', title: 'Original Title' });

      // Add article to store
      store.dispatch({
        type: 'articles/updateArticleLocal',
        payload: {
          id: article.id,
          updates: article,
        },
      });

      let state = store.getState();
      expect(state.articles.articles).toHaveLength(1);
      expect(state.articles.articles[0].title).toBe('Original Title');

      // Modify article offline
      store.dispatch({
        type: 'articles/updateArticleLocal',
        payload: {
          id: article.id,
          updates: { title: 'Modified Offline', isRead: true },
        },
      });

      state = store.getState();
      expect(state.articles.articles[0].title).toBe('Modified Offline');
      expect(state.articles.articles[0].isRead).toBe(true);
      expect(state.articles.sync.pendingChanges).toContain(article.id);
    });

    it('should handle pending changes tracking in offline mode', async () => {
      const store = createMockStore();
      const articles = [
        createMockArticle({ id: 'pending-1', title: 'Pending Article 1' }),
        createMockArticle({ id: 'pending-2', title: 'Pending Article 2' }),
      ];

      // Add articles with modifications
      articles.forEach(article => {
        store.dispatch({
          type: 'articles/updateArticleLocal',
          payload: {
            id: article.id,
            updates: { ...article, isRead: true },
          },
        });
      });

      const state = store.getState();
      expect(state.articles.sync.pendingChanges).toContain('pending-1');
      expect(state.articles.sync.pendingChanges).toContain('pending-2');
      expect(state.articles.articles).toHaveLength(2);
      expect(state.articles.articles[0].isRead).toBe(true);
      expect(state.articles.articles[1].isRead).toBe(true);
    });
  });

  describe('Error Recovery in Offline Mode', () => {
    it('should recover from database errors gracefully', async () => {
      const store = createMockStore();

      // Mock database error
      const { localStorageService } = require('../../src/services/LocalStorageService');
      localStorageService.getArticles.mockRejectedValue(new Error('Database corrupted'));

      // Try to load articles
      await store.dispatch(loadLocalArticles({}));

      let state = store.getState();
      expect(state.articles.loading.fetch).toBe(false);
      expect(state.articles.error.fetch).toBe('Database corrupted');
      expect(state.articles.articles).toHaveLength(0);

      // Simulate database recovery
      localStorageService.getArticles.mockResolvedValue({
        success: true,
        data: {
          items: [{
            id: 'recovered-article',
            title: 'Recovered Article',
            url: 'https://example.com',
            summary: 'Recovered from database error',
            content: 'Recovery content',
            image_url: null,
            read_time: 2,
            is_archived: 0,
            is_favorite: 0,
            is_read: 0,
            source_url: 'https://example.com',
            created_at: Date.now() / 1000,
            updated_at: Date.now() / 1000,
            synced_at: Date.now() / 1000,
          }],
          totalCount: 1,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      });

      // Clear error and retry
      store.dispatch({
        type: 'articles/clearError',
        payload: 'fetch',
      });

      await store.dispatch(loadLocalArticles({}));

      state = store.getState();
      expect(state.articles.loading.fetch).toBe(false);
      expect(state.articles.error.fetch).toBeNull();
      expect(state.articles.articles).toHaveLength(1);
      expect(state.articles.articles[0].title).toBe('Recovered Article');
    });

    it('should handle content loading errors with graceful fallback', async () => {
      const store = createMockStore();

      // Set content loading error
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId: 'error-article', error: 'Content fetch failed' },
      });

      let state = store.getState();
      expect(state.articles.contentErrors['error-article']).toBe('Content fetch failed');
      expect(state.articles.contentLoading['error-article']).toBe(false);

      // Clear error and retry
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId: 'error-article', error: null },
      });

      store.dispatch({
        type: 'articles/setContentLoading',
        payload: { articleId: 'error-article', loading: false },
      });

      state = store.getState();
      expect(state.articles.contentErrors['error-article']).toBeUndefined();
      expect(state.articles.contentLoading['error-article']).toBe(false);
    });
  });
});