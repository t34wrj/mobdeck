/**
 * Sync Test Helper
 * Provides utilities for testing sync operations in E2E article management tests
 */

import { Article } from '../../../src/types';
import { ArticleTestDataFactory } from './ArticleTestDataFactory';

export interface SyncTestScenario {
  name: string;
  localArticles: Article[];
  remoteArticles: Article[];
  expectedResult: {
    articlesToAdd: Article[];
    articlesToUpdate: Article[];
    articlesToDelete: string[];
    conflicts: Array<{
      localArticle: Article;
      remoteArticle: Article;
      resolution: 'local' | 'remote' | 'merge';
    }>;
  };
}

export interface MockSyncServiceOptions {
  delay?: number;
  shouldFail?: boolean;
  failureReason?: string;
  conflictResolution?: 'local-wins' | 'remote-wins' | 'merge';
}

/**
 * Helper class for testing sync operations and conflict resolution
 */
export class SyncTestHelper {
  private static mockSyncDelay = 500;
  private static mockSyncFailures: string[] = [];
  private static syncOperations: Array<{
    type: 'fetch' | 'push' | 'sync';
    timestamp: string;
    success: boolean;
    articlesCount?: number;
  }> = [];

  /**
   * Creates a mock sync service for testing
   */
  static createMockSyncService(options: MockSyncServiceOptions = {}) {
    return {
      syncArticles: jest.fn().mockImplementation(async (params: any) => {
        await this.delay(options.delay || this.mockSyncDelay);

        if (options.shouldFail) {
          const error = new Error(options.failureReason || 'Sync failed');
          this.recordSyncOperation('sync', false);
          throw error;
        }

        this.recordSyncOperation('sync', true, params.articlesCount);

        return {
          success: true,
          articlesAdded: params.articlesCount || 0,
          articlesUpdated: 0,
          articlesDeleted: 0,
          conflicts: [],
        };
      }),

      fetchArticles: jest.fn().mockImplementation(async (params: any) => {
        await this.delay(options.delay || this.mockSyncDelay);

        if (options.shouldFail) {
          const error = new Error(options.failureReason || 'Fetch failed');
          this.recordSyncOperation('fetch', false);
          throw error;
        }

        this.recordSyncOperation('fetch', true);

        return {
          articles: ArticleTestDataFactory.createArticleList(
            params.limit || 10
          ),
          hasMore: false,
          nextCursor: null,
        };
      }),

      pushLocalChanges: jest.fn().mockImplementation(async () => {
        await this.delay(options.delay || this.mockSyncDelay);

        if (options.shouldFail) {
          const error = new Error(options.failureReason || 'Push failed');
          this.recordSyncOperation('push', false);
          throw error;
        }

        this.recordSyncOperation('push', true);

        return {
          success: true,
          pushedChanges: 0,
        };
      }),

      getConflicts: jest.fn().mockReturnValue([]),
      resolveConflict: jest.fn().mockResolvedValue(true),
      getSyncStatus: jest.fn().mockReturnValue({
        isActive: false,
        lastSync: new Date().toISOString(),
        nextSync: null,
      }),
    };
  }

  /**
   * Creates common sync test scenarios
   */
  static createSyncScenarios(): SyncTestScenario[] {
    return [
      {
        name: 'No conflicts - simple sync',
        localArticles: ArticleTestDataFactory.createArticleList(3),
        remoteArticles: ArticleTestDataFactory.createArticleList(3, {
          id: 'remote-article',
        }),
        expectedResult: {
          articlesToAdd: ArticleTestDataFactory.createArticleList(3, {
            id: 'remote-article',
          }),
          articlesToUpdate: [],
          articlesToDelete: [],
          conflicts: [],
        },
      },
      {
        name: 'Update conflicts - same article modified locally and remotely',
        localArticles: [
          ArticleTestDataFactory.createArticle({
            id: 'conflict-article-1',
            title: 'Local Title',
            isRead: true,
            updatedAt: '2023-01-02T00:00:00Z',
          }),
        ],
        remoteArticles: [
          ArticleTestDataFactory.createArticle({
            id: 'conflict-article-1',
            title: 'Remote Title',
            isFavorite: true,
            updatedAt: '2023-01-03T00:00:00Z',
          }),
        ],
        expectedResult: {
          articlesToAdd: [],
          articlesToUpdate: [],
          articlesToDelete: [],
          conflicts: [
            {
              localArticle: ArticleTestDataFactory.createArticle({
                id: 'conflict-article-1',
                title: 'Local Title',
                isRead: true,
              }),
              remoteArticle: ArticleTestDataFactory.createArticle({
                id: 'conflict-article-1',
                title: 'Remote Title',
                isFavorite: true,
              }),
              resolution: 'merge',
            },
          ],
        },
      },
      {
        name: 'Deletion conflicts - article deleted locally but updated remotely',
        localArticles: [],
        remoteArticles: [
          ArticleTestDataFactory.createArticle({
            id: 'deleted-locally',
            title: 'Updated Remotely',
            updatedAt: '2023-01-03T00:00:00Z',
          }),
        ],
        expectedResult: {
          articlesToAdd: [],
          articlesToUpdate: [],
          articlesToDelete: [],
          conflicts: [
            {
              localArticle: ArticleTestDataFactory.createArticle({
                id: 'deleted-locally',
              }),
              remoteArticle: ArticleTestDataFactory.createArticle({
                id: 'deleted-locally',
                title: 'Updated Remotely',
              }),
              resolution: 'remote',
            },
          ],
        },
      },
    ];
  }

  /**
   * Simulates network conditions for sync testing
   */
  static simulateNetworkConditions(
    condition: 'offline' | 'slow' | 'unstable' | 'normal'
  ) {
    const conditions = {
      offline: {
        delay: 0,
        shouldFail: true,
        failureReason: 'Network unavailable',
      },
      slow: { delay: 5000, shouldFail: false },
      unstable: {
        delay: 2000,
        shouldFail: Math.random() < 0.3,
        failureReason: 'Connection timeout',
      },
      normal: { delay: 500, shouldFail: false },
    };

    return conditions[condition];
  }

  /**
   * Creates mock conflict resolution scenarios
   */
  static createConflictScenarios() {
    const baseArticle = ArticleTestDataFactory.createArticle({
      id: 'conflict-test',
      title: 'Original Title',
      isRead: false,
      isFavorite: false,
    });

    return [
      {
        name: 'Local wins - user prefers local changes',
        local: { ...baseArticle, title: 'Local Title', isRead: true },
        remote: { ...baseArticle, title: 'Remote Title', isFavorite: true },
        resolution: 'local' as const,
        expected: { ...baseArticle, title: 'Local Title', isRead: true },
      },
      {
        name: 'Remote wins - server has newer data',
        local: { ...baseArticle, title: 'Local Title', isRead: true },
        remote: { ...baseArticle, title: 'Remote Title', isFavorite: true },
        resolution: 'remote' as const,
        expected: { ...baseArticle, title: 'Remote Title', isFavorite: true },
      },
      {
        name: 'Merge - combine non-conflicting changes',
        local: { ...baseArticle, isRead: true, tags: ['local-tag'] },
        remote: { ...baseArticle, isFavorite: true, tags: ['remote-tag'] },
        resolution: 'merge' as const,
        expected: {
          ...baseArticle,
          isRead: true,
          isFavorite: true,
          tags: ['local-tag', 'remote-tag'],
        },
      },
    ];
  }

  /**
   * Waits for sync operations to complete
   */
  static async waitForSync(timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.syncOperations.length > 0) {
        const lastOperation =
          this.syncOperations[this.syncOperations.length - 1];
        if (lastOperation.type === 'sync') {
          return lastOperation.success;
        }
      }

      await this.delay(100);
    }

    throw new Error('Sync operation timeout');
  }

  /**
   * Gets sync operation history for testing
   */
  static getSyncHistory() {
    return [...this.syncOperations];
  }

  /**
   * Records a sync operation for tracking
   */
  private static recordSyncOperation(
    type: 'fetch' | 'push' | 'sync',
    success: boolean,
    articlesCount?: number
  ) {
    this.syncOperations.push({
      type,
      timestamp: new Date().toISOString(),
      success,
      articlesCount,
    });
  }

  /**
   * Clears sync operation history
   */
  static clearSyncHistory(): void {
    this.syncOperations = [];
  }

  /**
   * Sets custom sync delay for testing
   */
  static setSyncDelay(delay: number): void {
    this.mockSyncDelay = delay;
  }

  /**
   * Utility delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Creates a mock for the sync slice actions
   */
  static createMockSyncActions() {
    return {
      syncArticles: jest.fn(),
      fetchArticles: jest.fn(),
      pushLocalChanges: jest.fn(),
      setSyncStatus: jest.fn(),
      addSyncError: jest.fn(),
      clearSyncErrors: jest.fn(),
      setLastSync: jest.fn(),
    };
  }

  /**
   * Resets all sync test state
   */
  static reset(): void {
    this.clearSyncHistory();
    this.mockSyncDelay = 500;
    this.mockSyncFailures = [];
  }
}

export default SyncTestHelper;
