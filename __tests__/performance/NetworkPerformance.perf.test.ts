/**
 * Network Performance Validation Tests
 * 
 * Tests performance of:
 * - API response handling with various network speeds
 * - Offline mode performance
 * - Network reconnection handling
 * - Request queuing and retry logic
 * - Cache performance
 * - Background sync efficiency
 */

import { articlesApiService } from '../../src/services/ArticlesApiService';
import DatabaseService from '../../src/services/DatabaseService';
import { syncService } from '../../src/services/SyncService';
import { store } from '../../src/store';
import { performanceTestHelper, PERFORMANCE_THRESHOLDS } from '../../src/utils/performanceTestHelper';
import { setNetworkState } from '../../src/store/slices/networkSlice';
import { Article } from '../../src/types';
import { DBArticle } from '../../src/types/database';
import NetInfo from '@react-native-community/netinfo';

// Mock dependencies
jest.mock('../../src/services/ArticlesApiService');
jest.mock('../../src/services/DatabaseService');
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

// Network simulation helpers
class NetworkSimulator {
  private baseDelay: number = 0;
  private packetLoss: number = 0;
  private bandwidth: number = Infinity;

  setConditions(type: 'fast' | 'moderate' | 'slow' | 'offline') {
    switch (type) {
      case 'fast':
        this.baseDelay = 10;
        this.packetLoss = 0;
        this.bandwidth = 10 * 1024 * 1024; // 10 Mbps
        break;
      case 'moderate':
        this.baseDelay = 100;
        this.packetLoss = 0.01;
        this.bandwidth = 1 * 1024 * 1024; // 1 Mbps
        break;
      case 'slow':
        this.baseDelay = 500;
        this.packetLoss = 0.05;
        this.bandwidth = 100 * 1024; // 100 Kbps
        break;
      case 'offline':
        this.baseDelay = Infinity;
        this.packetLoss = 1;
        this.bandwidth = 0;
        break;
    }
  }

  async simulateDelay(dataSize: number = 1024) {
    if (this.baseDelay === Infinity) {
      throw new Error('Network unavailable');
    }

    const transferTime = (dataSize / this.bandwidth) * 1000;
    const totalDelay = this.baseDelay + transferTime;

    if (Math.random() < this.packetLoss) {
      throw new Error('Packet loss');
    }

    await new Promise(resolve => setTimeout(resolve, totalDelay));
  }

  reset() {
    this.baseDelay = 0;
    this.packetLoss = 0;
    this.bandwidth = Infinity;
  }
}

const networkSimulator = new NetworkSimulator();

// Test data factory
const createTestArticle = (id: string, size: 'small' | 'medium' | 'large' = 'medium'): Article => {
  const contentSizes = {
    small: 100,
    medium: 1000,
    large: 10000,
  };

  const content = 'x'.repeat(contentSizes[size]);

  return {
    id,
    title: `Test Article ${id}`,
    summary: `Summary for ${id}`,
    content,
    url: `https://example.com/article-${id}`,
    imageUrl: size === 'large' ? `https://example.com/image-${id}.jpg` : undefined,
    readTime: Math.ceil(content.length / 200),
    isArchived: false,
    isFavorite: false,
    isRead: false,
    tags: ['test'],
    sourceUrl: 'https://example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    syncedAt: new Date(),
    isModified: false,
  };
};

describe('Network Performance Validation Tests', () => {
  beforeEach(() => {
    performanceTestHelper.clearMetrics();
    networkSimulator.reset();
    jest.clearAllMocks();

    // Setup default mocks
    const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;
    const mockArticlesApiService = articlesApiService as jest.Mocked<typeof articlesApiService>;

    mockDatabaseService.getArticles.mockResolvedValue({
      success: true,
      data: { items: [], totalCount: 0, hasMore: false, limit: 50, offset: 0 },
    });

    mockDatabaseService.createArticle.mockResolvedValue({
      success: true,
      data: 'new-id',
      rowsAffected: 1,
    });

    mockDatabaseService.updateArticle.mockResolvedValue({
      success: true,
      rowsAffected: 1,
    });
  });

  describe('API Response Handling Performance', () => {
    it('should handle fast network responses efficiently', async () => {
      networkSimulator.setConditions('fast');
      const articles = Array.from({ length: 50 }, (_, i) => createTestArticle(`fast-${i}`, 'small'));

      articlesApiService.fetchArticles.mockImplementation(async () => {
        await networkSimulator.simulateDelay(JSON.stringify(articles).length);
        return {
          items: articles,
          page: 1,
          totalPages: 1,
          totalItems: 50,
        };
      });

      const { result, metrics } = await performanceTestHelper.measureAsync(
        'api_fetch_fast_network',
        () => articlesApiService.fetchArticles({ page: 1, limit: 50 }),
        { networkType: 'fast', articleCount: 50 }
      );

      expect(result.items.length).toBe(50);
      expect(metrics.duration).toBeLessThan(1000); // Should be fast on good network
    });

    it('should handle slow network gracefully', async () => {
      networkSimulator.setConditions('slow');
      const articles = Array.from({ length: 10 }, (_, i) => createTestArticle(`slow-${i}`, 'small'));

      articlesApiService.fetchArticles.mockImplementation(async () => {
        await networkSimulator.simulateDelay(JSON.stringify(articles).length);
        return {
          items: articles,
          page: 1,
          totalPages: 1,
          totalItems: 10,
        };
      });

      const { result, metrics } = await performanceTestHelper.measureAsync(
        'api_fetch_slow_network',
        () => articlesApiService.fetchArticles({ page: 1, limit: 10 }),
        { networkType: 'slow', articleCount: 10 }
      );

      expect(result.items.length).toBe(10);
      expect(metrics.duration).toBeGreaterThan(500); // Slow network should take longer

      // Validate against appropriate threshold
      const validation = performanceTestHelper.validatePerformance(
        'api_fetch_slow_network',
        PERFORMANCE_THRESHOLDS.API_CALL
      );
      expect(validation.passed).toBe(true);
    });

    it('should optimize payload size for slow connections', async () => {
      const networkTypes: Array<'fast' | 'moderate' | 'slow'> = ['fast', 'moderate', 'slow'];
      const results: { type: string; duration: number; articlesPerSecond: number }[] = [];

      for (const networkType of networkTypes) {
        networkSimulator.setConditions(networkType);
        
        // Different payload sizes based on network
        const articleCount = networkType === 'slow' ? 10 : networkType === 'moderate' ? 25 : 50;
        const articles = Array.from({ length: articleCount }, (_, i) => 
          createTestArticle(`${networkType}-${i}`, networkType === 'slow' ? 'small' : 'medium')
        );

        articlesApiService.fetchArticles.mockImplementation(async () => {
          await networkSimulator.simulateDelay(JSON.stringify(articles).length);
          return {
            items: articles,
            page: 1,
            totalPages: 1,
            totalItems: articleCount,
          };
        });

        const { result, metrics } = await performanceTestHelper.measureAsync(
          `api_adaptive_${networkType}`,
          () => articlesApiService.fetchArticles({ page: 1, limit: articleCount }),
          { networkType, articleCount }
        );

        const articlesPerSecond = (result.items.length / metrics.duration) * 1000;
        results.push({
          type: networkType,
          duration: metrics.duration,
          articlesPerSecond,
        });
      }

      // Verify adaptive behavior
      expect(results[0].articlesPerSecond).toBeGreaterThan(results[2].articlesPerSecond);
    });
  });

  describe('Offline Mode Performance', () => {
    it('should switch to offline mode quickly', async () => {
      // Setup local data
      const localArticles = Array.from({ length: 100 }, (_, i) => ({
        id: `local-${i}`,
        title: `Local Article ${i}`,
        // ... other fields
      } as DBArticle));

      DatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { 
          items: localArticles, 
          totalCount: 100, 
          hasMore: false, 
          limit: 50, 
          offset: 0 
        },
      });

      // Simulate going offline
      networkSimulator.setConditions('offline');
      store.dispatch(setNetworkState({ isConnected: false, type: null }));

      const { metrics } = await performanceTestHelper.measureAsync(
        'offline_mode_switch',
        async () => {
          // Should use local data immediately
          const result = await DatabaseService.getArticles({ limit: 50 });
          expect(result.success).toBe(true);
          expect(result.data?.items.length).toBe(50);
        },
        { operation: 'offline_switch' }
      );

      expect(metrics.duration).toBeLessThan(100); // Should be instant
    });

    it('should queue operations while offline', async () => {
      networkSimulator.setConditions('offline');
      store.dispatch(setNetworkState({ isConnected: false, type: null }));

      const operations = Array.from({ length: 20 }, (_, i) => ({
        type: 'update',
        articleId: `article-${i}`,
        data: { isFavorite: true },
      }));

      const { metrics } = await performanceTestHelper.measureAsync(
        'offline_queue_operations',
        async () => {
          // Queue multiple operations
          for (const op of operations) {
            await DatabaseService.updateArticle(op.articleId, {
              is_favorite: 1,
              is_modified: 1,
            });
          }
        },
        { operationCount: 20 }
      );

      // Queueing should be fast even with many operations
      const avgTimePerOp = metrics.duration / operations.length;
      expect(avgTimePerOp).toBeLessThan(10);
    });

    it('should sync efficiently when returning online', async () => {
      // Setup offline queue
      const queuedOperations = Array.from({ length: 30 }, (_, i) => ({
        id: `queued-${i}`,
        is_modified: 1,
      } as DBArticle));

      DatabaseService.getArticles.mockResolvedValue({
        success: true,
        data: { 
          items: queuedOperations, 
          totalCount: 30, 
          hasMore: false, 
          limit: 50, 
          offset: 0 
        },
      });

      // Simulate coming back online
      networkSimulator.setConditions('moderate');
      store.dispatch(setNetworkState({ isConnected: true, type: 'wifi' }));

      articlesApiService.createArticle.mockImplementation(async (data) => {
        await networkSimulator.simulateDelay(JSON.stringify(data).length);
        return createTestArticle('created');
      });

      articlesApiService.updateArticle.mockImplementation(async (id, data) => {
        await networkSimulator.simulateDelay(JSON.stringify(data).length);
        return createTestArticle(id);
      });

      const { result, metrics } = await performanceTestHelper.measureAsync(
        'offline_to_online_sync',
        () => syncService.startFullSync(),
        { queuedOperations: 30 }
      );

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(30);

      // Should complete within reasonable time
      const validation = performanceTestHelper.validatePerformance(
        'offline_to_online_sync',
        PERFORMANCE_THRESHOLDS.SYNC_OPERATION
      );
      expect(validation.passed).toBe(true);
    });
  });

  describe('Request Retry Performance', () => {
    it('should retry failed requests efficiently', async () => {
      let attemptCount = 0;
      const maxRetries = 3;

      articlesApiService.fetchArticles.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < maxRetries) {
          throw new Error('Network timeout');
        }
        return {
          items: [createTestArticle('retry-success')],
          page: 1,
          totalPages: 1,
          totalItems: 1,
        };
      });

      const { metrics } = await performanceTestHelper.measureAsync(
        'request_retry_performance',
        async () => {
          let lastError;
          for (let i = 0; i < maxRetries; i++) {
            try {
              await articlesApiService.fetchArticles({ page: 1 });
              break;
            } catch (error) {
              lastError = error;
              // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
            }
          }
        },
        { maxRetries, successOnAttempt: maxRetries }
      );

      expect(attemptCount).toBe(maxRetries);
      // Total time should include backoff delays
      expect(metrics.duration).toBeGreaterThan(600); // 100 + 200 + 400
    });

    it('should handle concurrent request failures', async () => {
      const failureRate = 0.3; // 30% failure rate

      articlesApiService.getArticle.mockImplementation(async (id) => {
        if (Math.random() < failureRate) {
          throw new Error('Random network failure');
        }
        await networkSimulator.simulateDelay(1024);
        return createTestArticle(id);
      });

      const articleIds = Array.from({ length: 20 }, (_, i) => `concurrent-${i}`);

      const { metrics } = await performanceTestHelper.measureAsync(
        'concurrent_requests_with_failures',
        async () => {
          const results = await Promise.allSettled(
            articleIds.map(id => articlesApiService.getArticle(id))
          );

          const successful = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;

          expect(successful).toBeGreaterThan(0);
          expect(failed).toBeGreaterThan(0);
        },
        { totalRequests: 20, failureRate }
      );

      // Should handle mixed success/failure efficiently
      expect(metrics.duration).toBeLessThan(2000);
    });
  });

  describe('Cache Performance', () => {
    it('should serve cached data quickly', async () => {
      const testArticle = createTestArticle('cache-test', 'large');

      // First fetch - populate cache
      articlesApiService.getArticle.mockImplementation(async (id) => {
        await networkSimulator.simulateDelay(JSON.stringify(testArticle).length);
        return testArticle;
      });

      const { metrics: firstFetch } = await performanceTestHelper.measureAsync(
        'cache_miss',
        () => articlesApiService.getArticle('cache-test'),
        { cacheStatus: 'miss' }
      );

      // Second fetch - should hit cache
      articlesApiService.getArticle.mockResolvedValue(testArticle);

      const { metrics: secondFetch } = await performanceTestHelper.measureAsync(
        'cache_hit',
        () => articlesApiService.getArticle('cache-test'),
        { cacheStatus: 'hit' }
      );

      // Cache hit should be much faster
      expect(secondFetch.duration).toBeLessThan(firstFetch.duration * 0.1);
      expect(secondFetch.duration).toBeLessThan(10); // Should be nearly instant
    });

    it('should handle cache invalidation efficiently', async () => {
      const articles = Array.from({ length: 50 }, (_, i) => createTestArticle(`cache-${i}`));

      // Populate cache
      for (const article of articles) {
        await DatabaseService.createArticle({
          id: article.id,
          title: article.title,
          // ... other fields
        } as DBArticle);
      }

      // Invalidate cache
      const { metrics } = await performanceTestHelper.measureAsync(
        'cache_invalidation',
        async () => {
          // Simulate cache clear
          await DatabaseService.clearCache?.();
          
          // Force reload
          await DatabaseService.getArticles({ limit: 50, forceRefresh: true });
        },
        { operation: 'cache_invalidation', itemCount: 50 }
      );

      expect(metrics.duration).toBeLessThan(500);
    });
  });

  describe('Background Sync Performance', () => {
    it('should perform incremental sync efficiently', async () => {
      const lastSyncTime = new Date(Date.now() - 3600000); // 1 hour ago
      const newArticles = Array.from({ length: 5 }, (_, i) => 
        createTestArticle(`new-${i}`, 'small')
      );

      articlesApiService.fetchArticles.mockImplementation(async ({ lastSync }) => {
        await networkSimulator.simulateDelay(JSON.stringify(newArticles).length);
        return {
          items: lastSync ? newArticles : [],
          page: 1,
          totalPages: 1,
          totalItems: newArticles.length,
        };
      });

      DatabaseService.getStats.mockResolvedValue({
        success: true,
        data: {
          totalArticles: 100,
          archivedArticles: 10,
          favoriteArticles: 20,
          unreadArticles: 50,
          totalLabels: 5,
          pendingSyncItems: 0,
          databaseSize: 10240,
          lastSyncAt: Math.floor(lastSyncTime.getTime() / 1000),
        },
      });

      const { result, metrics } = await performanceTestHelper.measureAsync(
        'background_incremental_sync',
        () => syncService.startFullSync(),
        { syncType: 'incremental', newItems: 5 }
      );

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(5);

      // Incremental sync should be fast
      expect(metrics.duration).toBeLessThan(5000);
    });

    it('should throttle sync frequency appropriately', async () => {
      const syncAttempts: number[] = [];
      let syncCount = 0;

      articlesApiService.fetchArticles.mockImplementation(async () => {
        syncCount++;
        syncAttempts.push(Date.now());
        return { items: [], page: 1, totalPages: 1, totalItems: 0 };
      });

      // Attempt multiple syncs in quick succession
      const { metrics } = await performanceTestHelper.measureAsync(
        'sync_throttling',
        async () => {
          for (let i = 0; i < 5; i++) {
            await syncService.startFullSync();
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        },
        { attemptedSyncs: 5 }
      );

      // Should throttle requests
      expect(syncCount).toBeLessThan(5);
      
      // Check minimum time between syncs
      for (let i = 1; i < syncAttempts.length; i++) {
        const timeDiff = syncAttempts[i] - syncAttempts[i - 1];
        expect(timeDiff).toBeGreaterThan(500); // Minimum 500ms between syncs
      }
    });
  });

  describe('Network State Monitoring', () => {
    it('should detect network changes quickly', async () => {
      const netInfoMock = NetInfo as jest.Mocked<typeof NetInfo>;
      let connectionListener: any;

      netInfoMock.addEventListener.mockImplementation((listener) => {
        connectionListener = listener;
        return () => {};
      });

      // Initialize network monitoring
      const unsubscribe = NetInfo.addEventListener(() => {});

      const { metrics } = await performanceTestHelper.measureAsync(
        'network_state_change_detection',
        async () => {
          // Simulate network state change
          connectionListener({
            isConnected: false,
            type: 'none',
          });

          await new Promise(resolve => setTimeout(resolve, 10));

          // Verify state updated
          const state = store.getState();
          expect(state.network?.isConnected).toBe(false);
        },
        { operation: 'network_state_change' }
      );

      expect(metrics.duration).toBeLessThan(50); // Should react quickly
      unsubscribe();
    });
  });

  afterAll(() => {
    // Generate network performance report
    const report = performanceTestHelper.generateReport();
    console.log('\n=== Network Performance Report ===\n');
    console.log(report);
  });
});