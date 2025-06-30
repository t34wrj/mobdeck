/**
 * Basic integration test for Redux store configuration
 * This test validates that the store is properly configured and exports work correctly
 */

import { store, RootState, AppDispatch, useAppDispatch, useAppSelector } from '../index';

describe('Redux Store Integration', () => {
  it('should export store instance', () => {
    expect(store).toBeDefined();
    expect(typeof store.getState).toBe('function');
    expect(typeof store.dispatch).toBe('function');
    expect(typeof store.subscribe).toBe('function');
  });

  it('should export correct TypeScript types', () => {
    // Test that RootState type is inferred correctly
    const state: RootState = store.getState();
    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('articles');
    
    // Test that AppDispatch type works
    const dispatch: AppDispatch = store.dispatch;
    expect(typeof dispatch).toBe('function');
  });

  it('should export typed hooks', () => {
    expect(useAppDispatch).toBeDefined();
    expect(useAppSelector).toBeDefined();
    expect(typeof useAppDispatch).toBe('function');
    expect(typeof useAppSelector).toBe('function');
  });

  it('should have correct initial state structure', () => {
    const state = store.getState();
    
    // Verify auth state structure
    expect(state.auth).toEqual({
      isAuthenticated: false,
      user: null,
    });
    
    // Verify articles state structure
    expect(state.articles).toEqual({
      articles: [],
      loading: false,
      error: null,
    });
  });
});