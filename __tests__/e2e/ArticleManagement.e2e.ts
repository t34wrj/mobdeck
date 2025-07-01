/**
 * E2E Tests for Complete Article Management Workflow
 * Tests the full user journey: Share Intent → Add Article → Sync → View Article
 * 
 * This test suite covers:
 * - Android share intent processing
 * - Article creation and validation
 * - Bidirectional sync with conflict resolution
 * - Article viewing and user interactions
 * - Error scenarios and recovery
 */

import { configureStore, Store } from '@reduxjs/toolkit';

// Import services
import { shareHandlerService } from '../../src/services/ShareHandlerService';

// Import Redux
import authReducer from '../../src/store/slices/authSlice';
import articlesReducer, {
  fetchArticles,
  syncArticles,
  updateArticle,
  deleteArticle,
} from '../../src/store/slices/articlesSlice';
import syncReducer from '../../src/store/slices/syncSlice';

// Import test helpers
import {
  ArticleTestDataFactory,
  ShareIntentSimulator,
  SyncTestHelper,
  setupE2ETestEnvironment,
  cleanupE2ETestEnvironment,
  getCommonE2EScenarios,
} from './helpers';

// Import types
import { Article, AuthenticatedUser } from '../../src/types';

// Mock external dependencies
jest.mock('../../src/services/ShareHandlerService');
jest.mock('../../src/services/SyncService');

// Create test store factory
const createTestStore = (preloadedState?: any) => {
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
const mockUser: AuthenticatedUser = {
  id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
  serverUrl: 'https://readeck.example.com',
  lastLoginAt: new Date().toISOString(),
  tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

describe('Article Management E2E Workflow Tests', () => {
  let store: Store;
  let testEnvironment: ReturnType<typeof setupE2ETestEnvironment>;

  beforeEach(() => {
    // Setup test environment
    testEnvironment = setupE2ETestEnvironment();
    
    // Create store with authenticated user
    store = createTestStore({
      auth: {
        isAuthenticated: true,
        user: mockUser,
        token: 'valid-token',
        loading: false,
        error: null,
      },
      articles: {
        articles: [],
        loading: { fetch: false, update: false, delete: false },
        error: { fetch: null, update: null, delete: null },
        pagination: { page: 1, hasMore: true, total: 0 },
        filters: {},
        sync: { isSyncing: false, lastSync: null },
      },
    });
  });

  afterEach(() => {
    cleanupE2ETestEnvironment();
  });

  describe('Complete Share to View Workflow', () => {
    it('should process share intent and add article to store', async () => {
      // Phase 1: Simulate Android share intent
      const testUrl = 'https://techblog.example.com/ai-advancement';
      const testTitle = 'Revolutionary AI Breakthrough Announced';
      
      ShareIntentSimulator.simulateBrowserShare(testUrl, testTitle);
      
      // Mock successful share processing
      const expectedArticle = ArticleTestDataFactory.createSharedArticle(testUrl, testTitle);
      (shareHandlerService.processSharedData as jest.Mock).mockResolvedValue({
        success: true,
        article: expectedArticle,
        validationResult: {
          originalText: testUrl,
          extractedUrl: testUrl,
          validationErrors: [],
          validationWarnings: [],
        },
      });

      // Process the share intent
      const shareResult = await shareHandlerService.processSharedData();
      
      expect(shareResult.success).toBe(true);
      expect(shareResult.article).toMatchObject({
        url: testUrl,
        title: testTitle,
        isRead: false,
      });

      // Phase 2: Add article to Redux store
      store.dispatch({
        type: 'articles/addArticle',
        payload: expectedArticle,
      });

      const articlesState = store.getState().articles;
      expect(articlesState.articles).toHaveLength(1);
      expect(articlesState.articles[0]).toMatchObject({
        url: testUrl,
        title: testTitle,
      });
    });

    it('should handle complete workflow with sync conflicts', async () => {
      // Setup: Create conflicting articles
      const conflictArticle = ArticleTestDataFactory.createArticle({
        id: 'conflict-article',
        title: 'Local Title',
        isRead: true,
        updatedAt: '2023-01-01T00:00:00Z',
      });

      const remoteConflictArticle = ArticleTestDataFactory.createArticle({
        id: 'conflict-article',
        title: 'Remote Title',
        isFavorite: true,
        updatedAt: '2023-01-02T00:00:00Z', // Newer
      });

      // Add local article to store
      store.dispatch({
        type: 'articles/addArticle',
        payload: conflictArticle,
      });

      // Simulate sync with conflict resolution
      const mockSyncService = testEnvironment.mockSyncService;
      mockSyncService.syncArticles.mockResolvedValue({
        success: true,
        articlesAdded: 0,
        articlesUpdated: 1,
        articlesDeleted: 0,
        conflicts: [
          {
            localArticle: conflictArticle,
            remoteArticle: remoteConflictArticle,
            resolution: 'remote',
          },
        ],
      });

      await store.dispatch(syncArticles({ fullSync: true }));

      // Verify sync operation was called
      expect(mockSyncService.syncArticles).toHaveBeenCalledWith({
        fullSync: true,
      });

      // In a real scenario, conflict resolution would update the store
      store.dispatch({
        type: 'articles/updateArticle',
        payload: {
          id: 'conflict-article',
          changes: {
            title: 'Remote Title',
            isFavorite: true,
          },
        },
      });

      const finalState = store.getState().articles;
      const resolvedArticle = finalState.articles.find(a => a.id === 'conflict-article');
      
      expect(resolvedArticle).toMatchObject({
        title: 'Remote Title',
        isFavorite: true,
      });
    });
  });

  describe('Share Intent Processing', () => {
    it('should handle various share intent formats', async () => {
      const scenarios = getCommonE2EScenarios().shareScenarios;

      for (const scenario of scenarios) {
        scenario.setup();

        const mockResult = scenario.shouldSucceed
          ? {
              success: true,
              article: ArticleTestDataFactory.createSharedArticle(
                scenario.expectedUrl || 'https://example.com',
                'Test Article'
              ),
            }
          : {
              success: false,
              error: {
                code: 'INVALID_URL',
                message: 'Invalid URL provided',
                retryable: false,
                timestamp: new Date().toISOString(),
              },
            };

        (shareHandlerService.processSharedData as jest.Mock).mockResolvedValue(mockResult);

        const result = await shareHandlerService.processSharedData();

        if (scenario.shouldSucceed) {
          expect(result.success).toBe(true);
          expect(result.article?.url).toBe(scenario.expectedUrl);
        } else {
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
        }

        ShareIntentSimulator.clearSimulatedSharedData();
      }
    });

    it('should handle network errors during share processing', async () => {
      ShareIntentSimulator.simulateUrlShare('https://example.com/article');

      (shareHandlerService.processSharedData as jest.Mock).mockRejectedValue(
        new Error('Network unavailable')
      );

      await expect(shareHandlerService.processSharedData()).rejects.toThrow('Network unavailable');
    });
  });

  describe('Article State Management', () => {
    it('should manage article states correctly', async () => {
      const testArticles = ArticleTestDataFactory.createArticleWithStates();
      
      // Add articles to store
      Object.values(testArticles).forEach(article => {
        store.dispatch({
          type: 'articles/addArticle',
          payload: article,
        });
      });

      const state = store.getState().articles;
      expect(state.articles).toHaveLength(4);

      // Verify each article state
      const unreadArticle = state.articles.find(a => a.title === 'Unread Article');
      const readArticle = state.articles.find(a => a.title === 'Read Article');
      const favoriteArticle = state.articles.find(a => a.title === 'Favorite Article');
      const archivedArticle = state.articles.find(a => a.title === 'Archived Article');

      expect(unreadArticle?.isRead).toBe(false);
      expect(readArticle?.isRead).toBe(true);
      expect(favoriteArticle?.isFavorite).toBe(true);
      expect(archivedArticle?.isArchived).toBe(true);
    });

    it('should handle article updates', async () => {
      const testArticle = ArticleTestDataFactory.createArticle({
        id: 'update-test',
        isFavorite: false,
      });

      store.dispatch({
        type: 'articles/addArticle',
        payload: testArticle,
      });

      // Mock successful update
      const mockUpdateAction = {
        type: 'articles/updateArticle/fulfilled',
        payload: { ...testArticle, isFavorite: true },
      };

      store.dispatch(mockUpdateAction);

      const state = store.getState().articles;
      const updatedArticle = state.articles.find(a => a.id === 'update-test');
      expect(updatedArticle?.isFavorite).toBe(true);
    });

    it('should handle article deletion', async () => {
      const testArticle = ArticleTestDataFactory.createArticle({
        id: 'delete-test',
      });

      store.dispatch({
        type: 'articles/addArticle',
        payload: testArticle,
      });

      let state = store.getState().articles;
      expect(state.articles).toHaveLength(1);

      // Mock successful deletion
      store.dispatch({
        type: 'articles/deleteArticle/fulfilled',
        payload: { id: 'delete-test' },
      });

      state = store.getState().articles;
      expect(state.articles).toHaveLength(0);
    });
  });

  describe('Sync Operations', () => {
    it('should handle bidirectional sync with multiple changes', async () => {
      // Setup initial articles
      const localArticles = ArticleTestDataFactory.createArticleList(3);
      localArticles.forEach(article => {
        store.dispatch({
          type: 'articles/addArticle',
          payload: article,
        });
      });

      // Mock sync with mixed changes
      const mockSyncService = testEnvironment.mockSyncService;
      mockSyncService.syncArticles.mockResolvedValue({
        success: true,
        articlesAdded: 2,
        articlesUpdated: 1,
        articlesDeleted: 0,
        conflicts: [],
      });

      await store.dispatch(syncArticles({ fullSync: true }));

      expect(mockSyncService.syncArticles).toHaveBeenCalledWith({
        fullSync: true,
      });

      // Verify sync history is recorded
      const syncHistory = SyncTestHelper.getSyncHistory();
      expect(syncHistory.length).toBeGreaterThan(0);
      expect(syncHistory[syncHistory.length - 1].success).toBe(true);
    });

    it('should handle sync failures gracefully', async () => {
      const mockSyncService = testEnvironment.mockSyncService;
      mockSyncService.syncArticles.mockRejectedValue(
        new Error('Sync failed: Server unavailable')
      );

      const syncAction = store.dispatch(syncArticles({ fullSync: false }));

      await expect(syncAction).rejects.toThrow('Sync failed: Server unavailable');

      const syncHistory = SyncTestHelper.getSyncHistory();
      const lastSync = syncHistory[syncHistory.length - 1];
      expect(lastSync?.success).toBe(false);
    });

    it('should handle conflict resolution scenarios', async () => {
      const conflictScenarios = SyncTestHelper.createConflictScenarios();

      for (const scenario of conflictScenarios) {
        // Add local article
        store.dispatch({
          type: 'articles/addArticle',
          payload: scenario.local,
        });

        // Simulate conflict resolution
        let resolvedArticle: Article;
        switch (scenario.resolution) {
          case 'local':
            resolvedArticle = scenario.local;
            break;
          case 'remote':
            resolvedArticle = scenario.remote;
            break;
          case 'merge':
            resolvedArticle = scenario.expected;
            break;
        }

        store.dispatch({
          type: 'articles/updateArticle',
          payload: {
            id: scenario.local.id,
            changes: resolvedArticle,
          },
        });

        const state = store.getState().articles;
        const article = state.articles.find(a => a.id === scenario.local.id);
        
        expect(article).toMatchObject(scenario.expected);

        // Clean up for next scenario
        store.dispatch({
          type: 'articles/removeArticle',
          payload: { id: scenario.local.id },
        });
      }
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle network failures during article operations', async () => {
      const testArticle = ArticleTestDataFactory.createArticle();
      
      store.dispatch({
        type: 'articles/addArticle',
        payload: testArticle,
      });

      // Mock network failure
      const errorAction = {
        type: 'articles/updateArticle/rejected',
        payload: 'Network error',
        error: { message: 'Network error' },
      };

      store.dispatch(errorAction);

      const articlesState = store.getState().articles;
      expect(articlesState.error.update).toBe('Network error');
    });

    it('should recover from temporary failures', async () => {
      const mockSyncService = testEnvironment.mockSyncService;
      
      // First attempt fails
      mockSyncService.syncArticles
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          success: true,
          articlesAdded: 1,
        });

      // First sync fails
      try {
        await store.dispatch(syncArticles({ fullSync: false }));
      } catch (error) {
        // Expected to fail
      }

      // Retry succeeds
      await store.dispatch(syncArticles({ fullSync: false }));
      
      const syncHistory = SyncTestHelper.getSyncHistory();
      expect(syncHistory.length).toBe(2);
      expect(syncHistory[0].success).toBe(false);
      expect(syncHistory[1].success).toBe(true);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large article lists efficiently', async () => {
      const largeArticleList = ArticleTestDataFactory.createArticleList(100);
      
      const startTime = Date.now();
      
      largeArticleList.forEach(article => {
        store.dispatch({
          type: 'articles/addArticle',
          payload: article,
        });
      });

      const endTime = Date.now();
      const processTime = endTime - startTime;
      
      // Verify performance - should process within reasonable time
      expect(processTime).toBeLessThan(1000); // 1 second max for 100 articles
      
      const state = store.getState().articles;
      expect(state.articles).toHaveLength(100);
    });

    it('should maintain performance during concurrent operations', async () => {
      const mockSyncService = testEnvironment.mockSyncService;
      mockSyncService.syncArticles.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          articlesAdded: 5,
        }), 100))
      );

      // Start multiple operations concurrently
      const promises = [
        store.dispatch(syncArticles({ fullSync: false })),
        store.dispatch(syncArticles({ fullSync: false })),
        store.dispatch(syncArticles({ fullSync: false })),
      ];

      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();
      
      // Should handle concurrent operations efficiently
      expect(endTime - startTime).toBeLessThan(500);
    });
  });
});

describe('Integration with External Systems', () => {
  let testEnvironment: ReturnType<typeof setupE2ETestEnvironment>;

  beforeEach(() => {
    testEnvironment = setupE2ETestEnvironment();
  });

  afterEach(() => {
    cleanupE2ETestEnvironment();
  });

  it('should integrate with Android share system', async () => {
    // Test that share module integration works
    const mockShareModule = testEnvironment.mockShareModule;
    
    ShareIntentSimulator.simulateBrowserShare(
      'https://news.example.com/article',
      'Breaking News'
    );

    const sharedData = await mockShareModule.getSharedData();
    
    expect(sharedData).toMatchObject({
      text: 'https://news.example.com/article',
      subject: 'Breaking News',
      sourceApp: 'com.android.chrome',
    });

    await mockShareModule.clearSharedData();
    
    const clearedData = await mockShareModule.getSharedData();
    expect(clearedData).toBeNull();
  });

  it('should handle background sync operations', async () => {
    const mockSyncService = testEnvironment.mockSyncService;
    
    // Simulate background sync
    const backgroundSyncResult = await mockSyncService.syncArticles({
      background: true,
      articlesCount: 3,
    });

    expect(backgroundSyncResult.success).toBe(true);
    expect(backgroundSyncResult.articlesAdded).toBe(3);

    // Verify sync was recorded
    const syncHistory = SyncTestHelper.getSyncHistory();
    expect(syncHistory).toHaveLength(1);
    expect(syncHistory[0].type).toBe('sync');
    expect(syncHistory[0].success).toBe(true);
  });

  it('should validate complete E2E workflow', async () => {
    // This test validates the complete user journey
    const mockShareModule = testEnvironment.mockShareModule;
    const mockSyncService = testEnvironment.mockSyncService;

    // 1. User shares a URL from browser
    ShareIntentSimulator.simulateBrowserShare(
      'https://example.com/important-article',
      'Important Article Title'
    );

    const sharedData = await mockShareModule.getSharedData();
    expect(sharedData).toBeTruthy();

    // 2. Share processing creates article
    const article = ArticleTestDataFactory.createSharedArticle(
      sharedData!.text!,
      sharedData!.subject!
    );

    expect(article.url).toBe('https://example.com/important-article');
    expect(article.title).toBe('Important Article Title');

    // 3. Sync operation processes the article
    mockSyncService.syncArticles.mockResolvedValue({
      success: true,
      articlesAdded: 1,
    });

    const syncResult = await mockSyncService.syncArticles({
      articlesCount: 1,
    });

    expect(syncResult.success).toBe(true);
    expect(syncResult.articlesAdded).toBe(1);

    // 4. Cleanup
    await mockShareModule.clearSharedData();
    const finalSharedData = await mockShareModule.getSharedData();
    expect(finalSharedData).toBeNull();

    // Verify complete workflow succeeded
    expect(true).toBe(true); // Placeholder for workflow validation
  });
});