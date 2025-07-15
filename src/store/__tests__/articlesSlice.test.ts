import { configureStore } from '@reduxjs/toolkit';
import articlesReducer, {
  fetchArticles,
  createArticle,
  setFilters,
  clearFilters,
  setPage,
  updateArticleLocal,
  ArticlesState,
} from '../slices/articlesSlice';
import { Article } from '../../types';

// Mock article for testing
const mockArticle: Article = {
  id: '1',
  title: 'Test Article',
  summary: 'Test summary',
  content: 'Test content',
  url: 'https://example.com',
  imageUrl: undefined,
  readTime: 5,
  isArchived: false,
  isFavorite: false,
  isRead: false,
  tags: ['test'],
  sourceUrl: 'https://example.com',
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  syncedAt: '2023-01-01T00:00:00.000Z',
};

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      articles: articlesReducer,
    },
  });
};

describe('Articles Slice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().articles;

      expect(state.articles).toEqual([]);
      expect(state.loading).toEqual({
        fetch: false,
        create: false,
        update: false,
        delete: false,
        sync: false,
      });
      expect(state.error).toEqual({
        fetch: null,
        create: null,
        update: null,
        delete: null,
        sync: null,
      });
      expect(state.pagination).toEqual({
        page: 1,
        limit: 20,
        totalPages: 0,
        totalItems: 0,
        hasMore: false,
      });
      expect(state.filters).toEqual({
        searchQuery: '',
        isArchived: undefined,
        isFavorite: undefined,
        isRead: undefined,
        tags: undefined,
      });
    });
  });

  describe('Reducers', () => {
    it('should handle setFilters', () => {
      const filters = { searchQuery: 'test', isFavorite: true };
      store.dispatch(setFilters(filters));

      const state = store.getState().articles;
      expect(state.filters.searchQuery).toBe('test');
      expect(state.filters.isFavorite).toBe(true);
      expect(state.pagination.page).toBe(1); // Should reset page
    });

    it('should handle clearFilters', () => {
      // First set some filters
      store.dispatch(setFilters({ searchQuery: 'test', isFavorite: true }));
      store.dispatch(setPage(3));

      // Then clear them
      store.dispatch(clearFilters());

      const state = store.getState().articles;
      expect(state.filters.searchQuery).toBe('');
      expect(state.filters.isFavorite).toBeUndefined();
      expect(state.pagination.page).toBe(1);
    });

    it('should handle setPage', () => {
      store.dispatch(setPage(5));

      const state = store.getState().articles;
      expect(state.pagination.page).toBe(5);
    });

    it('should handle updateArticleLocal', () => {
      // First add an article to the store (simulate)
      const initialState: ArticlesState = {
        articles: [mockArticle],
        loading: {
          fetch: false,
          create: false,
          update: false,
          delete: false,
          sync: false,
        },
        error: {
          fetch: null,
          create: null,
          update: null,
          delete: null,
          sync: null,
        },
        pagination: {
          page: 1,
          limit: 20,
          totalPages: 0,
          totalItems: 1,
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
      };

      // Create store with initial state that has an article
      const stateWithArticle = {
        ...initialState,
        articles: [mockArticle],
      };
      
      const storeWithData = configureStore({
        reducer: { articles: articlesReducer },
        preloadedState: { articles: stateWithArticle },
      });

      // Update the article
      storeWithData.dispatch(
        updateArticleLocal({
          id: '1',
          updates: { title: 'Updated Title', isFavorite: true },
        })
      );

      const state = storeWithData.getState().articles;
      const updatedArticle = state.articles.find(a => a.id === '1');
      expect(updatedArticle?.title).toBe('Updated Title');
      expect(updatedArticle?.isFavorite).toBe(true);
      expect(state.sync.pendingChanges).toContain('1');
    });
  });

  describe('Async Thunks', () => {
    it('should handle fetchArticles.pending', () => {
      store.dispatch(fetchArticles.pending('test-request-id', {}));

      const state = store.getState().articles;
      expect(state.loading.fetch).toBe(true);
      expect(state.error.fetch).toBe(null);
    });

    it('should handle fetchArticles.fulfilled', () => {
      const payload = {
        items: [mockArticle],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      };

      store.dispatch(fetchArticles.fulfilled(payload, 'test-request-id', {}));

      const state = store.getState().articles;
      expect(state.loading.fetch).toBe(false);
      expect(state.error.fetch).toBe(null);
      expect(state.articles).toContain(mockArticle);
      expect(state.pagination.totalItems).toBe(1);
    });

    it('should handle fetchArticles.rejected', () => {
      const error = 'Network error';
      store.dispatch(
        fetchArticles.rejected(new Error(error), 'test-request-id', {}, error)
      );

      const state = store.getState().articles;
      expect(state.loading.fetch).toBe(false);
      expect(state.error.fetch).toBe(error);
    });

    it('should handle createArticle.fulfilled', () => {
      store.dispatch(
        createArticle.fulfilled(mockArticle, 'test-request-id', {
          title: mockArticle.title,
          url: mockArticle.url,
        })
      );

      const state = store.getState().articles;
      expect(state.loading.create).toBe(false);
      expect(state.error.create).toBe(null);
      expect(state.articles).toContain(mockArticle);
      expect(state.pagination.totalItems).toBe(1);
    });
  });
});

// Integration test with selectors
import { selectAllArticles } from '../selectors/articlesSelectors';

describe('Articles Integration', () => {
  it('should work with selectors', () => {
    const store = createTestStore();

    // Add an article
    store.dispatch(
      createArticle.fulfilled(mockArticle, 'test-request-id', {
        title: mockArticle.title,
        url: mockArticle.url,
      })
    );

    const state = store.getState();
    const articles = selectAllArticles(state);

    expect(articles).toHaveLength(1);
    expect(articles[0]).toEqual(mockArticle);
  });
});
