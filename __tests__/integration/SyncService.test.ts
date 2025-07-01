/**
 * SyncService Integration Tests
 * 
 * Comprehensive integration tests covering:
 * - Full sync workflows (bidirectional sync)
 * - Conflict resolution strategies (Last-Write-Wins, Local-Wins, Remote-Wins)
 * - Error recovery and network failure scenarios
 * - Batch processing and progress tracking
 * - Database transaction integrity
 * - Redux state management integration
 */

import SyncService, { syncService } from '../../src/services/SyncService';
import DatabaseService, { DatabaseUtilityFunctions } from '../../src/services/DatabaseService';
import { articlesApiService } from '../../src/services/ArticlesApiService';
import { store } from '../../src/store';
import {
  SyncStatus,
  ConflictResolutionStrategy,
  SyncPhase,
  ConflictType,
  NetworkType,
} from '../../src/types/sync';
import { Article } from '../../src/types';
import { DBArticle } from '../../src/types/database';
import { resolveConflict } from '../../src/utils/conflictResolution';

// Mock DatabaseUtilityFunctions
const mockDatabaseUtilityFunctions = {
  convertDBArticleToArticle: jest.fn((dbArticle: DBArticle): Article => ({
    id: dbArticle.id,
    title: dbArticle.title,
    summary: dbArticle.summary,
    content: dbArticle.content,
    url: dbArticle.url,
    imageUrl: dbArticle.image_url || undefined,
    readTime: dbArticle.read_time,
    isArchived: Boolean(dbArticle.is_archived),
    isFavorite: Boolean(dbArticle.is_favorite),
    isRead: Boolean(dbArticle.is_read),
    tags: ['test'],
    sourceUrl: dbArticle.source_url || undefined,
    createdAt: new Date(dbArticle.created_at * 1000),
    updatedAt: new Date(dbArticle.updated_at * 1000),
    syncedAt: dbArticle.synced_at ? new Date(dbArticle.synced_at * 1000) : undefined,
    isModified: Boolean(dbArticle.is_modified),
    deletedAt: dbArticle.deleted_at ? new Date(dbArticle.deleted_at * 1000) : undefined,
  })),
  convertArticleToDBArticle: jest.fn((article: Article): DBArticle => ({
    id: article.id,
    title: article.title,
    summary: article.summary,
    content: article.content,
    url: article.url,
    image_url: article.imageUrl || null,
    read_time: article.readTime,
    is_archived: article.isArchived ? 1 : 0,
    is_favorite: article.isFavorite ? 1 : 0,
    is_read: article.isRead ? 1 : 0,
    source_url: article.sourceUrl || null,
    created_at: Math.floor(article.createdAt.getTime() / 1000),
    updated_at: Math.floor(article.updatedAt.getTime() / 1000),
    synced_at: article.syncedAt ? Math.floor(article.syncedAt.getTime() / 1000) : null,
    is_modified: article.isModified ? 1 : 0,
    deleted_at: article.deletedAt ? Math.floor(article.deletedAt.getTime() / 1000) : null,
  })),
};

// Mock external dependencies
jest.mock('../../src/services/DatabaseService', () => ({
  default: jest.fn(),
  DatabaseUtilityFunctions: mockDatabaseUtilityFunctions,
}));
jest.mock('../../src/services/ArticlesApiService');

// Test data factory
const createTestArticle = (id: string, overrides: Partial<Article> = {}): Article => ({
  id,
  title: `Test Article ${id}`,
  summary: `Summary for ${id}`,
  content: `Content for article ${id}`,
  url: `https://example.com/article-${id}`,
  imageUrl: undefined,
  readTime: 5,
  isArchived: false,
  isFavorite: false,
  isRead: false,
  tags: ['test'],
  sourceUrl: 'https://example.com',
  createdAt: new Date('2023-01-01T10:00:00Z'),
  updatedAt: new Date('2023-01-01T12:00:00Z'),
  syncedAt: new Date('2023-01-01T11:00:00Z'),
  isModified: false,
  ...overrides,
});

const createTestDBArticle = (id: string, overrides: Partial<DBArticle> = {}): DBArticle => ({
  id,
  title: `Test Article ${id}`,
  summary: `Summary for ${id}`,
  content: `Content for article ${id}`,
  url: `https://example.com/article-${id}`,
  image_url: null,
  read_time: 5,
  is_archived: 0,
  is_favorite: 0,
  is_read: 0,
  source_url: 'https://example.com',
  created_at: Math.floor(new Date('2023-01-01T10:00:00Z').getTime() / 1000),
  updated_at: Math.floor(new Date('2023-01-01T12:00:00Z').getTime() / 1000),
  synced_at: Math.floor(new Date('2023-01-01T11:00:00Z').getTime() / 1000),
  is_modified: 0,
  deleted_at: null,
  ...overrides,
});

describe('SyncService Integration Tests', () => {
  let syncServiceInstance: SyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Redux store
    store.dispatch({ type: '@@INIT' });
    
    // Setup default mock implementations
    setupDefaultMocks();
    
    // Get fresh SyncService instance
    syncServiceInstance = SyncService.getInstance();
  });

  const setupDefaultMocks = () => {
    const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;
    const mockArticlesApiService = articlesApiService as jest.Mocked<typeof articlesApiService>;
    
    // Database service defaults
    mockDatabaseService.getStats = jest.fn().mockResolvedValue({
      success: true,
      data: {
        totalArticles: 0,
        archivedArticles: 0,
        favoriteArticles: 0,
        unreadArticles: 0,
        totalLabels: 0,
        pendingSyncItems: 0,
        databaseSize: 1024,
        lastSyncAt: null,
      },
    });

    mockDatabaseService.getSyncMetadata = jest.fn().mockResolvedValue({
      success: true,
      data: { items: [], totalCount: 0, hasMore: false, limit: 100, offset: 0 },
    });

    mockDatabaseService.getArticles = jest.fn().mockResolvedValue({
      success: true,
      data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
    });

    mockDatabaseService.updateArticle = jest.fn().mockResolvedValue({
      success: true,
      rowsAffected: 1,
    });

    mockDatabaseService.createArticle = jest.fn().mockResolvedValue({
      success: true,
      data: 'new-article-id',
      rowsAffected: 1,
    });

    mockDatabaseService.getArticle = jest.fn().mockResolvedValue({
      success: false,
      error: 'Article not found',
    });

    // API service defaults
    mockArticlesApiService.fetchArticles = jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      totalPages: 1,
      totalItems: 0,
    });

    mockArticlesApiService.getArticle = jest.fn().mockRejectedValue(new Error('Not found'));
    mockArticlesApiService.createArticle = jest.fn().mockResolvedValue(createTestArticle('created'));
    mockArticlesApiService.updateArticle = jest.fn().mockResolvedValue(createTestArticle('updated'));
  };

  describe('Full Sync Workflow Integration', () => {
    it('should complete full bidirectional sync with no conflicts', async () => {
      const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;
      const mockArticlesApiService = articlesApiService as jest.Mocked<typeof articlesApiService>;
      
      // Setup: Local articles to upload
      const localArticles = [
        createTestDBArticle('local-1', { is_modified: 1, title: 'Local Article 1' }),
        createTestDBArticle('local-2', { is_modified: 1, title: 'Local Article 2' }),
      ];

      // Setup: Remote articles to download
      const remoteArticles = [
        createTestArticle('remote-1', { title: 'Remote Article 1' }),
        createTestArticle('remote-2', { title: 'Remote Article 2' }),
      ];

      // Mock database responses
      mockDatabaseService.getArticles = jest.fn()
        .mockResolvedValueOnce({
          success: true,
          data: { items: localArticles, totalCount: 2, hasMore: false, limit: 50, offset: 0 },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
        });

      mockDatabaseService.getStats = jest.fn().mockResolvedValue({
        success: true,
        data: {
          totalArticles: 2,
          archivedArticles: 0,
          favoriteArticles: 0,
          unreadArticles: 2,
          totalLabels: 0,
          pendingSyncItems: 0,
          databaseSize: 2048,
          lastSyncAt: Math.floor(new Date('2023-01-01T00:00:00Z').getTime() / 1000),
        },
      });

      // Mock API responses
      mockArticlesApiService.getArticle = jest.fn().mockRejectedValue(new Error('Not found'));
      mockArticlesApiService.createArticle = jest.fn().mockResolvedValue(createTestArticle('created'));
      mockArticlesApiService.fetchArticles = jest.fn().mockResolvedValue({
        items: remoteArticles,
        page: 1,
        totalPages: 1,
        totalItems: 2,
      });

      mockDatabaseService.getArticle = jest.fn().mockResolvedValue({
        success: false,
        error: 'Article not found',
      });

      mockDatabaseService.updateArticle = jest.fn().mockResolvedValue({
        success: true,
        rowsAffected: 1,
      });

      mockDatabaseService.createArticle = jest.fn().mockResolvedValue({
        success: true,
        data: 'new-article-id',
        rowsAffected: 1,
      });

      // Execute sync
      const result = await syncServiceInstance.startFullSync();

      // Verify results
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(4); // 2 uploaded + 2 downloaded
      expect(result.conflictCount).toBe(0);
      expect(result.errorCount).toBe(0);

      // Verify API calls
      expect(mockArticlesApiService.createArticle).toHaveBeenCalledTimes(2);
      expect(mockDatabaseService.createArticle).toHaveBeenCalledTimes(2);

      // Verify Redux state
      const finalState = store.getState();
      expect(finalState.sync.status).toBe(SyncStatus.SUCCESS);
      expect(finalState.sync.lastSyncTime).toBeDefined();
    });

    it('should handle incremental sync with timestamp filtering', async () => {
      const lastSyncTime = new Date('2023-01-01T12:00:00Z');
      const recentRemoteArticles = [
        createTestArticle('recent-1', { 
          updatedAt: new Date('2023-01-01T13:00:00Z'),
          title: 'Recent Article 1' 
        }),
        createTestArticle('recent-2', { 
          updatedAt: new Date('2023-01-01T14:00:00Z'),
          title: 'Recent Article 2' 
        }),
      ];

      // Mock last sync timestamp
      mockDatabaseService.getStats.mockResolvedValue({
        success: true,
        data: {
          totalArticles: 5,
          archivedArticles: 1,
          favoriteArticles: 2,
          unreadArticles: 3,
          totalLabels: 2,
          pendingSyncItems: 0,
          databaseSize: 5120,
          lastSyncAt: Math.floor(lastSyncTime.getTime() / 1000),
        },
      });

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
      });

      // Mock API to return only recent articles
      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: recentRemoteArticles,
        page: 1,
        totalPages: 1,
        totalItems: 2,
      });

      mockDatabaseService.getArticle.mockResolvedValue({
        success: false,
        error: 'Article not found',
      });

      const result = await syncServiceInstance.startFullSync();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(2); // Only recent articles

      // Verify that API was called with proper filtering
      expect(mockArticlesApiService.fetchArticles).toHaveBeenCalledWith({
        page: 1,
        limit: 1000,
        forceRefresh: true,
      });
    });

    it('should handle batch processing for large datasets', async () => {
      // Create large dataset
      const largeArticleSet = Array.from({ length: 125 }, (_, i) => 
        createTestDBArticle(`bulk-${i}`, { 
          is_modified: 1,
          title: `Bulk Article ${i}` 
        })
      );

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: largeArticleSet, totalCount: 125, hasMore: false, limit: 200, offset: 0 },
      });

      mockArticlesApiService.getArticle.mockRejectedValue(new Error('Not found'));
      mockArticlesApiService.createArticle.mockResolvedValue(createTestArticle('created'));

      // Configure smaller batch size for testing
      syncServiceInstance.updateConfig({ batchSize: 25 });

      const result = await syncServiceInstance.startFullSync();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(125);

      // Verify batch processing occurred
      expect(mockArticlesApiService.createArticle).toHaveBeenCalledTimes(125);

      // Verify progress tracking
      const finalState = store.getState();
      expect(finalState.sync.progress.processedItems).toBe(125);
    });
  });

  describe('Conflict Resolution Integration', () => {
    const setupConflictScenario = (strategy: ConflictResolutionStrategy) => {
      // Configure strategy
      syncServiceInstance.updateConfig({ conflictResolutionStrategy: strategy });

      const localArticle = createTestDBArticle('conflict-1', {
        title: 'Local Title',
        is_favorite: 1,
        is_modified: 1,
        updated_at: Math.floor(new Date('2023-01-01T10:00:00Z').getTime() / 1000),
      });

      const remoteArticle = createTestArticle('conflict-1', {
        title: 'Remote Title',
        isFavorite: false,
        isRead: true,
        updatedAt: new Date('2023-01-01T12:00:00Z'), // Remote is newer
      });

      return { localArticle, remoteArticle };
    };

    it('should resolve conflicts using Last-Write-Wins strategy', async () => {
      const { localArticle, remoteArticle } = setupConflictScenario(ConflictResolutionStrategy.LAST_WRITE_WINS);

      // Setup sync down scenario
      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [remoteArticle],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      });

      mockDatabaseService.getArticle.mockResolvedValue({
        success: true,
        data: localArticle,
      });

      const result = await syncServiceInstance.startFullSync();

      expect(result.success).toBe(true);
      expect(result.conflictCount).toBe(1);

      // Verify that conflict resolution was called
      expect(mockDatabaseService.updateArticle).toHaveBeenCalledWith(
        'conflict-1',
        expect.objectContaining({
          title: 'Remote Title', // Remote wins due to newer timestamp
          is_modified: 0,
        })
      );

      // Verify Redux conflict tracking
      const finalState = store.getState();
      expect(finalState.sync.conflicts).toHaveLength(0); // Should be resolved
    });

    it('should resolve conflicts using Local-Wins strategy', async () => {
      const { localArticle, remoteArticle } = setupConflictScenario(ConflictResolutionStrategy.LOCAL_WINS);

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [remoteArticle],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      });

      mockDatabaseService.getArticle.mockResolvedValue({
        success: true,
        data: localArticle,
      });

      const result = await syncServiceInstance.startFullSync();

      expect(result.success).toBe(true);
      expect(result.conflictCount).toBe(1);

      // Verify local version is preserved
      expect(mockDatabaseService.updateArticle).toHaveBeenCalledWith(
        'conflict-1',
        expect.objectContaining({
          is_modified: 1, // Marked for upload
        })
      );
    });

    it('should resolve conflicts using Remote-Wins strategy', async () => {
      const { localArticle, remoteArticle } = setupConflictScenario(ConflictResolutionStrategy.REMOTE_WINS);

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [remoteArticle],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      });

      mockDatabaseService.getArticle.mockResolvedValue({
        success: true,
        data: localArticle,
      });

      const result = await syncServiceInstance.startFullSync();

      expect(result.success).toBe(true);
      expect(result.conflictCount).toBe(1);

      // Verify remote version is used
      expect(mockDatabaseService.updateArticle).toHaveBeenCalledWith(
        'conflict-1',
        expect.objectContaining({
          title: 'Remote Title',
          is_modified: 0,
        })
      );
    });

    it('should handle manual conflict resolution strategy', async () => {
      const { localArticle, remoteArticle } = setupConflictScenario(ConflictResolutionStrategy.MANUAL);

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [remoteArticle],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      });

      mockDatabaseService.getArticle.mockResolvedValue({
        success: true,
        data: localArticle,
      });

      const result = await syncServiceInstance.startFullSync();

      expect(result.success).toBe(true);
      expect(result.conflictCount).toBe(1);

      // Verify conflicts are stored for manual resolution
      const finalState = store.getState();
      expect(finalState.sync.conflicts.length).toBeGreaterThan(0);
    });

    it('should detect and categorize different conflict types', async () => {
      const contentConflictArticle = createTestArticle('content-conflict', {
        title: 'Different Title',
        content: 'Different Content',
        updatedAt: new Date('2023-01-01T12:00:00Z'),
      });

      const statusConflictArticle = createTestArticle('status-conflict', {
        isArchived: true,
        isFavorite: true,
        isRead: true,
        updatedAt: new Date('2023-01-01T12:00:00Z'),
      });

      const tagsConflictArticle = createTestArticle('tags-conflict', {
        tags: ['remote', 'different', 'tags'],
        updatedAt: new Date('2023-01-01T12:00:00Z'),
      });

      const localArticles = [
        createTestDBArticle('content-conflict', { 
          title: 'Original Title',
          content: 'Original Content',
          is_modified: 1,
        }),
        createTestDBArticle('status-conflict', { 
          is_archived: 0,
          is_favorite: 0,
          is_read: 0,
          is_modified: 1,
        }),
        createTestDBArticle('tags-conflict', { 
          is_modified: 1,
        }),
      ];

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: [contentConflictArticle, statusConflictArticle, tagsConflictArticle],
        page: 1,
        totalPages: 1,
        totalItems: 3,
      });

      mockDatabaseService.getArticle
        .mockResolvedValueOnce({ success: true, data: localArticles[0] })
        .mockResolvedValueOnce({ success: true, data: localArticles[1] })
        .mockResolvedValueOnce({ success: true, data: localArticles[2] });

      const result = await syncServiceInstance.startFullSync();

      expect(result.success).toBe(true);
      expect(result.conflictCount).toBe(3);

      // Verify different conflict types were handled
      const finalState = store.getState();
      expect(finalState.sync.conflicts.some(c => c.type === ConflictType.CONTENT_MODIFIED)).toBe(true);
      expect(finalState.sync.conflicts.some(c => c.type === ConflictType.STATUS_CHANGED)).toBe(true);
      expect(finalState.sync.conflicts.some(c => c.type === ConflictType.TAGS_UPDATED)).toBe(true);
    });
  });

  describe('Error Recovery and Network Failure Integration', () => {
    it('should handle partial sync failures gracefully', async () => {
      const articles = [
        createTestDBArticle('success-1', { is_modified: 1 }),
        createTestDBArticle('fail-1', { is_modified: 1 }),
        createTestDBArticle('success-2', { is_modified: 1 }),
      ];

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: articles, totalCount: 3, hasMore: false, limit: 50, offset: 0 },
      });

      // Simulate partial failures
      mockArticlesApiService.getArticle
        .mockResolvedValueOnce(createTestArticle('success-1'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(createTestArticle('success-2'));

      mockArticlesApiService.updateArticle
        .mockResolvedValueOnce(createTestArticle('success-1'))
        .mockResolvedValueOnce(createTestArticle('success-2'));

      const result = await syncServiceInstance.startFullSync();

      expect(result.success).toBe(true); // Should continue despite errors
      expect(result.syncedCount).toBe(2); // Two successful syncs
      expect(result.errorCount).toBe(1); // One failure
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Network timeout');
      expect(result.errors[0].retryable).toBe(false);
    });

    it('should distinguish retryable from non-retryable errors', async () => {
      const articles = [
        createTestDBArticle('network-error', { is_modified: 1 }),
        createTestDBArticle('auth-error', { is_modified: 1 }),
        createTestDBArticle('server-error', { is_modified: 1 }),
      ];

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: articles, totalCount: 3, hasMore: false, limit: 50, offset: 0 },
      });

      const networkError = new Error('Network request failed');
      (networkError as any).code = 'NETWORK_ERROR';

      const authError = new Error('Unauthorized');
      (authError as any).status = 401;

      const serverError = new Error('Internal Server Error');
      (serverError as any).status = 500;

      mockArticlesApiService.getArticle
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(authError)
        .mockRejectedValueOnce(serverError);

      const result = await syncServiceInstance.startFullSync();

      expect(result.errorCount).toBe(3);
      expect(result.errors.find(e => e.error.includes('Network request failed'))?.retryable).toBe(true);
      expect(result.errors.find(e => e.error.includes('Unauthorized'))?.retryable).toBe(false);
      expect(result.errors.find(e => e.error.includes('Internal Server Error'))?.retryable).toBe(true);
    });

    it('should handle database transaction failures', async () => {
      const articles = [createTestDBArticle('tx-fail', { is_modified: 1 })];

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: articles, totalCount: 1, hasMore: false, limit: 50, offset: 0 },
      });

      mockArticlesApiService.getArticle.mockResolvedValue(createTestArticle('tx-fail'));
      mockArticlesApiService.updateArticle.mockResolvedValue(createTestArticle('tx-fail'));

      // Simulate database update failure
      mockDatabaseService.updateArticle.mockResolvedValue({
        success: false,
        error: 'Database constraint violation',
      });

      const result = await syncServiceInstance.startFullSync();

      expect(result.success).toBe(true);
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].error).toContain('Database constraint violation');
    });

    it('should handle sync interruption and cleanup', async () => {
      // Mock long-running operation
      mockDatabaseService.getArticles.mockImplementation(
        () => new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
          }), 100)
        )
      );

      // Start sync and immediately stop it
      const syncPromise = syncServiceInstance.startFullSync();
      
      // Stop sync after a brief delay
      setTimeout(() => syncServiceInstance.stopSync(), 10);
      
      const result = await syncPromise;

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.error.includes('aborted'))).toBe(true);
      expect(syncServiceInstance.isRunning()).toBe(false);
    });

    it('should maintain data consistency during failures', async () => {
      const testArticle = createTestDBArticle('consistency-test', { is_modified: 1 });

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [testArticle], totalCount: 1, hasMore: false, limit: 50, offset: 0 },
      });

      // Simulate API success but database update failure
      mockArticlesApiService.getArticle.mockResolvedValue(createTestArticle('consistency-test'));
      mockArticlesApiService.updateArticle.mockResolvedValue(createTestArticle('consistency-test'));
      mockDatabaseService.updateArticle.mockResolvedValue({
        success: false,
        error: 'Database write failed',
      });

      const result = await syncServiceInstance.startFullSync();

      // Verify that partial success is tracked correctly
      expect(result.errorCount).toBe(1);
      expect(result.errors[0].operation).toContain('upload_article_consistency-test');

      // Verify Redux state reflects the error
      const finalState = store.getState();
      expect(finalState.sync.status).toBe(SyncStatus.ERROR);
    });
  });

  describe('Progress Tracking and Status Integration', () => {
    it('should track sync progress through all phases', async () => {
      const progressStates: any[] = [];
      const originalDispatch = store.dispatch;
      
      // Intercept dispatch calls to track progress
      store.dispatch = jest.fn((action) => {
        if (action.type?.includes('sync/syncProgress')) {
          progressStates.push(action.payload);
        }
        return originalDispatch(action);
      });

      const articles = [
        createTestDBArticle('progress-1', { is_modified: 1 }),
        createTestDBArticle('progress-2', { is_modified: 1 }),
      ];

      const remoteArticles = [
        createTestArticle('remote-progress-1'),
        createTestArticle('remote-progress-2'),
      ];

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: articles, totalCount: 2, hasMore: false, limit: 50, offset: 0 },
      });

      mockArticlesApiService.fetchArticles.mockResolvedValue({
        items: remoteArticles,
        page: 1,
        totalPages: 1,
        totalItems: 2,
      });

      mockArticlesApiService.getArticle.mockRejectedValue(new Error('Not found'));
      mockArticlesApiService.createArticle.mockResolvedValue(createTestArticle('created'));
      mockDatabaseService.getArticle.mockResolvedValue({ success: false, error: 'Not found' });

      await syncServiceInstance.startFullSync();

      // Verify all sync phases were tracked
      const phases = progressStates.map(p => p.phase);
      expect(phases).toContain(SyncPhase.UPLOADING_CHANGES);
      expect(phases).toContain(SyncPhase.DOWNLOADING_UPDATES);
      expect(phases).toContain(SyncPhase.FINALIZING);

      // Restore original dispatch
      store.dispatch = originalDispatch;
    });

    it('should provide accurate sync statistics', async () => {
      // Execute a sync with known results
      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
      });

      await syncServiceInstance.startFullSync();

      const stats = await syncServiceInstance.getSyncStats();

      expect(stats).toBeDefined();
      expect(typeof stats.totalSyncs).toBe('number');
      expect(typeof stats.successfulSyncs).toBe('number');
      expect(typeof stats.failedSyncs).toBe('number');

      // Verify stats are consistent with Redux state
      const state = store.getState();
      expect(stats).toEqual(state.sync.stats);
    });

    it('should maintain accurate running status', async () => {
      expect(syncServiceInstance.isRunning()).toBe(false);

      // Mock a delayed sync
      mockDatabaseService.getArticles.mockImplementation(
        () => new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
          }), 50)
        )
      );

      const syncPromise = syncServiceInstance.startFullSync();
      
      // Check status during sync
      expect(syncServiceInstance.isRunning()).toBe(true);
      
      await syncPromise;
      expect(syncServiceInstance.isRunning()).toBe(false);
    });
  });

  describe('Database Transaction Integrity', () => {
    it('should maintain transaction boundaries during batch operations', async () => {
      const batchArticles = Array.from({ length: 10 }, (_, i) => 
        createTestDBArticle(`batch-${i}`, { is_modified: 1 })
      );

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: batchArticles, totalCount: 10, hasMore: false, limit: 50, offset: 0 },
      });

      // Simulate some failures in the batch
      let callCount = 0;
      mockArticlesApiService.getArticle.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('Simulated API failure'));
        }
        return Promise.resolve(createTestArticle('test'));
      });

      mockArticlesApiService.updateArticle.mockResolvedValue(createTestArticle('updated'));

      const result = await syncServiceInstance.startFullSync();

      // Verify that successful operations are committed and failures are isolated
      expect(result.syncedCount).toBeGreaterThan(0);
      expect(result.errorCount).toBeGreaterThan(0);
      expect(result.syncedCount + result.errorCount).toBe(10);

      // Verify that database updates were called for successful operations only
      expect(mockDatabaseService.updateArticle).toHaveBeenCalledTimes(result.syncedCount);
    });

    it('should handle concurrent modification detection', async () => {
      const article = createTestDBArticle('concurrent-test', { 
        is_modified: 1,
        updated_at: Math.floor(new Date('2023-01-01T10:00:00Z').getTime() / 1000),
      });

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [article], totalCount: 1, hasMore: false, limit: 50, offset: 0 },
      });

      // Simulate the article being updated between read and write
      mockDatabaseService.updateArticle.mockResolvedValue({
        success: false,
        error: 'Concurrent modification detected',
      });

      mockArticlesApiService.getArticle.mockResolvedValue(createTestArticle('concurrent-test'));
      mockArticlesApiService.updateArticle.mockResolvedValue(createTestArticle('concurrent-test'));

      const result = await syncServiceInstance.startFullSync();

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].error).toContain('Concurrent modification detected');
    });
  });

  describe('Redux State Management Integration', () => {
    it('should properly integrate with Redux middleware and selectors', () => {
      const state = store.getState();
      
      // Verify initial state structure
      expect(state.sync).toBeDefined();
      expect(state.sync.status).toBe(SyncStatus.IDLE);
      expect(state.sync.config).toBeDefined();
      expect(state.sync.progress).toBeDefined();
      expect(state.sync.conflicts).toEqual([]);
      expect(state.sync.stats).toBeDefined();
    });

    it('should dispatch correct action sequence for successful sync', async () => {
      const dispatchedActions: any[] = [];
      const originalDispatch = store.dispatch;
      
      store.dispatch = jest.fn((action) => {
        dispatchedActions.push(action);
        return originalDispatch(action);
      });

      mockDatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
      });

      await syncServiceInstance.startFullSync();

      // Verify action sequence
      const actionTypes = dispatchedActions.map(a => a.type);
      expect(actionTypes).toContain('sync/startSync');
      expect(actionTypes).toContain('sync/syncSuccess');
      expect(actionTypes).toContain('sync/updateSyncStats');

      store.dispatch = originalDispatch;
    });

    it('should handle Redux state persistence during sync operations', async () => {
      // Start with known state
      const initialState = store.getState();
      expect(initialState.sync.status).toBe(SyncStatus.IDLE);

      mockDatabaseService.getArticles.mockImplementation(
        () => new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
          }), 20)
        )
      );

      const syncPromise = syncServiceInstance.startFullSync();

      // Verify state changes during sync
      await new Promise(resolve => setTimeout(resolve, 10));
      const midSyncState = store.getState();
      expect(midSyncState.sync.status).toBe(SyncStatus.SYNCING);

      await syncPromise;
      const finalState = store.getState();
      expect(finalState.sync.status).toBe(SyncStatus.SUCCESS);
    });
  });
});