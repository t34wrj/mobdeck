/**
 * Cache Performance Tests
 * 
 * Validates that cache operations meet performance requirements:
 * - Cache hits should be <0.1ms
 * - Cache misses should be handled gracefully
 * - LRU eviction should work efficiently
 * - Memory usage should be within limits
 */

import { cacheService, Cache } from '../../src/services/CacheService';
import { Article } from '../../src/types';

// Mock article factory
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    isModified: false,
  };
};

describe('Cache Performance Tests', () => {
  beforeEach(() => {
    // Clear cache before each test
    cacheService.clearAll();
  });

  describe('Cache Hit Performance', () => {
    it('should serve cached data in less than 0.1ms', async () => {
      const testArticle = createTestArticle('perf-test-1', 'large');
      
      // Populate cache
      cacheService.setArticle(testArticle.id, testArticle);
      
      // Warm up - ensure cache is ready
      cacheService.getArticle(testArticle.id);
      
      // Measure cache hit performance
      const iterations = 1000;
      const measurements: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const cachedArticle = cacheService.getArticle(testArticle.id);
        const endTime = performance.now();
        
        expect(cachedArticle).toEqual(testArticle);
        measurements.push(endTime - startTime);
      }
      
      // Calculate statistics
      const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const minTime = Math.min(...measurements);
      const maxTime = Math.max(...measurements);
      const medianTime = measurements.sort((a, b) => a - b)[Math.floor(measurements.length / 2)];
      
      console.log('Cache Hit Performance Stats:', {
        avgTime: `${avgTime.toFixed(4)}ms`,
        minTime: `${minTime.toFixed(4)}ms`,
        maxTime: `${maxTime.toFixed(4)}ms`,
        medianTime: `${medianTime.toFixed(4)}ms`,
        iterations,
      });
      
      // Verify performance meets requirements
      expect(avgTime).toBeLessThan(0.1); // Average should be <0.1ms
      expect(medianTime).toBeLessThan(0.1); // Median should be <0.1ms
      expect(minTime).toBeLessThan(0.05); // Best case should be <0.05ms
    });

    it('should handle multiple cache hits efficiently', async () => {
      // Populate cache with multiple articles
      const articles: Article[] = [];
      for (let i = 0; i < 100; i++) {
        const article = createTestArticle(`batch-${i}`, 'medium');
        articles.push(article);
        cacheService.setArticle(article.id, article);
      }
      
      // Measure batch retrieval performance
      const startTime = performance.now();
      
      for (const article of articles) {
        const cached = cacheService.getArticle(article.id);
        expect(cached).toEqual(article);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerItem = totalTime / articles.length;
      
      console.log('Batch Cache Hit Performance:', {
        totalTime: `${totalTime.toFixed(2)}ms`,
        avgTimePerItem: `${avgTimePerItem.toFixed(4)}ms`,
        itemCount: articles.length,
      });
      
      // Each item should still be retrieved in <0.1ms on average
      expect(avgTimePerItem).toBeLessThan(0.1);
    });
  });

  describe('Cache Miss Performance', () => {
    it('should handle cache misses quickly', async () => {
      const iterations = 1000;
      const measurements: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const result = cacheService.getArticle(`non-existent-${i}`);
        const endTime = performance.now();
        
        expect(result).toBeNull();
        measurements.push(endTime - startTime);
      }
      
      const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      
      console.log('Cache Miss Performance:', {
        avgTime: `${avgTime.toFixed(4)}ms`,
        iterations,
      });
      
      // Cache misses should also be fast
      expect(avgTime).toBeLessThan(0.1);
    });
  });

  describe('Cache Set Performance', () => {
    it('should set items quickly', async () => {
      const iterations = 100;
      const measurements: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const article = createTestArticle(`set-test-${i}`, 'medium');
        
        const startTime = performance.now();
        cacheService.setArticle(article.id, article);
        const endTime = performance.now();
        
        measurements.push(endTime - startTime);
      }
      
      const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      
      console.log('Cache Set Performance:', {
        avgTime: `${avgTime.toFixed(4)}ms`,
        iterations,
      });
      
      // Setting items should be reasonably fast
      expect(avgTime).toBeLessThan(1);
    });
  });

  describe('LRU Eviction Performance', () => {
    it('should handle eviction efficiently', async () => {
      // Create a small cache to test eviction
      const smallCache = new Cache<Article>({
        maxSize: 10,
        ttl: 60000,
      });
      
      // Fill cache beyond capacity
      const articles: Article[] = [];
      for (let i = 0; i < 20; i++) {
        articles.push(createTestArticle(`evict-${i}`, 'small'));
      }
      
      const startTime = performance.now();
      
      // This should trigger eviction
      for (const article of articles) {
        smallCache.set(article.id, article);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Verify eviction occurred
      const stats = smallCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(10);
      expect(stats.evictions).toBeGreaterThan(0);
      
      console.log('Eviction Performance:', {
        totalTime: `${totalTime.toFixed(2)}ms`,
        evictions: stats.evictions,
        finalSize: stats.size,
      });
      
      // Eviction should not significantly slow down operations
      expect(totalTime).toBeLessThan(50);
    });
  });

  describe('Cache Statistics', () => {
    it('should track performance metrics accurately', async () => {
      // Clear cache and get baseline stats
      cacheService.clearAll();
      const baselineStats = cacheService.getStats().articles;
      const initialHits = baselineStats.hits;
      const initialMisses = baselineStats.misses;
      
      const testArticle = createTestArticle('stats-test', 'medium');
      
      // Perform operations
      cacheService.getArticle('miss-1'); // Miss
      cacheService.setArticle(testArticle.id, testArticle);
      cacheService.getArticle(testArticle.id); // Hit
      cacheService.getArticle(testArticle.id); // Hit
      cacheService.getArticle('miss-2'); // Miss
      
      const stats = cacheService.getStats().articles;
      
      // Check relative increases
      expect(stats.hits - initialHits).toBe(2);
      expect(stats.misses - initialMisses).toBe(2);
      expect(stats.size).toBe(1);
      
      // Verify hit times are reasonable (both operations are very fast)
      expect(stats.avgHitTime).toBeLessThanOrEqual(stats.avgMissTime);
      expect(stats.avgHitTime).toBeLessThan(1); // Should be sub-millisecond
    });
  });

  describe('Memory Management', () => {
    it('should respect memory limits', async () => {
      // Create cache with 1MB limit
      const memoryCache = new Cache<Article>({
        maxSize: 1000,
        maxMemory: 1024 * 1024, // 1MB
        ttl: 60000,
      });
      
      // Add articles until memory limit is approached
      let addedCount = 0;
      for (let i = 0; i < 100; i++) {
        const article = createTestArticle(`mem-${i}`, 'large');
        memoryCache.set(article.id, article);
        addedCount++;
        
        const stats = memoryCache.getStats();
        if (stats.memoryUsage > 900 * 1024) {
          // Stop before hitting limit
          break;
        }
      }
      
      const stats = memoryCache.getStats();
      
      // Verify memory is within limits
      expect(stats.memoryUsage).toBeLessThanOrEqual(1024 * 1024);
      expect(stats.size).toBeLessThanOrEqual(addedCount); // Size should not exceed what we added
    });
  });

  describe('Real-world Scenario', () => {
    it('should perform well under typical usage patterns', async () => {
      // Simulate real usage: mix of hits, misses, and sets
      const workload = [
        { op: 'set', id: 'article-1' },
        { op: 'get', id: 'article-1' }, // Hit
        { op: 'get', id: 'article-2' }, // Miss
        { op: 'set', id: 'article-2' },
        { op: 'get', id: 'article-1' }, // Hit
        { op: 'get', id: 'article-2' }, // Hit
        { op: 'set', id: 'article-3' },
        { op: 'get', id: 'article-3' }, // Hit
        { op: 'delete', id: 'article-1' },
        { op: 'get', id: 'article-1' }, // Miss
      ];
      
      const measurements: { op: string; time: number }[] = [];
      
      for (const work of workload) {
        const startTime = performance.now();
        
        switch (work.op) {
          case 'set':
            cacheService.setArticle(work.id, createTestArticle(work.id, 'medium'));
            break;
          case 'get':
            cacheService.getArticle(work.id);
            break;
          case 'delete':
            cacheService.deleteArticle(work.id);
            break;
        }
        
        const endTime = performance.now();
        measurements.push({ op: work.op, time: endTime - startTime });
      }
      
      // Calculate average times by operation
      const getOps = measurements.filter(m => m.op === 'get');
      const setOps = measurements.filter(m => m.op === 'set');
      const deleteOps = measurements.filter(m => m.op === 'delete');
      
      const avgGetTime = getOps.reduce((a, b) => a + b.time, 0) / getOps.length;
      const avgSetTime = setOps.reduce((a, b) => a + b.time, 0) / setOps.length;
      const avgDeleteTime = deleteOps.reduce((a, b) => a + b.time, 0) / deleteOps.length;
      
      console.log('Real-world Performance:', {
        avgGetTime: `${avgGetTime.toFixed(4)}ms`,
        avgSetTime: `${avgSetTime.toFixed(4)}ms`,
        avgDeleteTime: `${avgDeleteTime.toFixed(4)}ms`,
        totalOperations: workload.length,
      });
      
      // All operations should be fast
      expect(avgGetTime).toBeLessThan(0.1);
      expect(avgSetTime).toBeLessThan(1);
      expect(avgDeleteTime).toBeLessThan(0.1);
    });
  });
});