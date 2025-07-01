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
  const createMockReadeckArticle = (overrides: Partial<ReadeckArticle> = {}): ReadeckArticle => ({
    id: '1',
    title: 'Test Article',
    summary: 'Test summary',
    content: 'Test content',
    url: 'https://example.com/article',
    image_url: 'https://example.com/image.jpg',
    read_time: 5,
    is_archived: false,
    is_favorite: false,
    is_read: false,
    tags: ['test', 'article'],
    source_url: 'https://example.com',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
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
    sourceUrl: 'https://example.com',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    syncedAt: expect.any(String),
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
        image_url: 'https://example.com/image.jpg',
        read_time: 10,
        is_archived: true,
        is_favorite: true,
        is_read: true,
        source_url: 'https://source.com',
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
        imageUrl: 'https://example.com/image.jpg', // snake_case to camelCase
        readTime: 10,
        isArchived: true,
        isFavorite: true,
        isRead: true,
        sourceUrl: 'https://source.com',
        syncedAt: expect.any(String),
      });
    });

    it('should handle null values in ReadeckArticle conversion', async () => {
      const readeckArticle = createMockReadeckArticle({
        image_url: null,
        summary: null,
        content: null,
        tags: null,
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
        imageUrl: null,
        summary: null,
        content: null,
        tags: null,
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
        is_favorite: true,
        is_read: true,
        tags: ['updated'],
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
        page: 1,
        per_page: 20,
        sort_by: 'created_at',
        sort_order: 'desc',
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
        articles: [createMockReadeckArticle()],
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
        page: 2,
        per_page: 10,
        sort_by: 'created_at',
        sort_order: 'desc',
        search: 'test search',
        is_archived: true,
        is_favorite: false,
        is_read: true,
        tags: ['tech', 'news'],
      });

      expect(result).toEqual({
        items: [createMockArticle()],
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
        totalPages: 0,
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
      expect(consoleSpy.error).toHaveBeenCalledWith('[ArticlesApiService] Fetch articles failed:', apiError);
    });

    it('should handle unknown errors', async () => {
      const unknownError = new Error('Unknown error');
      mockReadeckApiService.getArticles.mockRejectedValue(unknownError);

      await expect(service.fetchArticles({})).rejects.toThrow('Fetch articles failed: Unknown error');
      expect(consoleSpy.error).toHaveBeenCalledWith('[ArticlesApiService] Fetch articles failed:', unknownError);
    });
  });

  describe('createArticle', () => {
    it('should create article successfully', async () => {
      const readeckArticle = createMockReadeckArticle({
        title: 'New Article',
        url: 'https://example.com/new-article',
        tags: ['new', 'test'],
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
        tags: ['new', 'test'],
        is_favorite: false,
      });

      expect(result).toMatchObject(createMockArticle({
        title: 'New Article',
        url: 'https://example.com/new-article',
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
        tags: undefined,
        is_favorite: false,
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
      expect(consoleSpy.error).toHaveBeenCalledWith('[ArticlesApiService] Create article failed:', apiError);
    });
  });

  describe('updateArticle', () => {
    it('should update article successfully', async () => {
      const readeckArticle = createMockReadeckArticle({
        title: 'Updated Article',
        is_archived: true,
        is_favorite: true,
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
        is_favorite: true,
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
      expect(consoleSpy.error).toHaveBeenCalledWith('[ArticlesApiService] Update article failed:', apiError);
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
      expect(consoleSpy.error).toHaveBeenCalledWith('[ArticlesApiService] Delete article failed:', apiError);
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
        last_sync: '2023-01-01T00:00:00Z',
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
      });

      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Syncing articles:', params);
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Sync completed: 3 articles synced, 0 conflicts');
    });

    it('should handle full sync', async () => {
      const syncResponse: ReadeckSyncResponse = {
        articles: [createMockReadeckArticle()],
        last_sync: '2023-01-01T00:00:00Z',
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
      expect(consoleSpy.error).toHaveBeenCalledWith('[ArticlesApiService] Sync articles failed:', apiError);
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
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Fetching article:', '123');
      expect(consoleSpy.log).toHaveBeenCalledWith('[ArticlesApiService] Successfully fetched article:', '123');
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
      expect(consoleSpy.error).toHaveBeenCalledWith('[ArticlesApiService] Get article failed:', apiError);
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
      expect(consoleSpy.error).toHaveBeenCalledTimes(2); // Both individual and batch errors logged
      expect(consoleSpy.error).toHaveBeenCalledWith('[ArticlesApiService] Update article failed:', apiError);
      expect(consoleSpy.error).toHaveBeenLastCalledWith('[ArticlesApiService] Batch update articles failed:', expect.any(Error));
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
      expect(consoleSpy.error).toHaveBeenCalledTimes(2); // Both individual and batch errors logged
      expect(consoleSpy.error).toHaveBeenCalledWith('[ArticlesApiService] Delete article failed:', apiError);
      expect(consoleSpy.error).toHaveBeenLastCalledWith('[ArticlesApiService] Batch delete articles failed:', expect.any(Error));
    });
  });

  describe('getArticleStats', () => {
    it('should get article statistics successfully', async () => {
      const userProfile: ReadeckUserProfile = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: 'Test bio',
        avatar_url: null,
        settings: {
          theme: 'light',
          language: 'en',
        },
        stats: {
          total_articles: 100,
          read_articles: 75,
          favorite_articles: 25,
          archived_articles: 10,
        },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
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
      expect(consoleSpy.error).toHaveBeenCalledWith('[ArticlesApiService] Get article stats failed:', apiError);
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
        page: 1,
        per_page: 20,
        sort_by: 'created_at',
        sort_order: 'desc',
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
        page: 1,
        per_page: 20,
        sort_by: 'created_at',
        sort_order: 'desc',
        is_favorite: false,
        // Should not include is_archived or is_read
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
        page: 1,
        per_page: 20,
        sort_by: 'created_at',
        sort_order: 'desc',
        // Should not include tags
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