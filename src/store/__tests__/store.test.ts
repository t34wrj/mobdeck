import { store, RootState, AppDispatch } from '../index';
import { login, logout } from '../slices/authSlice';
import { addArticle } from '../slices/articlesSlice';

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
      isAuthenticated: false,
      user: null,
    });
    
    expect(state.articles).toEqual({
      articles: [],
      loading: false,
      error: null,
    });
  });

  it('should handle auth actions correctly', () => {
    const dispatch: AppDispatch = store.dispatch;
    
    // Test login action
    dispatch(login({ id: '1', name: 'Test User', email: 'test@example.com' }));
    
    let state = store.getState();
    expect(state.auth.isAuthenticated).toBe(true);
    expect(state.auth.user).toEqual({
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
    });
    
    // Test logout action
    dispatch(logout());
    
    state = store.getState();
    expect(state.auth.isAuthenticated).toBe(false);
    expect(state.auth.user).toBe(null);
  });

  it('should handle articles actions correctly', () => {
    const dispatch: AppDispatch = store.dispatch;
    
    const testArticle = {
      id: '1',
      title: 'Test Article',
      summary: 'Test Summary',
      imageUrl: 'https://example.com/image.jpg',
    };
    
    dispatch(addArticle(testArticle));
    
    const state = store.getState();
    expect(state.articles.articles).toHaveLength(1);
    expect(state.articles.articles[0]).toEqual(testArticle);
  });

  it('should export proper TypeScript types', () => {
    // This test ensures our types are properly exported and usable
    const state: RootState = store.getState();
    const dispatch: AppDispatch = store.dispatch;
    
    expect(typeof state).toBe('object');
    expect(typeof dispatch).toBe('function');
  });
});