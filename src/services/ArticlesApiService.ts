/**
 * Articles API Service
 * Bridge between ReadeckApiService and Redux articles slice
 * Handles type conversions and provides interface expected by Redux
 */

import { readeckApiService } from './ReadeckApiService';
import {
  Article,
  PaginatedResponse,
  ApiResponse,
} from '../types';
import {
  ReadeckArticle,
  ReadeckArticleList,
  CreateArticleRequest,
  UpdateArticleRequest,
  ArticleFilters,
  ReadeckApiResponse,
  ReadeckApiError,
} from '../types/readeck';

/**
 * Interface for article operations expected by Redux slice
 */
export interface IArticlesApiService {
  fetchArticles(params: FetchArticlesParams): Promise<PaginatedResponse<Article>>;
  createArticle(params: CreateArticleParams): Promise<Article>;
  updateArticle(params: UpdateArticleParams): Promise<Article>;
  deleteArticle(params: DeleteArticleParams): Promise<void>;
  syncArticles(params: SyncArticlesParams): Promise<{ syncedCount: number; conflictCount: number }>;
}

/**
 * Parameters for article operations
 */
export interface FetchArticlesParams {
  page?: number;
  limit?: number;
  searchQuery?: string;
  filters?: {
    isArchived?: boolean;
    isFavorite?: boolean;
    isRead?: boolean;
    tags?: string[];
  };
  forceRefresh?: boolean;
}

export interface CreateArticleParams {
  title: string;
  url: string;
  summary?: string;
  content?: string;
  tags?: string[];
}

export interface UpdateArticleParams {
  id: string;
  updates: Partial<Omit<Article, 'id' | 'createdAt' | 'updatedAt'>>;
}

export interface DeleteArticleParams {
  id: string;
  permanent?: boolean;
}

export interface SyncArticlesParams {
  fullSync?: boolean;
  articlesOnly?: boolean;
}

/**
 * ArticlesApiService - Bridge between ReadeckApiService and Redux slice
 * 
 * Features:
 * - Type conversion between ReadeckArticle and Article formats
 * - Pagination response transformation
 * - Error handling with proper error propagation
 * - Comprehensive logging for debugging
 * - Consistent interface for Redux async thunks
 */
class ArticlesApiService implements IArticlesApiService {
  /**
   * Convert ReadeckArticle (snake_case) to Article (camelCase)
   * @private
   */
  private convertReadeckArticleToArticle(readeckArticle: ReadeckArticle): Article {
    return {
      id: readeckArticle.id,
      title: readeckArticle.title,
      summary: readeckArticle.summary,
      content: readeckArticle.content,
      url: readeckArticle.url,
      imageUrl: readeckArticle.image_url,
      readTime: readeckArticle.read_time,
      isArchived: readeckArticle.is_archived,
      isFavorite: readeckArticle.is_favorite,
      isRead: readeckArticle.is_read,
      tags: readeckArticle.tags,
      sourceUrl: readeckArticle.source_url,
      createdAt: readeckArticle.created_at,
      updatedAt: readeckArticle.updated_at,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Convert Article (camelCase) to UpdateArticleRequest (snake_case)
   * @private
   */
  private convertArticleToUpdateRequest(updates: Partial<Article>): UpdateArticleRequest {
    const request: UpdateArticleRequest = {};
    
    if (updates.title !== undefined) request.title = updates.title;
    if (updates.isArchived !== undefined) request.is_archived = updates.isArchived;
    if (updates.isFavorite !== undefined) request.is_favorite = updates.isFavorite;
    if (updates.isRead !== undefined) request.is_read = updates.isRead;
    if (updates.tags !== undefined) request.tags = updates.tags;

    return request;
  }

  /**
   * Convert filters to ArticleFilters format
   * @private
   */
  private convertFiltersToReadeckFilters(params: FetchArticlesParams): ArticleFilters {
    const filters: ArticleFilters = {
      page: params.page || 1,
      per_page: params.limit || 20,
      sort_by: 'created_at',
      sort_order: 'desc',
    };

    if (params.searchQuery) {
      filters.search = params.searchQuery;
    }

    if (params.filters) {
      if (params.filters.isArchived !== undefined) {
        filters.is_archived = params.filters.isArchived;
      }
      if (params.filters.isFavorite !== undefined) {
        filters.is_favorite = params.filters.isFavorite;
      }
      if (params.filters.isRead !== undefined) {
        filters.is_read = params.filters.isRead;
      }
      if (params.filters.tags && params.filters.tags.length > 0) {
        filters.tags = params.filters.tags;
      }
    }

    return filters;
  }

  /**
   * Handle API errors with proper error propagation
   * @private
   */
  private handleApiError(error: any, operation: string): never {
    console.error(`[ArticlesApiService] ${operation} failed:`, error);
    
    if (error.code && error.message) {
      // ReadeckApiError - pass through
      throw error;
    } else {
      // Unknown error - wrap in standard format
      throw new Error(`${operation} failed: ${error.message || String(error)}`);
    }
  }

  /**
   * Fetch articles with pagination and filtering
   */
  async fetchArticles(params: FetchArticlesParams): Promise<PaginatedResponse<Article>> {
    try {
      console.log('[ArticlesApiService] Fetching articles with params:', params);
      
      const filters = this.convertFiltersToReadeckFilters(params);
      const response: ReadeckApiResponse<ReadeckArticleList> = await readeckApiService.getArticles(filters);
      
      const articles = response.data.articles.map(readeckArticle => 
        this.convertReadeckArticleToArticle(readeckArticle)
      );

      const paginatedResponse: PaginatedResponse<Article> = {
        items: articles,
        page: response.data.pagination.page,
        totalPages: response.data.pagination.total_pages,
        totalItems: response.data.pagination.total_count,
      };

      console.log(`[ArticlesApiService] Successfully fetched ${articles.length} articles (page ${paginatedResponse.page}/${paginatedResponse.totalPages})`);
      return paginatedResponse;
    } catch (error) {
      this.handleApiError(error, 'Fetch articles');
    }
  }

  /**
   * Create a new article from URL
   */
  async createArticle(params: CreateArticleParams): Promise<Article> {
    try {
      console.log('[ArticlesApiService] Creating article:', { url: params.url, title: params.title });
      
      const createRequest: CreateArticleRequest = {
        url: params.url,
        title: params.title,
        tags: params.tags,
        is_favorite: false, // Default to not favorite
      };

      const response: ReadeckApiResponse<ReadeckArticle> = await readeckApiService.createArticle(createRequest);
      const article = this.convertReadeckArticleToArticle(response.data);

      console.log('[ArticlesApiService] Successfully created article:', article.id);
      return article;
    } catch (error) {
      this.handleApiError(error, 'Create article');
    }
  }

  /**
   * Update an existing article
   */
  async updateArticle(params: UpdateArticleParams): Promise<Article> {
    try {
      console.log('[ArticlesApiService] Updating article:', { id: params.id, updates: Object.keys(params.updates) });
      
      const updateRequest = this.convertArticleToUpdateRequest(params.updates);
      const response: ReadeckApiResponse<ReadeckArticle> = await readeckApiService.updateArticle(params.id, updateRequest);
      const article = this.convertReadeckArticleToArticle(response.data);

      console.log('[ArticlesApiService] Successfully updated article:', article.id);
      return article;
    } catch (error) {
      this.handleApiError(error, 'Update article');
    }
  }

  /**
   * Delete an article
   */
  async deleteArticle(params: DeleteArticleParams): Promise<void> {
    try {
      console.log('[ArticlesApiService] Deleting article:', { id: params.id, permanent: params.permanent });
      
      await readeckApiService.deleteArticle(params.id);
      
      console.log('[ArticlesApiService] Successfully deleted article:', params.id);
    } catch (error) {
      this.handleApiError(error, 'Delete article');
    }
  }

  /**
   * Sync articles with server
   */
  async syncArticles(params: SyncArticlesParams): Promise<{ syncedCount: number; conflictCount: number }> {
    try {
      console.log('[ArticlesApiService] Syncing articles:', params);
      
      const syncRequest = {
        limit: params.fullSync ? undefined : 100,
        include_deleted: params.fullSync || false,
      };

      const response = await readeckApiService.syncArticles(syncRequest);
      
      // Calculate sync metrics
      const syncedCount = response.data.articles.length;
      const conflictCount = 0; // Readeck API doesn't report conflicts directly
      
      console.log(`[ArticlesApiService] Sync completed: ${syncedCount} articles synced, ${conflictCount} conflicts`);
      
      return { syncedCount, conflictCount };
    } catch (error) {
      this.handleApiError(error, 'Sync articles');
    }
  }

  /**
   * Get a single article by ID
   */
  async getArticle(id: string): Promise<Article> {
    try {
      console.log('[ArticlesApiService] Fetching article:', id);
      
      const response: ReadeckApiResponse<ReadeckArticle> = await readeckApiService.getArticle(id);
      const article = this.convertReadeckArticleToArticle(response.data);

      console.log('[ArticlesApiService] Successfully fetched article:', article.id);
      return article;
    } catch (error) {
      this.handleApiError(error, 'Get article');
    }
  }

  /**
   * Batch update multiple articles
   */
  async batchUpdateArticles(updates: Array<{ id: string; updates: Partial<Article> }>): Promise<Article[]> {
    try {
      console.log('[ArticlesApiService] Batch updating articles:', updates.length);
      
      const updatePromises = updates.map(({ id, updates: articleUpdates }) =>
        this.updateArticle({ id, updates: articleUpdates })
      );

      const articles = await Promise.all(updatePromises);
      
      console.log('[ArticlesApiService] Successfully batch updated articles:', articles.length);
      return articles;
    } catch (error) {
      this.handleApiError(error, 'Batch update articles');
    }
  }

  /**
   * Batch delete multiple articles
   */
  async batchDeleteArticles(ids: string[]): Promise<void> {
    try {
      console.log('[ArticlesApiService] Batch deleting articles:', ids.length);
      
      const deletePromises = ids.map(id => this.deleteArticle({ id }));
      await Promise.all(deletePromises);
      
      console.log('[ArticlesApiService] Successfully batch deleted articles:', ids.length);
    } catch (error) {
      this.handleApiError(error, 'Batch delete articles');
    }
  }

  /**
   * Get article statistics
   */
  async getArticleStats(): Promise<{
    total: number;
    read: number;
    favorite: number;
    archived: number;
  }> {
    try {
      console.log('[ArticlesApiService] Fetching article statistics');
      
      // Fetch user profile which contains article stats
      const response = await readeckApiService.getUserProfile();
      const stats = response.data.stats;
      
      return {
        total: stats.total_articles,
        read: stats.read_articles,
        favorite: stats.favorite_articles,
        archived: stats.archived_articles,
      };
    } catch (error) {
      this.handleApiError(error, 'Get article stats');
    }
  }
}

// Export singleton instance for consistent usage across the app
export const articlesApiService = new ArticlesApiService();

// Export class for testing and custom instantiation
export default ArticlesApiService;