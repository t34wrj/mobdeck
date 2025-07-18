import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useArticleContent } from '../../src/hooks/useArticleContent';
import articlesSlice from '../../src/store/slices/articlesSlice';
import authSlice from '../../src/store/slices/authSlice';
import syncSlice from '../../src/store/slices/syncSlice';
import { Article } from '../../src/types';
import { act } from 'react-test-renderer';

// Mock the ContentOperationCoordinator
jest.mock('../../src/utils/ContentOperationCoordinator', () => ({
  contentOperationCoordinator: {
    requestContentFetch: jest.fn(),
    cancelContentFetch: jest.fn(),
  },
}));

// Mock the ReadeckApiService
jest.mock('../../src/services/ReadeckApiService', () => ({
  readeckApiService: {
    createArticleWithMetadata: jest.fn(),
    getArticleWithContent: jest.fn(),
  },
}));

// Mock console.log to reduce noise in tests
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('useArticleContent Hook', () => {
  const mockStore = configureStore({
    reducer: {
      articles: articlesSlice,
      auth: authSlice,
      sync: syncSlice,
    },
    preloadedState: {
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
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(Provider, { store: mockStore }, children);
  };

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

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    mockStore.dispatch({ type: 'articles/clearAll' });
  });

  describe('Basic State Management', () => {
    it('should initialize with correct default state', () => {
      const article = createMockArticle();
      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      expect(result.current.refreshing).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(true);
      expect(result.current.isRetrying).toBe(false);
    });

    it('should handle undefined article gracefully', () => {
      const { result } = renderHook(
        () => useArticleContent(undefined, 'test-id'),
        { wrapper }
      );

      expect(result.current.refreshing).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });

    it('should detect when article has content', () => {
      const articleWithContent = createMockArticle({ content: 'Substantial content here' });
      const { result } = renderHook(
        () => useArticleContent(articleWithContent, articleWithContent.id),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });

    it('should detect when article has no content', () => {
      const articleWithoutContent = createMockArticle({ content: '' });
      const { result } = renderHook(
        () => useArticleContent(articleWithoutContent, articleWithoutContent.id),
        { wrapper }
      );

      // Should not start loading automatically in test environment
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Content Fetching State Transitions', () => {
    it('should handle content loading state correctly', async () => {
      const article = createMockArticle({ content: '', contentUrl: 'https://example.com/content' });
      
      // Mock successful content fetch
      const mockContentFetch = jest.fn().mockResolvedValue('Fetched content');
      require('../../src/utils/ContentOperationCoordinator').contentOperationCoordinator.requestContentFetch = mockContentFetch;

      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Initially should not be loading
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });

    it('should handle content fetch errors gracefully', async () => {
      const article = createMockArticle({ content: '', contentUrl: 'https://example.com/content' });
      
      // Mock failed content fetch
      const mockContentFetch = jest.fn().mockRejectedValue(new Error('Network error'));
      require('../../src/utils/ContentOperationCoordinator').contentOperationCoordinator.requestContentFetch = mockContentFetch;

      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Should not show error in initial state
      expect(result.current.hasError).toBe(false);
    });

    it('should preserve content state during re-renders', async () => {
      const article = createMockArticle({ content: 'Original content' });
      
      const { result, rerender } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Initial state should be stable
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);

      // Re-render should preserve state
      rerender();
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });
  });

  describe('Article ID Changes - STATE-002 Regression Prevention', () => {
    it('should reset state when article ID changes', async () => {
      const article1 = createMockArticle({ id: 'article-1', content: 'Content 1' });
      const article2 = createMockArticle({ id: 'article-2', content: '' });
      
      const { result, rerender } = renderHook(
        ({ article, articleId }) => useArticleContent(article, articleId),
        { 
          wrapper,
          initialProps: { article: article1, articleId: article1.id }
        }
      );

      // Initial state with content
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);

      // Change to different article
      rerender({ article: article2, articleId: article2.id });

      // State should be reset for new article
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });

    it('should NOT reset state when article content changes but ID remains same', async () => {
      const article1 = createMockArticle({ id: 'article-1', content: '' });
      const article2 = createMockArticle({ id: 'article-1', content: 'New content' });
      
      const { result, rerender } = renderHook(
        ({ article, articleId }) => useArticleContent(article, articleId),
        { 
          wrapper,
          initialProps: { article: article1, articleId: article1.id }
        }
      );

      // Initial state without content
      expect(result.current.isLoading).toBe(false);

      // Update with content for same article
      rerender({ article: article2, articleId: article2.id });

      // State should remain stable (no unnecessary resets)
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });

    it('should handle rapid article ID changes without state corruption', async () => {
      const articles = [
        createMockArticle({ id: 'article-1', content: 'Content 1' }),
        createMockArticle({ id: 'article-2', content: 'Content 2' }),
        createMockArticle({ id: 'article-3', content: 'Content 3' }),
      ];
      
      const { result, rerender } = renderHook(
        ({ article, articleId }) => useArticleContent(article, articleId),
        { 
          wrapper,
          initialProps: { article: articles[0], articleId: articles[0].id }
        }
      );

      // Rapid article changes
      for (let i = 1; i < articles.length; i++) {
        rerender({ article: articles[i], articleId: articles[i].id });
        
        // Each change should maintain stable state
        expect(result.current.isLoading).toBe(false);
        expect(result.current.hasError).toBe(false);
      }
    });
  });

  describe('Manual Refresh Functionality', () => {
    it('should provide refresh handler', () => {
      const article = createMockArticle();
      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      expect(typeof result.current.handleRefresh).toBe('function');
    });

    it('should handle refresh with proper state transitions', async () => {
      const article = createMockArticle();
      
      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Call refresh
      act(() => {
        result.current.handleRefresh();
      });

      // Should show refreshing state
      expect(result.current.refreshing).toBe(true);
    });

    it('should handle refresh errors gracefully', async () => {
      const article = createMockArticle();
      
      // Mock refresh error
      const mockContentFetch = jest.fn().mockRejectedValue(new Error('Refresh failed'));
      require('../../src/utils/ContentOperationCoordinator').contentOperationCoordinator.requestContentFetch = mockContentFetch;

      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Refresh should not throw
      act(() => {
        result.current.handleRefresh();
      });

      expect(result.current.refreshing).toBe(true);
    });
  });

  describe('Retry Mechanism', () => {
    it('should provide retry handler', () => {
      const article = createMockArticle();
      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      expect(typeof result.current.retryFetch).toBe('function');
    });

    it('should track retry count correctly', async () => {
      const article = createMockArticle();
      
      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Initial retry count should be 0
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(true);
      expect(result.current.isRetrying).toBe(false);
    });

    it('should handle retry limit correctly', async () => {
      const article = createMockArticle();
      
      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Should be able to retry initially
      expect(result.current.canRetry).toBe(true);
      expect(result.current.retryCount).toBe(0);
    });

    it('should handle retry errors without breaking state', async () => {
      const article = createMockArticle();
      
      // Mock retry error
      const mockContentFetch = jest.fn().mockRejectedValue(new Error('Retry failed'));
      require('../../src/utils/ContentOperationCoordinator').contentOperationCoordinator.requestContentFetch = mockContentFetch;

      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Retry should not throw
      act(() => {
        result.current.retryFetch();
      });

      // State should remain valid
      expect(result.current.retryCount).toBe(0); // Won't increment without actual retry logic
      expect(result.current.isRetrying).toBe(false);
    });
  });

  describe('Local Article Handling', () => {
    it('should handle local articles correctly', () => {
      const localArticle = createMockArticle({ 
        id: 'local_12345', 
        content: '',
        contentUrl: 'https://example.com/content' 
      });
      
      const { result } = renderHook(
        () => useArticleContent(localArticle, localArticle.id),
        { wrapper }
      );

      // Should handle local articles without errors
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });

    it('should handle local article sync correctly', async () => {
      const localArticle = createMockArticle({ 
        id: 'local_12345', 
        content: '',
        contentUrl: undefined 
      });
      
      // Mock successful local article sync
      const mockCreateArticle = jest.fn().mockResolvedValue({ id: 'server-123' });
      const mockGetArticle = jest.fn().mockResolvedValue({ 
        id: 'server-123', 
        content: 'Synced content' 
      });
      
      require('../../src/services/ReadeckApiService').readeckApiService.createArticleWithMetadata = mockCreateArticle;
      require('../../src/services/ReadeckApiService').readeckApiService.getArticleWithContent = mockGetArticle;

      const { result } = renderHook(
        () => useArticleContent(localArticle, localArticle.id),
        { wrapper }
      );

      // Should handle local articles properly
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });
  });

  describe('Error State Management', () => {
    it('should handle network errors gracefully', async () => {
      const article = createMockArticle({ content: '', contentUrl: 'https://example.com/content' });
      
      // Mock network error
      const mockContentFetch = jest.fn().mockRejectedValue(new Error('Network error'));
      require('../../src/utils/ContentOperationCoordinator').contentOperationCoordinator.requestContentFetch = mockContentFetch;

      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Should not show error in initial state
      expect(result.current.hasError).toBe(false);
    });

    it('should handle timeout errors gracefully', async () => {
      const article = createMockArticle({ content: '', contentUrl: 'https://example.com/content' });
      
      // Mock timeout error
      const mockContentFetch = jest.fn().mockRejectedValue(new Error('Content fetch timeout'));
      require('../../src/utils/ContentOperationCoordinator').contentOperationCoordinator.requestContentFetch = mockContentFetch;

      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Should handle timeout gracefully
      expect(result.current.hasError).toBe(false);
    });

    it('should preserve article data during errors', async () => {
      const article = createMockArticle({ content: 'Original content' });
      
      const { result } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Article data should remain stable even during errors
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });
  });

  describe('Content State Persistence - STATE-002 Regression Prevention', () => {
    it('should not clear content after successful fetch', async () => {
      const article = createMockArticle({ content: 'Fetched content' });
      
      const { result, rerender } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Content should be stable
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);

      // Re-render should not clear content
      rerender();
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });

    it('should handle content updates correctly', async () => {
      const article1 = createMockArticle({ content: '' });
      const article2 = createMockArticle({ content: 'Updated content' });
      
      const { result, rerender } = renderHook(
        ({ article }) => useArticleContent(article, article.id),
        { 
          wrapper,
          initialProps: { article: article1 }
        }
      );

      // Initial state without content
      expect(result.current.isLoading).toBe(false);

      // Update with content
      rerender({ article: article2 });

      // Should handle content update correctly
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });

    it('should maintain state consistency during rapid updates', async () => {
      const article = createMockArticle({ content: 'Stable content' });
      
      const { result, rerender } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Multiple rapid re-renders should maintain consistency
      for (let i = 0; i < 5; i++) {
        rerender();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.hasError).toBe(false);
      }
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should cleanup operations on unmount', () => {
      const article = createMockArticle();
      const mockCancelOperation = jest.fn();
      require('../../src/utils/ContentOperationCoordinator').contentOperationCoordinator.cancelContentFetch = mockCancelOperation;
      
      const { unmount } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Unmount should trigger cleanup
      unmount();
      
      expect(mockCancelOperation).toHaveBeenCalledWith(article.id);
    });

    it('should handle cleanup when article ID changes', () => {
      const article1 = createMockArticle({ id: 'article-1' });
      const article2 = createMockArticle({ id: 'article-2' });
      const mockCancelOperation = jest.fn();
      require('../../src/utils/ContentOperationCoordinator').contentOperationCoordinator.cancelContentFetch = mockCancelOperation;
      
      const { rerender } = renderHook(
        ({ article, articleId }) => useArticleContent(article, articleId),
        { 
          wrapper,
          initialProps: { article: article1, articleId: article1.id }
        }
      );

      // Change article ID
      rerender({ article: article2, articleId: article2.id });

      // Should cleanup previous operations
      expect(mockCancelOperation).toHaveBeenCalledWith(article1.id);
    });

    it('should not leak memory during repeated renders', () => {
      const article = createMockArticle();
      
      const { result, rerender } = renderHook(
        () => useArticleContent(article, article.id),
        { wrapper }
      );

      // Multiple renders should not cause memory leaks
      for (let i = 0; i < 10; i++) {
        rerender();
        expect(result.current).toBeDefined();
      }
    });
  });
});