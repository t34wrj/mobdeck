import { configureStore } from '@reduxjs/toolkit';
import articlesSlice, { fetchArticles, updateArticleLocalWithDB } from '../../src/store/slices/articlesSlice';
import authSlice from '../../src/store/slices/authSlice';
import syncSlice from '../../src/store/slices/syncSlice';
import { Article } from '../../src/types';

// Mock external dependencies
jest.mock('../../src/services/ReadeckApiService', () => ({
  readeckApiService: {
    fetchArticlesWithFilters: jest.fn(),
    createArticleWithMetadata: jest.fn(),
    updateArticleWithMetadata: jest.fn(),
    deleteArticle: jest.fn(),
    getArticleWithContent: jest.fn(),
  },
}));

jest.mock('../../src/services/LocalStorageService', () => ({
  localStorageService: {
    getArticles: jest.fn(),
    updateArticleFromAppFormat: jest.fn(),
    createArticle: jest.fn(),
    deleteArticle: jest.fn(),
  },
}));

// Mock console.log to reduce test noise
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('Cross-Component State Management Integration Tests', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Redux State Flow Integration', () => {
    it('should maintain state consistency across all slices', () => {
      const store = createMockStore();

      // Initial state should be consistent
      const initialState = store.getState();
      expect(initialState.articles.articles).toEqual([]);
      expect(initialState.auth.isAuthenticated).toBe(true);
      expect(initialState.sync.isOnline).toBe(true);
    });

    it('should handle article updates with proper state propagation', () => {
      const store = createMockStore();
      const article = createMockArticle();

      // Add article to store
      store.dispatch({
        type: 'articles/updateArticleLocal',
        payload: {
          id: article.id,
          updates: article,
        },
      });

      const state = store.getState();
      expect(state.articles.articles).toHaveLength(1);
      expect(state.articles.articles[0]).toEqual(
        expect.objectContaining({
          id: article.id,
          title: article.title,
          content: article.content,
        })
      );
    });

    it('should handle authentication state changes across components', () => {
      const store = createMockStore();

      // Simulate logout
      store.dispatch({
        type: 'auth/logout',
      });

      const state = store.getState();
      expect(state.auth.isAuthenticated).toBe(false);
      expect(state.auth.user).toBeNull();
      expect(state.auth.token).toBeNull();
    });

    it('should handle sync state changes with proper coordination', () => {
      const store = createMockStore();

      // Start sync
      store.dispatch({
        type: 'sync/setSyncInProgress',
        payload: {
          operation: 'Syncing articles...',
          progress: 0,
        },
      });

      let state = store.getState();
      expect(state.sync.isSyncing).toBe(true);
      expect(state.sync.currentOperation).toBe('Syncing articles...');

      // Complete sync
      store.dispatch({
        type: 'sync/setSyncCompleted',
        payload: {
          syncTime: new Date().toISOString(),
          itemsProcessed: 10,
        },
      });

      state = store.getState();
      expect(state.sync.isSyncing).toBe(false);
      expect(state.sync.currentOperation).toBeNull();
    });
  });

  describe('Content Loading State Management', () => {
    it('should handle content loading states consistently', () => {
      const store = createMockStore();
      const articleId = 'test-article-1';

      // Set loading state
      store.dispatch({
        type: 'articles/setContentLoading',
        payload: { articleId, loading: true },
      });

      let state = store.getState();
      expect(state.articles.contentLoading[articleId]).toBe(true);
      expect(state.articles.contentErrors[articleId]).toBeUndefined();

      // Set error state
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId, error: 'Failed to load content' },
      });

      state = store.getState();
      expect(state.articles.contentLoading[articleId]).toBe(false);
      expect(state.articles.contentErrors[articleId]).toBe('Failed to load content');

      // Clear error
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId, error: null },
      });

      state = store.getState();
      expect(state.articles.contentErrors[articleId]).toBeUndefined();
    });

    it('should handle multiple articles content loading simultaneously', () => {
      const store = createMockStore();
      const articleIds = ['article-1', 'article-2', 'article-3'];

      // Set multiple articles loading
      articleIds.forEach(articleId => {
        store.dispatch({
          type: 'articles/setContentLoading',
          payload: { articleId, loading: true },
        });
      });

      let state = store.getState();
      articleIds.forEach(articleId => {
        expect(state.articles.contentLoading[articleId]).toBe(true);
      });

      // Complete loading for one article
      store.dispatch({
        type: 'articles/setContentLoading',
        payload: { articleId: articleIds[0], loading: false },
      });

      state = store.getState();
      expect(state.articles.contentLoading[articleIds[0]]).toBe(false);
      expect(state.articles.contentLoading[articleIds[1]]).toBe(true);
      expect(state.articles.contentLoading[articleIds[2]]).toBe(true);

      // Set error for second article
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId: articleIds[1], error: 'Network error' },
      });

      state = store.getState();
      expect(state.articles.contentLoading[articleIds[1]]).toBe(false);
      expect(state.articles.contentErrors[articleIds[1]]).toBe('Network error');
      expect(state.articles.contentLoading[articleIds[2]]).toBe(true);
    });
  });

  describe('Article State Updates and Persistence', () => {
    it('should handle article updates without losing existing data', () => {
      const store = createMockStore();
      const originalArticle = createMockArticle({
        id: 'article-1',
        title: 'Original Title',
        content: 'Original content',
        isRead: false,
      });

      // Add initial article
      store.dispatch({
        type: 'articles/updateArticleLocal',
        payload: {
          id: originalArticle.id,
          updates: originalArticle,
        },
      });

      let state = store.getState();
      expect(state.articles.articles[0]).toEqual(
        expect.objectContaining({
          title: 'Original Title',
          content: 'Original content',
          isRead: false,
        })
      );

      // Update only the read status
      store.dispatch({
        type: 'articles/updateArticleLocal',
        payload: {
          id: originalArticle.id,
          updates: { isRead: true },
        },
      });

      state = store.getState();
      expect(state.articles.articles[0]).toEqual(
        expect.objectContaining({
          title: 'Original Title', // Should be preserved
          content: 'Original content', // Should be preserved
          isRead: true, // Should be updated
        })
      );
    });

    it('should handle article content updates correctly', () => {
      const store = createMockStore();
      const article = createMockArticle({
        id: 'article-1',
        title: 'Test Article',
        content: '',
      });

      // Add article without content
      store.dispatch({
        type: 'articles/updateArticleLocal',
        payload: {
          id: article.id,
          updates: article,
        },
      });

      let state = store.getState();
      expect(state.articles.articles[0].content).toBe('');

      // Update with content
      store.dispatch({
        type: 'articles/updateArticleLocal',
        payload: {
          id: article.id,
          updates: { content: 'Fetched content' },
        },
      });

      state = store.getState();
      expect(state.articles.articles[0].content).toBe('Fetched content');
      expect(state.articles.articles[0].title).toBe('Test Article'); // Should be preserved
    });

    it('should handle multiple concurrent article updates', () => {
      const store = createMockStore();
      const articles = [
        createMockArticle({ id: 'article-1', title: 'Article 1' }),
        createMockArticle({ id: 'article-2', title: 'Article 2' }),
        createMockArticle({ id: 'article-3', title: 'Article 3' }),
      ];

      // Add all articles
      articles.forEach(article => {
        store.dispatch({
          type: 'articles/updateArticleLocal',
          payload: {
            id: article.id,
            updates: article,
          },
        });
      });

      let state = store.getState();
      expect(state.articles.articles).toHaveLength(3);

      // Update all articles simultaneously
      articles.forEach((article, index) => {
        store.dispatch({
          type: 'articles/updateArticleLocal',
          payload: {
            id: article.id,
            updates: { isRead: true, title: `Updated Article ${index + 1}` },
          },
        });
      });

      state = store.getState();
      expect(state.articles.articles).toHaveLength(3);
      state.articles.articles.forEach((article, index) => {
        expect(article.isRead).toBe(true);
        expect(article.title).toBe(`Updated Article ${index + 1}`);
      });
    });
  });

  describe('State Selectors and Computed Values', () => {
    it('should provide correct article selectors', () => {
      const store = createMockStore();
      const articles = [
        createMockArticle({ id: 'article-1', title: 'Article 1' }),
        createMockArticle({ id: 'article-2', title: 'Article 2' }),
      ];

      // Add articles
      articles.forEach(article => {
        store.dispatch({
          type: 'articles/updateArticleLocal',
          payload: {
            id: article.id,
            updates: article,
          },
        });
      });

      const state = store.getState();
      
      // Test selectors
      expect(state.articles.articles).toHaveLength(2);
      expect(state.articles.articles.find(a => a.id === 'article-1')).toBeTruthy();
      expect(state.articles.articles.find(a => a.id === 'article-2')).toBeTruthy();
    });

    it('should handle content loading selectors correctly', () => {
      const store = createMockStore();
      const articleId = 'test-article-1';

      // Set loading state
      store.dispatch({
        type: 'articles/setContentLoading',
        payload: { articleId, loading: true },
      });

      const state = store.getState();
      expect(state.articles.contentLoading[articleId]).toBe(true);
      expect(state.articles.contentErrors[articleId]).toBeUndefined();

      // Set error state
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId, error: 'Test error' },
      });

      const finalState = store.getState();
      expect(finalState.articles.contentLoading[articleId]).toBe(false);
      expect(finalState.articles.contentErrors[articleId]).toBe('Test error');
    });
  });

  describe('State Cleanup and Memory Management', () => {
    it('should clean up article state correctly', () => {
      const store = createMockStore();
      const articles = [
        createMockArticle({ id: 'article-1', title: 'Article 1' }),
        createMockArticle({ id: 'article-2', title: 'Article 2' }),
      ];

      // Add articles
      articles.forEach(article => {
        store.dispatch({
          type: 'articles/updateArticleLocal',
          payload: {
            id: article.id,
            updates: article,
          },
        });
      });

      // Set loading states
      store.dispatch({
        type: 'articles/setContentLoading',
        payload: { articleId: 'article-1', loading: true },
      });
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId: 'article-2', error: 'Test error' },
      });

      let state = store.getState();
      expect(state.articles.articles).toHaveLength(2);
      expect(state.articles.contentLoading['article-1']).toBe(true);
      expect(state.articles.contentErrors['article-2']).toBe('Test error');

      // Clear all state
      store.dispatch({
        type: 'articles/clearAll',
      });

      state = store.getState();
      expect(state.articles.articles).toHaveLength(0);
      expect(state.articles.contentLoading).toEqual({});
      expect(state.articles.contentErrors).toEqual({});
    });

    it('should handle state cleanup on logout', () => {
      const store = createMockStore();
      const article = createMockArticle();

      // Add article and set states
      store.dispatch({
        type: 'articles/updateArticleLocal',
        payload: {
          id: article.id,
          updates: article,
        },
      });

      store.dispatch({
        type: 'articles/setContentLoading',
        payload: { articleId: article.id, loading: true },
      });

      let state = store.getState();
      expect(state.articles.articles).toHaveLength(1);
      expect(state.articles.contentLoading[article.id]).toBe(true);

      // Simulate logout cleanup
      store.dispatch({
        type: 'auth/logout',
      });
      store.dispatch({
        type: 'articles/clearAll',
      });

      state = store.getState();
      expect(state.articles.articles).toHaveLength(0);
      expect(state.articles.contentLoading).toEqual({});
      expect(state.auth.isAuthenticated).toBe(false);
    });
  });

  describe('Error State Management', () => {
    it('should handle error states across different components', () => {
      const store = createMockStore();

      // Set auth error
      store.dispatch({
        type: 'auth/setError',
        payload: 'Authentication failed',
      });

      // Set articles error
      store.dispatch({
        type: 'articles/clearError',
        payload: 'fetch',
      });
      
      const state = store.getState();
      expect(state.auth.error).toBe('Authentication failed');
      expect(state.articles.error.fetch).toBeNull();
    });

    it('should handle error recovery correctly', () => {
      const store = createMockStore();

      // Set multiple errors
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId: 'article-1', error: 'Network error' },
      });
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId: 'article-2', error: 'Timeout error' },
      });

      let state = store.getState();
      expect(state.articles.contentErrors['article-1']).toBe('Network error');
      expect(state.articles.contentErrors['article-2']).toBe('Timeout error');

      // Clear one error
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId: 'article-1', error: null },
      });

      state = store.getState();
      expect(state.articles.contentErrors['article-1']).toBeUndefined();
      expect(state.articles.contentErrors['article-2']).toBe('Timeout error');

      // Clear all errors
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId: 'article-2', error: null },
      });

      state = store.getState();
      expect(state.articles.contentErrors['article-2']).toBeUndefined();
    });
  });

  describe('Async Action Integration', () => {
    it('should handle async actions with proper state transitions', async () => {
      const store = createMockStore();

      // Mock successful API response
      const mockApiResponse = {
        items: [createMockArticle({ id: 'api-article-1', title: 'API Article' })],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      };

      const { readeckApiService } = require('../../src/services/ReadeckApiService');
      readeckApiService.fetchArticlesWithFilters.mockResolvedValue(mockApiResponse);

      // Dispatch async action
      await store.dispatch(fetchArticles({}));

      const state = store.getState();
      expect(state.articles.loading.fetch).toBe(false);
      expect(state.articles.error.fetch).toBeNull();
      expect(state.articles.articles).toHaveLength(1);
      expect(state.articles.articles[0].title).toBe('API Article');
    });

    it('should handle async action errors correctly', async () => {
      const store = createMockStore();

      // Mock API error
      const { readeckApiService } = require('../../src/services/ReadeckApiService');
      readeckApiService.fetchArticlesWithFilters.mockRejectedValue(new Error('Network error'));

      // Dispatch async action
      await store.dispatch(fetchArticles({}));

      const state = store.getState();
      expect(state.articles.loading.fetch).toBe(false);
      expect(state.articles.error.fetch).toBe('Network error');
      expect(state.articles.articles).toHaveLength(0);
    });

    it('should handle concurrent async actions correctly', async () => {
      const store = createMockStore();

      // Mock API responses
      const { readeckApiService } = require('../../src/services/ReadeckApiService');
      readeckApiService.fetchArticlesWithFilters.mockResolvedValue({
        items: [createMockArticle({ id: 'concurrent-1', title: 'Concurrent Article 1' })],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      });

      const { localStorageService } = require('../../src/services/LocalStorageService');
      localStorageService.updateArticleFromAppFormat.mockResolvedValue(true);

      // Dispatch multiple async actions
      const promises = [
        store.dispatch(fetchArticles({})),
        store.dispatch(updateArticleLocalWithDB({
          id: 'local-article-1',
          updates: { title: 'Updated Local Article' },
        })),
      ];

      await Promise.all(promises);

      const state = store.getState();
      expect(state.articles.loading.fetch).toBe(false);
      expect(state.articles.loading.update).toBe(false);
      expect(state.articles.articles).toHaveLength(1);
    });
  });

  describe('State Persistence and Recovery', () => {
    it('should maintain state consistency during rapid updates', () => {
      const store = createMockStore();
      const article = createMockArticle({ id: 'rapid-update-test' });

      // Perform rapid state updates
      for (let i = 0; i < 10; i++) {
        store.dispatch({
          type: 'articles/updateArticleLocal',
          payload: {
            id: article.id,
            updates: { ...article, title: `Updated Title ${i}` },
          },
        });
      }

      const state = store.getState();
      expect(state.articles.articles).toHaveLength(1);
      expect(state.articles.articles[0].title).toBe('Updated Title 9');
    });

    it('should handle state recovery after errors', () => {
      const store = createMockStore();
      const article = createMockArticle();

      // Add article successfully
      store.dispatch({
        type: 'articles/updateArticleLocal',
        payload: {
          id: article.id,
          updates: article,
        },
      });

      // Simulate error state
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId: article.id, error: 'Temporary error' },
      });

      let state = store.getState();
      expect(state.articles.articles).toHaveLength(1);
      expect(state.articles.contentErrors[article.id]).toBe('Temporary error');

      // Recover from error
      store.dispatch({
        type: 'articles/setContentError',
        payload: { articleId: article.id, error: null },
      });

      state = store.getState();
      expect(state.articles.articles).toHaveLength(1);
      expect(state.articles.contentErrors[article.id]).toBeUndefined();
    });
  });
});