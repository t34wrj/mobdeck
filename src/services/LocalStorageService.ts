/**
 * LocalStorageService - Consolidated local data management
 *
 * Combines functionality from:
 * - DatabaseService
 * - CacheService
 * - AuthStorageService
 *
 * Features:
 * - SQLite database operations
 * - In-memory caching with LRU eviction
 * - Secure token storage via keychain
 * - Unified interface for all local storage needs
 */

import DatabaseService, { DatabaseUtilityFunctions } from './DatabaseService';
import { cacheService } from './CacheService';
import { authStorageService } from './AuthStorageService';
import { Article, PaginatedResult } from '../types';
import {
  DBArticle,
  DBLabel,
  ArticleFilters,
  LabelFilters,
  DatabaseOperationResult,
  DatabaseStats,
} from '../types/database';
import { AuthenticatedUser, TokenValidationResult } from '../types/auth';

export interface LocalStorageServiceInterface {
  // Database operations
  initialize(): Promise<void>;
  isConnected(): boolean;
  close(): Promise<void>;

  // Article operations
  createArticle(
    article: Omit<DBArticle, 'created_at' | 'updated_at'>
  ): Promise<DatabaseOperationResult<string>>;
  getArticle(id: string): Promise<DatabaseOperationResult<DBArticle>>;
  updateArticle(
    id: string,
    updates: Partial<DBArticle>
  ): Promise<DatabaseOperationResult>;
  deleteArticle(
    id: string,
    softDelete?: boolean
  ): Promise<DatabaseOperationResult>;
  getArticles(
    filters?: ArticleFilters
  ): Promise<DatabaseOperationResult<PaginatedResult<DBArticle>>>;
  searchArticles(
    query: string,
    filters?: ArticleFilters
  ): Promise<DatabaseOperationResult<PaginatedResult<DBArticle>>>;

  // Article operations with caching
  getCachedArticle(id: string): Article | null;
  setCachedArticle(id: string, article: Article, ttl?: number): void;
  deleteCachedArticle(id: string): boolean;

  // Label operations
  createLabel(
    label: Omit<DBLabel, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DatabaseOperationResult<number>>;
  getLabel(id: number): Promise<DatabaseOperationResult<DBLabel>>;
  updateLabel(
    id: number,
    updates: Partial<DBLabel>
  ): Promise<DatabaseOperationResult>;
  deleteLabel(id: number): Promise<DatabaseOperationResult>;
  getLabels(
    filters?: LabelFilters
  ): Promise<DatabaseOperationResult<PaginatedResult<DBLabel>>>;

  // Authentication operations
  storeToken(token: string, user?: AuthenticatedUser): Promise<boolean>;
  retrieveToken(): Promise<string | null>;
  retrieveAuthData(): Promise<any>;
  deleteToken(): Promise<boolean>;
  isTokenStored(): Promise<boolean>;
  validateStoredToken(): Promise<TokenValidationResult>;

  // Utility operations
  getStats(): Promise<DatabaseOperationResult<DatabaseStats>>;
  clearAllData(): Promise<DatabaseOperationResult>;
  clearCache(): void;
  vacuum(): Promise<DatabaseOperationResult>;
}

/**
 * LocalStorageService - Unified local storage management
 */
class LocalStorageService implements LocalStorageServiceInterface {
  private static instance: LocalStorageService;

  private constructor() {}

  public static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }

  // Database lifecycle operations
  async initialize(): Promise<void> {
    await DatabaseService.initialize();
  }

  isConnected(): boolean {
    return DatabaseService.isConnected();
  }

  async close(): Promise<void> {
    await DatabaseService.close();
  }

  // Article operations with automatic caching
  async createArticle(
    article: Omit<DBArticle, 'created_at' | 'updated_at'>
  ): Promise<DatabaseOperationResult<string>> {
    const result = await DatabaseService.createArticle(article);

    if (result.success && result.data) {
      // Convert to Article format and cache
      const dbArticle = await DatabaseService.getArticle(result.data);
      if (dbArticle.success && dbArticle.data) {
        const articleForCache =
          DatabaseUtilityFunctions.convertDBArticleToArticle(dbArticle.data);
        this.setCachedArticle(result.data, articleForCache);
      }
    }

    return result;
  }

  async getArticle(id: string): Promise<DatabaseOperationResult<DBArticle>> {
    return DatabaseService.getArticle(id);
  }

  async updateArticle(
    id: string,
    updates: Partial<DBArticle>
  ): Promise<DatabaseOperationResult> {
    const result = await DatabaseService.updateArticle(id, updates);

    if (result.success) {
      // Update cache
      const dbArticle = await DatabaseService.getArticle(id);
      if (dbArticle.success && dbArticle.data) {
        const articleForCache =
          DatabaseUtilityFunctions.convertDBArticleToArticle(dbArticle.data);
        this.setCachedArticle(id, articleForCache);
      }
    }

    return result;
  }

  async deleteArticle(
    id: string,
    softDelete: boolean = true
  ): Promise<DatabaseOperationResult> {
    const result = await DatabaseService.deleteArticle(id, softDelete);

    if (result.success) {
      // Remove from cache
      this.deleteCachedArticle(id);
    }

    return result;
  }

  async getArticles(
    filters?: ArticleFilters
  ): Promise<DatabaseOperationResult<PaginatedResult<DBArticle>>> {
    return DatabaseService.getArticles(filters);
  }

  async searchArticles(
    query: string,
    filters?: ArticleFilters
  ): Promise<DatabaseOperationResult<PaginatedResult<DBArticle>>> {
    return DatabaseService.searchArticles(query, filters);
  }

  // Cache operations for articles
  getCachedArticle(id: string): Article | null {
    return cacheService.getArticle(id);
  }

  setCachedArticle(id: string, article: Article, ttl?: number): void {
    cacheService.setArticle(id, article, ttl);
  }

  deleteCachedArticle(id: string): boolean {
    return cacheService.deleteArticle(id);
  }

  // Label operations
  async createLabel(
    label: Omit<DBLabel, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DatabaseOperationResult<number>> {
    return DatabaseService.createLabel(label);
  }

  async getLabel(id: number): Promise<DatabaseOperationResult<DBLabel>> {
    return DatabaseService.getLabel(id);
  }

  async updateLabel(
    id: number,
    updates: Partial<DBLabel>
  ): Promise<DatabaseOperationResult> {
    return DatabaseService.updateLabel(id, updates);
  }

  async deleteLabel(id: number): Promise<DatabaseOperationResult> {
    return DatabaseService.deleteLabel(id);
  }

  async getLabels(
    filters?: LabelFilters
  ): Promise<DatabaseOperationResult<PaginatedResult<DBLabel>>> {
    return DatabaseService.getLabels(filters);
  }

  // Authentication operations
  async storeToken(token: string, user?: AuthenticatedUser): Promise<boolean> {
    return authStorageService.storeToken(token, user);
  }

  async retrieveToken(): Promise<string | null> {
    return authStorageService.retrieveToken();
  }

  async retrieveAuthData(): Promise<any> {
    return authStorageService.retrieveAuthData();
  }

  async deleteToken(): Promise<boolean> {
    return authStorageService.deleteToken();
  }

  async isTokenStored(): Promise<boolean> {
    return authStorageService.isTokenStored();
  }

  async validateStoredToken(): Promise<TokenValidationResult> {
    return authStorageService.validateStoredToken();
  }

  // Utility operations
  async getStats(): Promise<DatabaseOperationResult<DatabaseStats>> {
    return DatabaseService.getStats();
  }

  async clearAllData(): Promise<DatabaseOperationResult> {
    const result = await DatabaseService.clearAllData();

    if (result.success) {
      // Clear cache as well
      this.clearCache();
      // Clear authentication data
      await this.deleteToken();
    }

    return result;
  }

  clearCache(): void {
    cacheService.clearAll();
  }

  async vacuum(): Promise<DatabaseOperationResult> {
    return DatabaseService.vacuum();
  }

  // Batch operations
  async createArticlesBatch(
    articles: Omit<DBArticle, 'created_at' | 'updated_at'>[]
  ): Promise<DatabaseOperationResult<string[]>> {
    return DatabaseService.createArticlesBatch(articles);
  }

  async updateArticlesBatch(
    updates: { id: string; updates: Partial<DBArticle> }[]
  ): Promise<DatabaseOperationResult> {
    const result = await DatabaseService.updateArticlesBatch(updates);

    if (result.success) {
      // Clear cache for updated articles to force refresh
      updates.forEach(({ id }) => {
        this.deleteCachedArticle(id);
      });
    }

    return result;
  }

  // Enhanced article operations with conversion utilities
  async getArticleAsAppFormat(id: string): Promise<Article | null> {
    // Check cache first
    const cached = this.getCachedArticle(id);
    if (cached) {
      return cached;
    }

    // Get from database
    const result = await this.getArticle(id);
    if (result.success && result.data) {
      const article = DatabaseUtilityFunctions.convertDBArticleToArticle(
        result.data
      );
      // Cache for future use
      this.setCachedArticle(id, article);
      return article;
    }

    return null;
  }

  async createArticleFromAppFormat(article: Article): Promise<string | null> {
    const dbArticle =
      DatabaseUtilityFunctions.convertArticleToDBArticle(article);
    const result = await this.createArticle(dbArticle);
    return result.success ? result.data || null : null;
  }

  async updateArticleFromAppFormat(
    id: string,
    article: Partial<Article>
  ): Promise<boolean> {
    const dbUpdates = DatabaseUtilityFunctions.convertArticleToDBArticle(
      article as Article
    );
    const result = await this.updateArticle(id, dbUpdates);
    return result.success;
  }

  // Cache statistics
  getCacheStats() {
    return cacheService.getStats();
  }


  // Authentication utilities
  async enableBiometricAuth(): Promise<boolean> {
    return authStorageService.enableBiometricAuth();
  }

  disableBiometricAuth(): void {
    authStorageService.disableBiometricAuth();
  }

  async getSecurityConfig() {
    return authStorageService.getSecurityConfig();
  }
}

// Export singleton instance
export const localStorageService = LocalStorageService.getInstance();

// Export class for testing
export default LocalStorageService;

// Export types - LocalStorageServiceInterface is already exported above
