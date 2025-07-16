/**
 * Simple Cache Service for Mobile App
 * Basic in-memory caching with TTL support
 */

import { Article, DBLabel } from '../types';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface SimpleCache<T> {
  get(key: string): T | null;
  set(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
}

class SimpleCacheImpl<T> implements SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTtl: number;

  constructor(defaultTtlMs = 5 * 60 * 1000) {
    // 5 minutes default
    this.defaultTtl = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, value: T, ttlMs = this.defaultTtl): void {
    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Simple cache instances
const articleCache = new SimpleCacheImpl<Article>(10 * 60 * 1000); // 10 minutes
const labelCache = new SimpleCacheImpl<DBLabel>(30 * 60 * 1000); // 30 minutes
const genericCache = new SimpleCacheImpl<any>(5 * 60 * 1000); // 5 minutes

export const cacheService = {
  // Article cache
  getArticle: (id: string) => articleCache.get(id),
  setArticle: (id: string, article: Article, ttl?: number) =>
    articleCache.set(id, article, ttl),
  deleteArticle: (id: string) => articleCache.delete(id),
  clearArticles: () => articleCache.clear(),

  // Label cache
  getLabel: (id: string) => labelCache.get(id),
  setLabel: (id: string, label: DBLabel, ttl?: number) =>
    labelCache.set(id, label, ttl),
  deleteLabel: (id: string) => labelCache.delete(id),
  clearLabels: () => labelCache.clear(),

  // Generic cache
  get: (key: string) => genericCache.get(key),
  set: (key: string, value: any, ttl?: number) =>
    genericCache.set(key, value, ttl),
  delete: (key: string) => genericCache.delete(key),

  // Clear all
  clearAll: () => {
    articleCache.clear();
    labelCache.clear();
    genericCache.clear();
  },
};
