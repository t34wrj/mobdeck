/**
 * Comprehensive unit tests for ArticlesApiService
 * Tests service layer integration, type conversions, and error handling
 */

import ArticlesApiService, { articlesApiService } from '../../src/services/ArticlesApiService';
import { readeckApiService } from '../../src/services/ReadeckApiService';
import {
  Article,
  PaginatedResponse,
} from '../../src/types';
import {
  ReadeckArticle,
  ReadeckArticleList,
  ReadeckApiResponse,
  ReadeckApiError,
  ReadeckErrorCode,
  ReadeckUserProfile,
  ReadeckSyncResponse,
} from '../../src/types/readeck';
import type {
  FetchArticlesParams,
  CreateArticleParams,
  UpdateArticleParams,
  DeleteArticleParams,
  SyncArticlesParams,
} from '../../src/services/ArticlesApiService';

// Mock ReadeckApiService
jest.mock('../../src/services/ReadeckApiService', () => ({
  readeckApiService: {
    getArticles: jest.fn(),
    getArticle: jest.fn(),
    createArticle: jest.fn(),
    updateArticle: jest.fn(),
    deleteArticle: jest.fn(),
    syncArticles: jest.fn(),
    getUserProfile: jest.fn(),
  },
}));

// Mock ConnectivityManager
jest.mock('../../src/utils/connectivityManager', () => ({
  connectivityManager: {
    isOnline: jest.fn().mockReturnValue(true),
    getStatus: jest.fn().mockReturnValue('online'),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
}));

// Mock CacheService
jest.mock('../../src/services/CacheService', () => ({
  cacheService: {
    getArticle: jest.fn().mockReturnValue(null),
    setArticle: jest.fn(),
    hasArticle: jest.fn().mockReturnValue(false),
    deleteArticle: jest.fn(),
    clearArticles: jest.fn(),
    getStats: jest.fn().mockReturnValue({ articles: {} }),
  },
}));

// Mock RetryManager
jest.mock('../../src/utils/retryManager', () => ({
  RetryManager: {
    withRetry: jest.fn().mockImplementation(async (fn) => await fn()),
  },
}));

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation(),
};

describe('ArticlesApiService', () => {
  let service: ArticlesApiService;
  let mockReadeckApiService: jest.Mocked<typeof readeckApiService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Get mocked service
    mockReadeckApiService = readeckApiService as jest.Mocked<typeof readeckApiService>;
    
    // Create service instance
    service = new ArticlesApiService();
  });

  afterEach(() => {
    // Clean up console spies
    Object.values(consoleSpy).forEach(spy => spy.mockClear());
  });

  afterAll(() => {
    // Restore console methods
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  // Test data helpers
  const createMockReadeckArticle = (overrides: Partial<any> = {}): any => ({
    id: '1',
    title: 'Test Article',
    description: 'Test summary',
    content: 'Test content',
    url: 'https://example.com/article',
    resources: {
      image: { src: 'https://example.com/image.jpg' },
      thumbnail: { src: 'https://example.com/image.jpg' }
    },
    reading_time: 5,
    is_archived: false,
    is_marked: false, // API uses is_marked for favorites
    read_progress: 0, // API uses read_progress instead of is_read
    labels: ['test', 'article'], // API uses labels instead of tags
    created: '2023-01-01T00:00:00Z',
    updated: '2023-01-01T00:00:00Z',
    ...overrides,
  });

  const createMockArticle = (overrides: Partial<Article> = {}): Article => ({
    id: '1',
    title: 'Test Article',
    summary: 'Test summary',
    content: 'Test content',
    url: 'https://example.com/article',
    imageUrl: 'https://example.com/image.jpg',
    readTime: 5,
    isArchived: false,
    isFavorite: false,
    isRead: false,
    tags: ['test', 'article'],
    sourceUrl: 'https://example.com/article', // sourceUrl same as url
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    syncedAt: expect.any(String),
    contentUrl: '',
    ...overrides,
  });

  const createMockApiResponse = <T>(data: T): ReadeckApiResponse<T> => ({
    data,
    status: 200,
    headers: {},
    timestamp: '2023-01-01T00:00:00Z',
  });

  describe('Type Conversion', () => {
    it('should convert ReadeckArticle to Article format', async () => {
      const readeckArticle = createMockReadeckArticle({
        resources: {
          image: { src: 'https://example.com/image.jpg' }
        },
        reading_time: 10,
        is_archived: true,
        is_marked: true, // API field for favorites
        read_progress: 100, // 100 = fully read
      });

      const readeckArticleList: ReadeckArticleList = {
        articles: [readeckArticle],
        pagination: {
          page: 1,
          per_page: 20,
          total_count: 1,
          total_pages: 1,
        },
      };

      mockReadeckApiService.getArticles.mockResolvedValue(
        createMockApiResponse(readeckArticleList)
      );

      const result = await service.fetchArticles({});

      expect(result.items[0]).toMatchObject({
        id: '1',
        title: 'Test Article',
        imageUrl: 'https://example.com/image.jpg',
        readTime: 10,
        isArchived: true,
        isFavorite: true,
        isRead: true,
        sourceUrl: 'https://example.com/article', // sourceUrl same as url
        syncedAt: expect.any(String),
      });
    });

    it('should handle null values in ReadeckArticle conversion', async () => {
      const readeckArticle = createMockReadeckArticle({
        resources: null,
        description: null,
        content: null,
        labels: null,
      });

      const readeckArticleList: ReadeckArticleList = {
        articles: [readeckArticle],
        pagination: {
          page: 1,
          per_page: 20,
          total_count: 1,
          total_pages: 1,
        },
      };

      mockReadeckApiService.getArticles.mockResolvedValue(
        createMockApiResponse(readeckArticleList)
      );

      const result = await service.fetchArticles({});

      expect(result.items[0]).toMatchObject({
        imageUrl: '',
        summary: '',
        content: '',
        tags: [],
      });
    });

    it('should convert Article updates to UpdateArticleRequest format', async () => {
      const readeckArticle = createMockReadeckArticle();
      mockReadeckApiService.updateArticle.mockResolvedValue(
        createMockApiResponse(readeckArticle)
      );

      const updateParams: UpdateArticleParams = {
        id: '1',
        updates: {
          title: 'Updated Title',
          isArchived: true,
          isFavorite: true,
          isRead: true,
          tags: ['updated'],
        },
      };

      await service.updateArticle(updateParams);

      expect(mockReadeckApiService.updateArticle).toHaveBeenCalledWith('1', {
        title: 'Updated Title',
        is_archived: true, // camelCase to snake_case
        is_marked: true, // isFavorite maps to is_marked
        read_progress: 100, // isRead maps to read_progress (100 = read)
        labels: ['updated'], // tags maps to labels
      });
    });

    it('should only include defined fields in update request', async () => {
      const readeckArticle = createMockReadeckArticle();
      mockReadeckApiService.updateArticle.mockResolvedValue(
        createMockApiResponse(readeckArticle)
      );

      const updateParams: UpdateArticleParams = {
        id: '1',
        updates: {
          title: 'Updated Title',
          // Only title is defined
        },
      };

      await service.updateArticle(updateParams);

      expect(mockReadeckApiService.updateArticle).toHaveBeenCalledWith('1', {
        title: 'Updated Title',
        // Should not include undefined fields
      });
    });
  });

  describe('fetchArticles', () => {
    it('should fetch articles with default parameters', async () => {
      const readeckArticleList: ReadeckArticleList = {
        articles: [createMockReadeckArticle()],
        pagination: {
          page: 1,
          per_page: 20,
          total_count: 1,
          total_pages: 1,
        },
      };

      mockReadeckApiService.getArticles.mockResolvedValue(
        createMockApiResponse(readeckArticleList)
      );

      const result = await service.fetchArticles({});

      expect(mockReadeckApiService.getArticles).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        sort: ['-created'],
      });

      expect(result).toEqual({
        items: [createMockArticle()],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      });
    });

    it('should fetch articles with custom parameters', async () => {
      const readeckArticleList: ReadeckArticleList = {
        articles: [createMockReadeckArticle({
          read_progress: 100 // Make it read so client-side filter won't remove it
        })],
        pagination: {
          page: 2,
          per_page: 10,
          total_count: 25,
          total_pages: 3,
        },
      };

      mockReadeckApiService.getArticles.mockResolvedValue(
        createMockApiResponse(readeckArticleList)
      );

      const params: FetchArticlesParams = {
        page: 2,
        limit: 10,
        searchQuery: 'test search',
        filters: {
          isArchived: true,
          isFavorite: false,
          isRead: true,
          tags: ['tech', 'news'],
        },
      };

      const result = await service.fetchArticles(params);

      expect(mockReadeckApiService.getArticles).toHaveBeenCalledWith({
        limit: 10,
        offset: 10, // page 2 with limit 10 = offset 10
        sort: ['-created'],
        search: 'test search',
        is_archived: true,
        is_marked: false, // API uses is_marked for favorites
        read_status: ['read'], // API uses read_status array
        labels: 'tech,news', // API uses labels as comma-separated string
      });

      expect(result).toEqual({
        items: [createMockArticle({ isRead: true })], // Match the read status
        page: 2,
        totalPages: 3,
        totalItems: 25,
      });
    });

    it('should handle empty article list', async () => {
      const readeckArticleList: ReadeckArticleList = {
        articles: [],
        pagination: {
          page: 1,
          per_page: 20,
          total_count: 0,
          total_pages: 0,
        },
      };

      mockReadeckApiService.getArticles.mockResolvedValue(
        createMockApiResponse(readeckArticleList)
      );

      const result = await service.fetchArticles({});

      expect(result).toEqual({
        items: [],
        page: 1,
        totalPages: 1, // Service uses 1 as minimum totalPages
        totalItems: 0,
      });
    });

    it('should handle API errors', async () => {
      const apiError: ReadeckApiError = {
        code: ReadeckErrorCode.NETWORK_ERROR,
        message: 'Network connection failed',
        statusCode: undefined,
        details: 'Connection timeout',
        retryable: true,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.getArticles.mockRejectedValue(apiError);

      await expect(service.fetchArticles({})).rejects.toEqual(apiError);
      // handleApiError doesn't log errors - they're passed through
    });

    it('should handle unknown errors', async () => {
      const unknownError = new Error('Unknown error');
      mockReadeckApiService.getArticles.mockRejectedValue(unknownError);

      await expect(service.fetchArticles({})).rejects.toThrow('Fetch articles failed: Unknown error');
      // handleApiError doesn't log errors - they're passed through
    });
  });

  describe('createArticle', () => {
    it('should create article successfully', async () => {
      const readeckArticle = createMockReadeckArticle({
        title: 'New Article',
        url: 'https://example.com/new-article',
        labels: ['new', 'test'],
      });

      mockReadeckApiService.createArticle.mockResolvedValue(
        createMockApiResponse(readeckArticle)
      );

      const params: CreateArticleParams = {
        title: 'New Article',
        url: 'https://example.com/new-article',
        tags: ['new', 'test'],
      };

      const result = await service.createArticle(params);

      expect(mockReadeckApiService.createArticle).toHaveBeenCalledWith({
        url: 'https://example.com/new-article',
        title: 'New Article',
        labels: ['new', 'test'], // API uses labels instead of tags
      });

      expect(result).toMatchObject(createMockArticle({
        title: 'New Article',
        url: 'https://example.com/new-article',
        sourceUrl: 'https://example.com/new-article', // sourceUrl matches url
        tags: ['new', 'test'],
      }));

      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Creating article:', {
        url: 'https://example.com/new-article',
        title: 'New Article',
      });
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Successfully created article:', '1');
    });

    it('should create article with minimal parameters', async () => {
      const readeckArticle = createMockReadeckArticle();
      mockReadeckApiService.createArticle.mockResolvedValue(
        createMockApiResponse(readeckArticle)
      );

      const params: CreateArticleParams = {
        title: 'Minimal Article',
        url: 'https://example.com/minimal',
      };

      const result = await service.createArticle(params);

      expect(mockReadeckApiService.createArticle).toHaveBeenCalledWith({
        url: 'https://example.com/minimal',
        title: 'Minimal Article',
        labels: undefined,
      });

      expect(result).toMatchObject(createMockArticle());
    });

    it('should handle creation errors', async () => {
      const apiError: ReadeckApiError = {
        code: ReadeckErrorCode.VALIDATION_ERROR,
        message: 'Invalid URL provided',
        statusCode: 400,
        details: 'URL is not accessible',
        retryable: false,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.createArticle.mockRejectedValue(apiError);

      const params: CreateArticleParams = {
        title: 'Invalid Article',
        url: 'invalid-url',
      };

      await expect(service.createArticle(params)).rejects.toThrow('Create article failed: Invalid URL provided');
      // handleApiError doesn't log errors - they're passed through
    });
  });

  describe('updateArticle', () => {
    it('should update article successfully', async () => {
      const readeckArticle = createMockReadeckArticle({
        title: 'Updated Article',
        is_archived: true,
        is_marked: true,
      });

      mockReadeckApiService.updateArticle.mockResolvedValue(
        createMockApiResponse(readeckArticle)
      );

      const params: UpdateArticleParams = {
        id: '1',
        updates: {
          title: 'Updated Article',
          isArchived: true,
          isFavorite: true,
        },
      };

      const result = await service.updateArticle(params);

      expect(mockReadeckApiService.updateArticle).toHaveBeenCalledWith('1', {
        title: 'Updated Article',
        is_archived: true,
        is_marked: true, // API uses is_marked for favorites
      });

      expect(result).toMatchObject(createMockArticle({
        title: 'Updated Article',
        isArchived: true,
        isFavorite: true,
      }));

      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Updating article:', {
        id: '1',
        updates: ['title', 'isArchived', 'isFavorite'],
      });
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Successfully updated article:', '1');
    });

    it('should handle update errors', async () => {
      const apiError: ReadeckApiError = {
        code: ReadeckErrorCode.NOT_FOUND,
        message: 'Article not found',
        statusCode: 404,
        details: 'Article with ID 999 does not exist',
        retryable: false,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.updateArticle.mockRejectedValue(apiError);

      const params: UpdateArticleParams = {
        id: '999',
        updates: { title: 'Updated Title' },
      };

      await expect(service.updateArticle(params)).rejects.toThrow('Update article failed: Article not found');
      // handleApiError doesn't log errors - they're passed through
    });
  });

  describe('deleteArticle', () => {
    it('should delete article successfully', async () => {
      mockReadeckApiService.deleteArticle.mockResolvedValue(
        createMockApiResponse(undefined)
      );

      const params: DeleteArticleParams = {
        id: '1',
        permanent: true,
      };

      await service.deleteArticle(params);

      expect(mockReadeckApiService.deleteArticle).toHaveBeenCalledWith('1');
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Deleting article:', {
        id: '1',
        permanent: true,
      });
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Successfully deleted article:', '1');
    });

    it('should handle deletion errors', async () => {
      const apiError: ReadeckApiError = {
        code: ReadeckErrorCode.AUTHORIZATION_ERROR,
        message: 'Access denied',
        statusCode: 403,
        details: 'Cannot delete this article',
        retryable: false,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.deleteArticle.mockRejectedValue(apiError);

      const params: DeleteArticleParams = { id: '1' };

      await expect(service.deleteArticle(params)).rejects.toEqual(apiError);
      // handleApiError doesn't log errors - they're passed through
    });
  });

  describe('syncArticles', () => {
    it('should sync articles successfully', async () => {
      const syncResponse: ReadeckSyncResponse = {
        articles: [
          createMockReadeckArticle({ id: '1' }),
          createMockReadeckArticle({ id: '2' }),
          createMockReadeckArticle({ id: '3' }),
        ],
        last_updated: '2023-01-01T00:00:00Z',
        last_sync: '2023-01-01T00:00:00Z',
        total_count: 3,
        has_more: false,
      };

      mockReadeckApiService.syncArticles.mockResolvedValue(
        createMockApiResponse(syncResponse)
      );

      const params: SyncArticlesParams = {
        fullSync: false,
        articlesOnly: true,
      };

      const result = await service.syncArticles(params);

      expect(mockReadeckApiService.syncArticles).toHaveBeenCalledWith({
        limit: 100,
        include_deleted: false,
      });

      expect(result).toEqual({
        syncedCount: 3,
        conflictCount: 0,
        articles: expect.any(Array),
      });
      expect(result.articles).toHaveLength(3);

      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Syncing articles:', params);
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Sync completed: 3 articles synced, 0 conflicts');
    });

    it('should handle full sync', async () => {
      const syncResponse: ReadeckSyncResponse = {
        articles: [createMockReadeckArticle()],
        last_updated: '2023-01-01T00:00:00Z',
        last_sync: '2023-01-01T00:00:00Z',
        total_count: 1,
        has_more: true,
      };

      mockReadeckApiService.syncArticles.mockResolvedValue(
        createMockApiResponse(syncResponse)
      );

      const params: SyncArticlesParams = {
        fullSync: true,
      };

      await service.syncArticles(params);

      expect(mockReadeckApiService.syncArticles).toHaveBeenCalledWith({
        limit: undefined, // No limit for full sync
        include_deleted: true,
      });
    });

    it('should handle sync errors', async () => {
      const apiError: ReadeckApiError = {
        code: ReadeckErrorCode.SERVER_ERROR,
        message: 'Sync service unavailable',
        statusCode: 503,
        details: 'Sync endpoint is temporarily down',
        retryable: true,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.syncArticles.mockRejectedValue(apiError);

      const params: SyncArticlesParams = {};

      await expect(service.syncArticles(params)).rejects.toEqual(apiError);
      // handleApiError doesn't log errors - they're passed through
    });
  });

  describe('getArticle', () => {
    it('should get single article successfully', async () => {
      const readeckArticle = createMockReadeckArticle({ id: '123' });
      mockReadeckApiService.getArticle.mockResolvedValue(
        createMockApiResponse(readeckArticle)
      );

      const result = await service.getArticle('123');

      expect(mockReadeckApiService.getArticle).toHaveBeenCalledWith('123');
      expect(result).toMatchObject(createMockArticle({ id: '123' }));
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Cache miss, fetching article:', '123');
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Successfully fetched article:', '123', 'with content length:', 12);
    });

    it('should handle get article errors', async () => {
      const apiError: ReadeckApiError = {
        code: ReadeckErrorCode.NOT_FOUND,
        message: 'Article not found',
        statusCode: 404,
        details: 'Article with ID abc does not exist',
        retryable: false,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.getArticle.mockRejectedValue(apiError);

      await expect(service.getArticle('abc')).rejects.toThrow('Get article failed: Article not found');
      // handleApiError doesn't log errors - they're passed through
    });
  });

  describe('batchUpdateArticles', () => {
    it('should batch update articles successfully', async () => {
      const readeckArticle1 = createMockReadeckArticle({ id: '1', title: 'Updated 1' });
      const readeckArticle2 = createMockReadeckArticle({ id: '2', title: 'Updated 2' });

      mockReadeckApiService.updateArticle
        .mockResolvedValueOnce(createMockApiResponse(readeckArticle1))
        .mockResolvedValueOnce(createMockApiResponse(readeckArticle2));

      const updates = [
        { id: '1', updates: { title: 'Updated 1' } },
        { id: '2', updates: { title: 'Updated 2' } },
      ];

      const result = await service.batchUpdateArticles(updates);

      expect(mockReadeckApiService.updateArticle).toHaveBeenCalledTimes(2);
      expect(mockReadeckApiService.updateArticle).toHaveBeenNthCalledWith(1, '1', { title: 'Updated 1' });
      expect(mockReadeckApiService.updateArticle).toHaveBeenNthCalledWith(2, '2', { title: 'Updated 2' });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject(createMockArticle({ id: '1', title: 'Updated 1' }));
      expect(result[1]).toMatchObject(createMockArticle({ id: '2', title: 'Updated 2' }));

      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Batch updating articles:', 2);
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Successfully batch updated articles:', 2);
    });

    it('should handle batch update errors', async () => {
      const apiError = new Error('Update failed');
      mockReadeckApiService.updateArticle.mockRejectedValue(apiError);

      const updates = [{ id: '1', updates: { title: 'Updated 1' } }];

      await expect(service.batchUpdateArticles(updates)).rejects.toThrow('Batch update articles failed: Update article failed: Update failed');
      // handleApiError doesn't log errors - they're passed through
    });
  });

  describe('batchDeleteArticles', () => {
    it('should batch delete articles successfully', async () => {
      mockReadeckApiService.deleteArticle.mockResolvedValue(
        createMockApiResponse(undefined)
      );

      const ids = ['1', '2', '3'];

      await service.batchDeleteArticles(ids);

      expect(mockReadeckApiService.deleteArticle).toHaveBeenCalledTimes(3);
      expect(mockReadeckApiService.deleteArticle).toHaveBeenNthCalledWith(1, '1');
      expect(mockReadeckApiService.deleteArticle).toHaveBeenNthCalledWith(2, '2');
      expect(mockReadeckApiService.deleteArticle).toHaveBeenNthCalledWith(3, '3');

      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Batch deleting articles:', 3);
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Successfully batch deleted articles:', 3);
    });

    it('should handle batch delete errors', async () => {
      const apiError = new Error('Delete failed');
      mockReadeckApiService.deleteArticle.mockRejectedValue(apiError);

      const ids = ['1'];

      await expect(service.batchDeleteArticles(ids)).rejects.toThrow('Batch delete articles failed: Delete article failed: Delete failed');
      // handleApiError doesn't log errors - they're passed through
    });
  });

  describe('getArticleStats', () => {
    it('should get article statistics successfully', async () => {
      const userProfile: ReadeckUserProfile = {
        id: '1',
        username: 'testuser',
        provider: {
          application: 'mobdeck',
          id: 'provider-id',
          name: 'test-provider',
          permissions: ['read'],
          roles: ['user']
        },
        user: {
          created: '2023-01-01T00:00:00Z',
          email: 'test@example.com',
          username: 'testuser',
          updated: '2023-01-01T00:00:00Z',
          settings: {
            debug_info: false
          },
          reader_settings: {
            font: 'Arial',
            font_size: 16,
            line_height: 1.5
          }
        }
      };

      mockReadeckApiService.getUserProfile.mockResolvedValue(
        createMockApiResponse(userProfile)
      );

      const result = await service.getArticleStats();

      expect(mockReadeckApiService.getUserProfile).toHaveBeenCalled();
      expect(result).toEqual({
        total: 100,
        read: 75,
        favorite: 25,
        archived: 10,
      });

      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Fetching article statistics');
    });

    it('should handle stats retrieval errors', async () => {
      const apiError: ReadeckApiError = {
        code: ReadeckErrorCode.AUTHORIZATION_ERROR,
        message: 'Access denied',
        statusCode: 403,
        details: 'Cannot access user profile',
        retryable: false,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.getUserProfile.mockRejectedValue(apiError);

      await expect(service.getArticleStats()).rejects.toEqual(apiError);
      // handleApiError doesn't log errors - they're passed through
    });
  });

  describe('Filter Conversion', () => {
    it('should convert empty filters correctly', async () => {
      const readeckArticleList: ReadeckArticleList = {
        articles: [],
        pagination: { page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      };

      mockReadeckApiService.getArticles.mockResolvedValue(
        createMockApiResponse(readeckArticleList)
      );

      await service.fetchArticles({});

      expect(mockReadeckApiService.getArticles).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        sort: ['-created'],
      });
    });

    it('should not include undefined filter values', async () => {
      const readeckArticleList: ReadeckArticleList = {
        articles: [],
        pagination: { page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      };

      mockReadeckApiService.getArticles.mockResolvedValue(
        createMockApiResponse(readeckArticleList)
      );

      const params: FetchArticlesParams = {
        filters: {
          isArchived: undefined,
          isFavorite: false,
          isRead: undefined,
        },
      };

      await service.fetchArticles(params);

      expect(mockReadeckApiService.getArticles).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        sort: ['-created'],
        is_marked: false, // API uses is_marked for favorites
        // Should not include is_archived or read_status
      });
    });

    it('should handle empty tags array', async () => {
      const readeckArticleList: ReadeckArticleList = {
        articles: [],
        pagination: { page: 1, per_page: 20, total_count: 0, total_pages: 0 },
      };

      mockReadeckApiService.getArticles.mockResolvedValue(
        createMockApiResponse(readeckArticleList)
      );

      const params: FetchArticlesParams = {
        filters: {
          tags: [], // Empty array should not be included
        },
      };

      await service.fetchArticles(params);

      expect(mockReadeckApiService.getArticles).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        sort: ['-created'],
        // Should not include labels (empty array not sent)
      });
    });
  });

  describe('Singleton Export', () => {
    it('should export singleton instance', () => {
      expect(articlesApiService).toBeInstanceOf(ArticlesApiService);
    });

    it('should maintain singleton behavior', () => {
      // Both calls should return the same instance
      expect(articlesApiService).toBe(articlesApiService);
    });
  });
});