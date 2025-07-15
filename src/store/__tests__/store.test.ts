import { store, RootState, AppDispatch } from '../index';
import { setUser, clearAuth } from '../slices/authSlice';
import { fetchArticles } from '../slices/articlesSlice';

describe('Redux Store Configuration', () => {
  it('should create store without errors', () => {
    expect(store).toBeDefined();
    expect(store.getState).toBeDefined();
    expect(store.dispatch).toBeDefined();
  });

  it('should have correct initial state structure', () => {
    const state: RootState = store.getState();

    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('articles');

    expect(state.auth).toEqual({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      lastTokenRefresh: undefined,
    });

    // Test basic articles state structure (simplified array-based)
    expect(state.articles).toHaveProperty('articles');
    expect(state.articles).toHaveProperty('loading');
    expect(state.articles).toHaveProperty('error');
    expect(state.articles).toHaveProperty('pagination');
    expect(state.articles.articles).toEqual([]);
  });

  it('should handle auth actions correctly', () => {
    const dispatch: AppDispatch = store.dispatch;

    // Test setUser action
    const testUser = {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      serverUrl: 'https://test.com',
      lastLoginAt: new Date().toISOString(),
      tokenExpiresAt: new Date().toISOString(),
    };

    dispatch(setUser(testUser));

    let state = store.getState();
    expect(state.auth.isAuthenticated).toBe(true);
    expect(state.auth.user).toEqual(testUser);

    // Test clearAuth action
    dispatch(clearAuth());

    state = store.getState();
    expect(state.auth.isAuthenticated).toBe(false);
    expect(state.auth.user).toBe(null);
    expect(state.auth.token).toBe(null);
  });

  it('should handle articles actions correctly', () => {
    const dispatch: AppDispatch = store.dispatch;

    // Test fetchArticles fulfilled action (simulating successful fetch)
    const testArticles = [
      {
        id: '1',
        title: 'Test Article',
        summary: 'Test Summary',
        content: 'Test content',
        url: 'https://example.com/article',
        imageUrl: 'https://example.com/image.jpg',
        readTime: 5,
        isArchived: false,
        isFavorite: false,
        isRead: false,
        tags: [],
        sourceUrl: 'https://example.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncedAt: new Date().toISOString(),
      },
    ];

    dispatch(
      fetchArticles.fulfilled(
        { items: testArticles, page: 1, totalPages: 1, totalItems: 1 },
        'test',
        {}
      )
    );

    const state = store.getState();
    expect(state.articles.articles).toHaveLength(1);
    expect(state.articles.articles[0]).toEqual(testArticles[0]);
    expect(state.articles.pagination.totalItems).toBe(1);
  });

  it('should export proper TypeScript types', () => {
    // This test ensures our types are properly exported and usable
    const state: RootState = store.getState();
    const dispatch: AppDispatch = store.dispatch;

    expect(typeof state).toBe('object');
    expect(typeof dispatch).toBe('function');
  });
});
