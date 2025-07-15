/**
 * Unit tests for LocalStorageService - Consolidated storage service
 * Tests database, cache, and auth storage functionality
 */

import { localStorageService } from '../../src/services/LocalStorageService';

// Mock the underlying services
jest.mock('../../src/services/DatabaseService', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    close: jest.fn().mockResolvedValue(undefined),
    createArticle: jest.fn().mockResolvedValue({ success: true, data: 'test-id' }),
    getArticle: jest.fn().mockResolvedValue({ 
      success: true, 
      data: {
        id: 'test-id',
        title: 'Test Article',
        url: 'https://example.com',
        content: 'Test content',
        created_at: Date.now() / 1000,
        updated_at: Date.now() / 1000,
      }
    }),
    updateArticle: jest.fn().mockResolvedValue({ success: true }),
    deleteArticle: jest.fn().mockResolvedValue({ success: true }),
    getArticles: jest.fn().mockResolvedValue({ 
      success: true, 
      data: {
        items: [],
        totalCount: 0,
        limit: 20,
        offset: 0,
        hasMore: false,
      }
    }),
    clearAllData: jest.fn().mockResolvedValue({ success: true }),
  },
  DatabaseUtilityFunctions: {
    convertDBArticleToArticle: jest.fn().mockImplementation(dbArticle => ({
      id: dbArticle.id,
      title: dbArticle.title,
      url: dbArticle.url,
      content: dbArticle.content,
      createdAt: new Date(dbArticle.created_at * 1000).toISOString(),
      updatedAt: new Date(dbArticle.updated_at * 1000).toISOString(),
    })),
    convertArticleToDBArticle: jest.fn().mockImplementation(article => ({
      id: article.id,
      title: article.title,
      url: article.url,
      content: article.content,
      created_at: Date.now() / 1000,
      updated_at: Date.now() / 1000,
    })),
  },
}));

jest.mock('../../src/services/CacheService', () => ({
  cacheService: {
    getArticle: jest.fn().mockReturnValue(null),
    setArticle: jest.fn(),
    deleteArticle: jest.fn().mockReturnValue(true),
    clearAll: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      hits: 0,
      misses: 0,
      hitRate: 0,
    }),
  },
}));

jest.mock('../../src/services/AuthStorageService', () => ({
  authStorageService: {
    storeToken: jest.fn().mockResolvedValue(true),
    retrieveToken: jest.fn().mockResolvedValue('test-token'),
    deleteToken: jest.fn().mockResolvedValue(true),
    isTokenStored: jest.fn().mockResolvedValue(true),
    validateStoredToken: jest.fn().mockResolvedValue({
      isValid: true,
      isExpired: false,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  },
}));

describe('LocalStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Operations', () => {
    it('should initialize database', async () => {
      await expect(localStorageService.initialize()).resolves.toBeUndefined();
    });

    it('should check if connected', () => {
      expect(localStorageService.isConnected()).toBe(true);
    });

    it('should create article with caching', async () => {
      const articleData = {
        id: 'test-id',
        title: 'Test Article',
        url: 'https://example.com',
        content: 'Test content',
      };

      const result = await localStorageService.createArticle(articleData);
      expect(result.success).toBe(true);
      expect(result.data).toBe('test-id');
    });

    it('should get article from database', async () => {
      const result = await localStorageService.getArticle('test-id');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-id');
    });

    it('should update article and cache', async () => {
      const updates = { title: 'Updated Title' };
      const result = await localStorageService.updateArticle('test-id', updates);
      expect(result.success).toBe(true);
    });

    it('should delete article and remove from cache', async () => {
      const result = await localStorageService.deleteArticle('test-id');
      expect(result.success).toBe(true);
    });

    it('should get articles with filters', async () => {
      const filters = { limit: 10, offset: 0 };
      const result = await localStorageService.getArticles(filters);
      expect(result.success).toBe(true);
      expect(result.data?.items).toEqual([]);
    });
  });

  describe('Cache Operations', () => {
    it('should get cached article', () => {
      const result = localStorageService.getCachedArticle('test-id');
      expect(result).toBeNull();
    });

    it('should set cached article', () => {
      const article = {
        id: 'test-id',
        title: 'Test Article',
        url: 'https://example.com',
        content: 'Test content',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() => {
        localStorageService.setCachedArticle('test-id', article);
      }).not.toThrow();
    });

    it('should delete cached article', () => {
      const result = localStorageService.deleteCachedArticle('test-id');
      expect(result).toBe(true);
    });

    it('should clear cache', () => {
      expect(() => {
        localStorageService.clearCache();
      }).not.toThrow();
    });
  });

  describe('Authentication Operations', () => {
    it('should store token', async () => {
      const user = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        serverUrl: 'https://readeck.example.com',
        lastLoginAt: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = await localStorageService.storeToken('test-token', user);
      expect(result).toBe(true);
    });

    it('should retrieve token', async () => {
      const result = await localStorageService.retrieveToken();
      expect(result).toBe('test-token');
    });

    it('should delete token', async () => {
      const result = await localStorageService.deleteToken();
      expect(result).toBe(true);
    });

    it('should check if token is stored', async () => {
      const result = await localStorageService.isTokenStored();
      expect(result).toBe(true);
    });

    it('should validate stored token', async () => {
      const result = await localStorageService.validateStoredToken();
      expect(result.isValid).toBe(true);
      expect(result.isExpired).toBe(false);
    });
  });

  describe('Utility Operations', () => {
    it('should clear all data', async () => {
      const result = await localStorageService.clearAllData();
      expect(result.success).toBe(true);
    });

    it('should get cache stats', () => {
      const stats = localStorageService.getCacheStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
    });
  });

  describe('Enhanced Article Operations', () => {
    it('should get article as app format', async () => {
      const result = await localStorageService.getArticleAsAppFormat('test-id');
      expect(result).toBeTruthy();
      expect(result?.id).toBe('test-id');
    });

    it('should create article from app format', async () => {
      const article = {
        id: 'new-id',
        title: 'New Article',
        url: 'https://example.com/new',
        content: 'New content',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await localStorageService.createArticleFromAppFormat(article);
      expect(result).toBe('test-id'); // Mocked return value
    });

    it('should update article from app format', async () => {
      const article = {
        id: 'test-id',
        title: 'Updated Article',
        url: 'https://example.com',
        content: 'Updated content',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await localStorageService.updateArticleFromAppFormat('test-id', article);
      expect(result).toBe(true);
    });
  });
});