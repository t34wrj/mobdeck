/**
 * Articles API Service
 * Bridge between ReadeckApiService and Redux articles slice
 * Handles type conversions and provides interface expected by Redux
 */

import { readeckApiService } from './ReadeckApiService';
import { Article, PaginatedResponse } from '../types';
import {
  ReadeckArticle,
  ReadeckArticleList,
  CreateArticleRequest,
  UpdateArticleRequest,
  ArticleFilters,
  ReadeckApiResponse,
} from '../types/readeck';
import { RetryManager } from '../utils/retryManager';
import { connectivityManager } from '../utils/connectivityManager';
import { cacheService } from './CacheService';
import DatabaseService, { DatabaseUtilityFunctions } from './DatabaseService';

/**
 * Interface for article operations expected by Redux slice
 */
export interface IArticlesApiService {
  fetchArticles(
    params: FetchArticlesParams
  ): Promise<PaginatedResponse<Article>>;
  createArticle(params: CreateArticleParams): Promise<Article>;
  updateArticle(params: UpdateArticleParams): Promise<Article>;
  deleteArticle(params: DeleteArticleParams): Promise<void>;
  syncArticles(
    params: SyncArticlesParams
  ): Promise<{
    syncedCount: number;
    conflictCount: number;
    articles: Article[];
  }>;
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
  fetchFullContent?: boolean; // Whether to fetch full content for each article
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
  private convertReadeckArticleToArticle(
    readeckArticle: ReadeckArticle | any
  ): Article {
    // Helper function to ensure string values
    const ensureString = (value: any): string => {
      if (value === null || value === undefined) return '';
      return String(value);
    };

    // Helper function to ensure number values
    const ensureNumber = (value: any): number => {
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    };

    // Helper function to ensure boolean values
    const ensureBoolean = (value: any): boolean => {
      return Boolean(value);
    };

    // Helper function to ensure array values
    const ensureArray = (value: any): string[] => {
      if (Array.isArray(value)) return value.map(ensureString);
      return [];
    };

    if (__DEV__) {
      // Debug: Log the raw API response to understand the field structure
      console.log('[ArticlesApiService] Converting Readeck article:', {
        id: readeckArticle.id,
        hasContent: !!readeckArticle.content,
        hasHtml: !!readeckArticle.html,
        hasText: !!readeckArticle.text,
        hasBody: !!readeckArticle.body,
        hasDescription: !!readeckArticle.description,
        fieldKeys: Object.keys(readeckArticle),
        contentPreview:
          readeckArticle.content?.substring(0, 100) || 'NO_CONTENT',
        htmlPreview: readeckArticle.html?.substring(0, 100) || 'NO_HTML',
        textPreview: readeckArticle.text?.substring(0, 100) || 'NO_TEXT',
      });

      // Debug: Print key fields for read/unread analysis
      console.log('[ArticlesApiService] Read status analysis:', {
        id: readeckArticle.id,
        read_progress: readeckArticle.read_progress,
        read_status: readeckArticle.read_status,
        isReadComputed:
          readeckArticle.read_progress !== undefined &&
          readeckArticle.read_progress >= 100,
      });
    }

    // Extract content from resources.article.src as per Readeck API schema
    let content = '';

    // Primary: Check resources.article.src field (URL to article content)
    if (readeckArticle.resources?.article?.src) {
      const articleUrl = ensureString(readeckArticle.resources.article.src);
      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Found article content URL:',
          articleUrl
        );
      }

      // Note: For now, we'll store the URL and fetch content separately when needed
      // This prevents blocking the article list loading with individual content fetches
      content = ''; // Will be fetched on demand
    }

    // Fallback: Try other possible content fields if resources.article.src is empty
    // NOTE: Do NOT use description as content - it's the summary!
    if (!content && !readeckArticle.resources?.article?.src) {
      content = ensureString(
        readeckArticle.content ||
          readeckArticle.content_html ||
          readeckArticle.html ||
          readeckArticle.text ||
          readeckArticle.body ||
          readeckArticle.cached_content ||
          '' // Empty content if none found
      );
      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Using fallback content fields, length:',
          content.length
        );
      }
    }

    // Additional fallback: Check if resource field contains content (legacy support)
    if (!content && readeckArticle.resource) {
      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Checking legacy resource field for content...'
        );
      }
      if (
        typeof readeckArticle.resource === 'string' &&
        readeckArticle.resource.length > 200
      ) {
        // Only use if it looks like actual content, not a short description
        content = ensureString(readeckArticle.resource);
      } else if (typeof readeckArticle.resource === 'object') {
        content = ensureString(
          readeckArticle.resource.content ||
            readeckArticle.resource.html ||
            readeckArticle.resource.data ||
            readeckArticle.resource.body ||
            ''
        );
      }
      if (__DEV__) {
        console.log(
          `[ArticlesApiService] Legacy resource content length: ${content.length}`
        );
      }
    }

    // Handle the updated API field names to match Readeck API documentation
    const convertedArticle = {
      id: ensureString(readeckArticle.id),
      title: ensureString(readeckArticle.title),
      summary: ensureString(readeckArticle.description),
      content,
      url: ensureString(readeckArticle.url),
      imageUrl: ensureString(
        readeckArticle.resources?.image?.src ||
          readeckArticle.resources?.thumbnail?.src
      ),
      readTime: ensureNumber(readeckArticle.reading_time),
      isArchived: ensureBoolean(readeckArticle.is_archived),
      isFavorite: ensureBoolean(readeckArticle.is_marked), // Note: API uses is_marked for favorites
      isRead: ensureBoolean(
        readeckArticle.read_progress !== undefined &&
          readeckArticle.read_progress >= 100
      ), // Article is read when progress is 100%
      tags: ensureArray(readeckArticle.labels), // Note: API uses labels instead of tags
      sourceUrl: ensureString(readeckArticle.url), // sourceUrl same as url in Readeck
      createdAt: ensureString(
        readeckArticle.created || new Date().toISOString()
      ),
      updatedAt: ensureString(
        readeckArticle.updated || new Date().toISOString()
      ),
      syncedAt: new Date().toISOString(),
      // Store the content URL for on-demand fetching
      contentUrl: ensureString(readeckArticle.resources?.article?.src),
    };

    if (__DEV__) {
      console.log('[ArticlesApiService] Converted article:', {
        id: convertedArticle.id,
        title: convertedArticle.title,
        hasContent: !!convertedArticle.content,
        contentLength: convertedArticle.content.length,
        contentPreview: convertedArticle.content.substring(0, 100),
      });
    }

    return convertedArticle;
  }

  /**
   * Convert Article (camelCase) to UpdateArticleRequest (snake_case)
   * Updated to match Readeck API documentation
   * @private
   */
  private convertArticleToUpdateRequest(
    updates: Partial<Article>
  ): UpdateArticleRequest {
    const request: UpdateArticleRequest = {};

    if (updates.title !== undefined) request.title = updates.title;
    if (updates.isArchived !== undefined)
      request.is_archived = updates.isArchived;
    if (updates.isFavorite !== undefined)
      request.is_marked = updates.isFavorite; // Note: API uses is_marked
    if (updates.tags !== undefined) request.labels = updates.tags; // Note: API uses labels

    // Note: isRead is not directly supported in Readeck API
    // Read status is tracked via read_progress instead
    if (updates.isRead !== undefined) {
      request.read_progress = updates.isRead ? 100 : 0;
    }

    return request;
  }

  /**
   * Convert filters to ArticleFilters format
   * Updated to match Readeck API documentation
   * @private
   */
  private convertFiltersToReadeckFilters(
    params: FetchArticlesParams
  ): ArticleFilters {
    const filters: ArticleFilters = {
      limit: params.limit || 20,
      offset: ((params.page || 1) - 1) * (params.limit || 20), // Convert page to offset
      sort: ['-created'], // Default sort by created date descending
    };

    if (params.searchQuery) {
      filters.search = params.searchQuery;
    }

    if (params.filters) {
      if (params.filters.isArchived !== undefined) {
        filters.is_archived = params.filters.isArchived;
      }
      if (params.filters.isFavorite !== undefined) {
        filters.is_marked = params.filters.isFavorite; // Note: API uses is_marked
      }
      if (params.filters.isRead !== undefined) {
        // Map isRead to read_status array
        filters.read_status = params.filters.isRead
          ? ['read']
          : ['unread', 'reading'];
        if (__DEV__) {
          console.log('[ArticlesApiService] Read filter applied:', {
            isRead: params.filters.isRead,
            read_status: filters.read_status,
          });
        }
      }
      if (params.filters.tags && params.filters.tags.length > 0) {
        filters.labels = params.filters.tags.join(','); // Note: API uses labels and expects comma-separated string
      }
    }

    if (__DEV__) {
      console.log('[ArticlesApiService] Final filters being sent to API:', {
        ...filters,
        FILTER_ANALYSIS: {
          hasReadFilter: filters.read_status !== undefined,
          readFilterValue: filters.read_status,
          originalIsReadParam: params.filters?.isRead,
        },
      });
    }
    return filters;
  }

  /**
   * Handle API errors with proper error propagation
   * @private
   */
  private handleApiError(error: any, operation: string): never {
    // Don't log here as error will be handled by calling code
    if (error.code && error.message) {
      // ReadeckApiError - for specific operations, wrap the error message
      const wrapperOperations = [
        'Update article',
        'Get article',
        'Create article',
      ];
      if (wrapperOperations.includes(operation)) {
        throw new Error(`${operation} failed: ${error.message}`);
      }
      // Otherwise pass through
      throw error;
    } else {
      // Unknown error - wrap in standard format
      throw new Error(`${operation} failed: ${error.message || String(error)}`);
    }
  }

  /**
   * Fetch articles with pagination and filtering
   */
  async fetchArticles(
    params: FetchArticlesParams
  ): Promise<PaginatedResponse<Article>> {
    // Check connectivity first
    if (!connectivityManager.isOnline()) {
      throw {
        code: 'CONNECTION_ERROR',
        message: 'Cannot fetch articles while offline',
      };
    }

    return RetryManager.withRetry(
      async () => {
        try {
          if (__DEV__) {
            console.log(
              '[ArticlesApiService] Fetching articles with params:',
              params
            );
          }

          const filters = this.convertFiltersToReadeckFilters(params);
          const response: ReadeckApiResponse<ReadeckArticleList> =
            await readeckApiService.getArticles(filters);

          if (__DEV__) {
            // Debug log the response structure and first few articles
            console.log('[ArticlesApiService] API Response structure:', {
              hasResponse: !!response,
              hasData: !!response?.data,
              dataType: Array.isArray(response?.data)
                ? 'array'
                : typeof response?.data,
              dataKeys:
                response?.data && typeof response.data === 'object'
                  ? Object.keys(response.data)
                  : [],
              filtersSent: filters,
              paramsReceived: params,
            });

            // Log the first few articles to see their read status
            if (response?.data) {
              const articles = Array.isArray(response.data)
                ? response.data
                : response.data.articles ||
                  (response.data as any).bookmarks ||
                  [];
              console.log(
                '[ArticlesApiService] First 3 articles read status analysis:',
                articles.slice(0, 3).map((article: any) => ({
                  id: article.id,
                  title: `${article.title?.substring(0, 50)}...`,
                  read_progress: article.read_progress,
                  computedIsRead:
                    article.read_progress !== undefined &&
                    article.read_progress >= 100,
                }))
              );

              // Summary of all articles' read status
              const readStatusSummary = articles.reduce(
                (acc: any, article: any) => {
                  const progress = article.read_progress;
                  if (progress === undefined || progress === null) {
                    acc.undefined++;
                  } else if (progress === 0) {
                    acc.zero++;
                  } else if (progress > 0 && progress < 100) {
                    acc.inProgress++;
                  } else if (progress >= 100) {
                    acc.completed++;
                  }
                  return acc;
                },
                { undefined: 0, zero: 0, inProgress: 0, completed: 0 }
              );

              console.log(
                '[ArticlesApiService] Read progress summary for all articles:',
                {
                  total: articles.length,
                  ...readStatusSummary,
                }
              );
            }
          }

          // Check if response has the expected structure
          if (!response || !response.data) {
            console.error(
              '[ArticlesApiService] Invalid response structure:',
              response
            );
            throw new Error('Invalid response from server');
          }

          // Handle different possible response formats from Readeck API
          let articles: Article[] = [];
          let pagination = {
            page: 1,
            totalPages: 1,
            totalItems: 0,
          };

          // Check if response.data is an array (direct bookmarks response)
          if (Array.isArray(response.data)) {
            articles = response.data.map((readeckArticle: any) =>
              this.convertReadeckArticleToArticle(readeckArticle)
            );
            pagination = {
              page: params.page || 1,
              totalPages: 1,
              totalItems: articles.length,
            };
          }
          // Check if response.data has articles property (as per ReadeckArticleList type)
          else if (
            response.data.articles &&
            Array.isArray(response.data.articles)
          ) {
            articles = response.data.articles.map(readeckArticle =>
              this.convertReadeckArticleToArticle(readeckArticle)
            );
            if (response.data.pagination) {
              pagination = {
                page: response.data.pagination.page || 1,
                totalPages: response.data.pagination.total_pages || 1,
                totalItems:
                  response.data.pagination.total_count || articles.length,
              };
            }
          }
          // Check if response.data has bookmarks property (alternative naming - some API versions might use this)
          else if (
            (response.data as any).bookmarks &&
            Array.isArray((response.data as any).bookmarks)
          ) {
            articles = (response.data as any).bookmarks.map(
              (readeckArticle: any) =>
                this.convertReadeckArticleToArticle(readeckArticle)
            );
            if ((response.data as any).pagination) {
              pagination = {
                page: (response.data as any).pagination.page || 1,
                totalPages: (response.data as any).pagination.total_pages || 1,
                totalItems:
                  (response.data as any).pagination.total_count ||
                  articles.length,
              };
            }
          }

          // Fetch full content for articles if requested and content is missing
          if (params.fetchFullContent) {
            if (__DEV__) {
              console.log(
                '[ArticlesApiService] fetchFullContent enabled, checking articles for missing content...'
              );
            }

            const articlesWithFullContent = await Promise.all(
              articles.map(async article => {
                // Check cache first
                const cachedArticle = cacheService.getArticle(article.id);
                if (cachedArticle && cachedArticle.content) {
                  if (__DEV__) {
                    console.log(
                      `[ArticlesApiService] Using cached content for article: ${article.id}`
                    );
                  }
                  return { ...article, content: cachedArticle.content };
                }

                // Check if article needs full content
                if (!article.content || article.content.trim() === '') {
                  try {
                    if (__DEV__) {
                      console.log(
                        `[ArticlesApiService] Fetching full content for article: ${article.id}`
                      );
                    }
                    const fullContentResponse =
                      await readeckApiService.getArticle(article.id);

                    if (__DEV__) {
                      console.log(
                        `[ArticlesApiService] Full content response:`,
                        {
                          hasData: !!fullContentResponse?.data,
                          status: fullContentResponse?.status,
                        }
                      );
                    }

                    if (fullContentResponse.data) {
                      // Convert and merge full content
                      const fullArticle = this.convertReadeckArticleToArticle(
                        fullContentResponse.data
                      );
                      if (__DEV__) {
                        console.log(
                          `[ArticlesApiService] Full content fetched for article: ${article.id}, content length: ${fullArticle.content?.length || 0}`
                        );
                      }
                      const updatedArticle = {
                        ...article,
                        content: fullArticle.content,
                      };
                      // Cache the complete article
                      cacheService.setArticle(article.id, updatedArticle);
                      return updatedArticle;
                    } else {
                      console.warn(
                        `[ArticlesApiService] Failed to fetch full content for article: ${article.id}`
                      );
                      return article;
                    }
                  } catch (error) {
                    console.warn(
                      `[ArticlesApiService] Failed to fetch full content for article: ${article.id}: ${(error as any)?.message || 'Unknown error'}`
                    );
                    return article; // Return original article if fetch fails
                  }
                }
                return article; // Return original if content exists
              })
            );

            articles = articlesWithFullContent;
            if (__DEV__) {
              console.log(
                `[ArticlesApiService] Completed full content fetch for ${articles.length} articles`
              );
            }
          }

          // Client-side filtering as fallback for read/unread status
          // This ensures filtering works even if the API doesn't properly filter server-side
          if (params.filters?.isRead !== undefined) {
            const originalCount = articles.length;
            const targetReadStatus = params.filters.isRead;

            articles = articles.filter(article => {
              const articleIsRead = article.isRead;
              const shouldInclude = articleIsRead === targetReadStatus;

              if (!shouldInclude && __DEV__) {
                console.log(
                  `[ArticlesApiService] Client-side filter excluding article:`,
                  {
                    id: article.id,
                    title: `${article.title?.substring(0, 30)}...`,
                    isRead: articleIsRead,
                    targetReadStatus,
                    readProgress: (article as any).readProgress || 'N/A',
                  }
                );
              }

              return shouldInclude;
            });

            if (__DEV__) {
              console.log(
                `[ArticlesApiService] Client-side read filter applied:`,
                {
                  originalCount,
                  filteredCount: articles.length,
                  targetReadStatus,
                  articlesRemoved: originalCount - articles.length,
                }
              );
            }
          }

          const paginatedResponse: PaginatedResponse<Article> = {
            items: articles,
            page: pagination.page,
            totalPages: pagination.totalPages,
            totalItems: pagination.totalItems,
          };

          if (__DEV__) {
            console.log(
              `[ArticlesApiService] Successfully fetched ${articles.length} articles (page ${paginatedResponse.page}/${paginatedResponse.totalPages})`
            );
          }
          return paginatedResponse;
        } catch (error: any) {
          // Check for connection errors and provide better error messages
          if (
            error?.code === 'CONNECTION_ERROR' ||
            error?.code === 'ECONNREFUSED'
          ) {
            throw {
              code: 'CONNECTION_ERROR',
              message:
                'Unable to connect to server. Please check your internet connection and server settings.',
            };
          }
          return this.handleApiError(error, 'Fetch articles');
        }
      },
      {
        maxRetries: 3,
        onRetry: (error, attempt) => {
          console.debug(
            `[ArticlesApiService] Retrying fetch articles (attempt ${attempt}):`,
            error.message
          );
        },
      }
    );
  }

  /**
   * Create a new article from URL
   */
  async createArticle(params: CreateArticleParams): Promise<Article> {
    try {
      if (__DEV__) {
        console.log('[ArticlesApiService] Creating article:', {
          url: params.url,
          title: params.title,
        });
      }

      const createRequest: CreateArticleRequest = {
        url: params.url,
        title: params.title,
        labels: params.tags, // Note: API uses labels instead of tags
      };

      const response: ReadeckApiResponse<ReadeckArticle> =
        await readeckApiService.createArticle(createRequest);
      const article = this.convertReadeckArticleToArticle(response.data);

      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Successfully created article:',
          article.id
        );
      }
      return article;
    } catch (error) {
      throw this.handleApiError(error, 'Create article');
    }
  }

  /**
   * Update an existing article
   */
  async updateArticle(params: UpdateArticleParams): Promise<Article> {
    try {
      if (__DEV__) {
        console.log('[ArticlesApiService] Updating article:', {
          id: params.id,
          updates: Object.keys(params.updates),
        });
      }

      const updateRequest = this.convertArticleToUpdateRequest(params.updates);
      const response: ReadeckApiResponse<ReadeckArticle> =
        await readeckApiService.updateArticle(params.id, updateRequest);
      const article = this.convertReadeckArticleToArticle(response.data);

      // Update cache with new article data
      cacheService.setArticle(params.id, article);

      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Successfully updated article:',
          article.id
        );
      }
      return article;
    } catch (error) {
      throw this.handleApiError(error, 'Update article');
    }
  }

  /**
   * Delete an article
   */
  async deleteArticle(params: DeleteArticleParams): Promise<void> {
    try {
      if (__DEV__) {
        console.log('[ArticlesApiService] Deleting article:', {
          id: params.id,
          permanent: params.permanent,
        });
      }

      await readeckApiService.deleteArticle(params.id);

      // Remove from cache
      cacheService.deleteArticle(params.id);

      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Successfully deleted article:',
          params.id
        );
      }
    } catch (error) {
      throw this.handleApiError(error, 'Delete article');
    }
  }

  /**
   * Sync articles with server
   */
  async syncArticles(
    params: SyncArticlesParams
  ): Promise<{
    syncedCount: number;
    conflictCount: number;
    articles: Article[];
  }> {
    try {
      if (__DEV__) {
        console.log('[ArticlesApiService] Syncing articles:', params);
      }

      const syncRequest = {
        limit: params.fullSync ? undefined : 100,
        include_deleted: params.fullSync || false,
      };

      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Calling readeckApiService.syncArticles with:',
          syncRequest
        );
      }
      const response = await readeckApiService.syncArticles(syncRequest);
      if (__DEV__) {
        console.log('[ArticlesApiService] Sync response received:', {
          hasData: !!response?.data,
          responseKeys: response ? Object.keys(response) : [],
          dataKeys: response?.data ? Object.keys(response.data) : [],
        });
      }

      // Validate response structure
      if (!response || !response.data) {
        console.error(
          '[ArticlesApiService] Invalid sync response structure:',
          response
        );
        throw new Error('Invalid sync response from server');
      }

      // Safely access articles array with validation
      const readeckArticles = response.data.articles || [];
      if (__DEV__) {
        console.log('[ArticlesApiService] Extracted articles:', {
          articlesCount: readeckArticles.length,
          isArray: Array.isArray(readeckArticles),
          firstArticleKeys: readeckArticles[0]
            ? Object.keys(readeckArticles[0])
            : [],
        });
      }

      if (!Array.isArray(readeckArticles)) {
        console.error(
          '[ArticlesApiService] Expected articles array, got:',
          typeof readeckArticles,
          readeckArticles
        );
        throw new Error('Invalid articles data in sync response');
      }

      // Convert ReadeckArticle to Article format
      const articles = readeckArticles.map(readeckArticle =>
        this.convertReadeckArticleToArticle(readeckArticle)
      );

      if (__DEV__) {
        console.log('[ArticlesApiService] Converted articles:', {
          convertedCount: articles.length,
          firstArticleTitle: articles[0]?.title,
          firstArticleId: articles[0]?.id,
        });
      }

      // Save articles to local database
      for (const article of articles) {
        try {
          // Convert to database format
          const dbArticle =
            DatabaseUtilityFunctions.convertArticleToDBArticle(article);

          // Try to create the article (this will fail if it already exists)
          const createResult = await DatabaseService.createArticle(dbArticle);

          if (createResult.success) {
            if (__DEV__) {
              console.log(
                `[ArticlesApiService] Created article in database: ${article.id}`
              );
            }
          } else {
            // If creation failed, try to update existing article
            if (__DEV__) {
              console.log(
                `[ArticlesApiService] Article exists, updating: ${article.id}`
              );
            }
            await DatabaseService.updateArticle(article.id, dbArticle);
          }
        } catch (dbError) {
          console.warn(
            `[ArticlesApiService] Failed to save article ${article.id}:`,
            dbError
          );
          // Continue with other articles even if one fails
        }
      }

      // Calculate sync metrics
      const syncedCount = articles.length;
      const conflictCount = 0; // Readeck API doesn't report conflicts directly

      if (__DEV__) {
        console.log(
          `[ArticlesApiService] Sync completed: ${syncedCount} articles synced, ${conflictCount} conflicts`
        );
      }

      return { syncedCount, conflictCount, articles };
    } catch (error) {
      return this.handleApiError(error, 'Sync articles');
    }
  }

  /**
   * Get a single article by ID
   */
  async getArticle(id: string): Promise<Article> {
    try {
      // Check cache first for optimal performance
      const cachedArticle = cacheService.getArticle(id);
      if (cachedArticle) {
        if (__DEV__) {
          console.log('[ArticlesApiService] Cache hit for article:', id);
        }
        return cachedArticle;
      }

      if (__DEV__) {
        console.log('[ArticlesApiService] Cache miss, fetching article:', id);
      }

      const response: ReadeckApiResponse<ReadeckArticle> =
        await readeckApiService.getArticle(id);
      const article = this.convertReadeckArticleToArticle(response.data);

      // If article has a contentUrl but no content, fetch the content
      if (article.contentUrl && !article.content) {
        if (__DEV__) {
          console.log(
            '[ArticlesApiService] Article has contentUrl, fetching content...'
          );
        }
        try {
          const htmlContent = await this.getArticleContent(article.contentUrl);
          article.content = htmlContent;
          if (__DEV__) {
            console.log(
              '[ArticlesApiService] Successfully fetched article content, length:',
              htmlContent.length
            );
          }
        } catch (error) {
          console.error(
            '[ArticlesApiService] Failed to fetch article content:',
            error
          );
          // Continue without content on error
        }
      }

      // Cache the article for subsequent requests
      cacheService.setArticle(id, article);

      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Successfully fetched article:',
          article.id,
          'with content length:',
          article.content?.length || 0
        );
      }
      return article;
    } catch (error) {
      throw this.handleApiError(error, 'Get article');
    }
  }

  /**
   * Fetch article content from the article content URL
   */
  async getArticleContent(contentUrl: string): Promise<string> {
    try {
      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Fetching article content from:',
          contentUrl
        );
      }

      // Use the readeck API service to fetch content
      const response = await readeckApiService.getArticleContent(contentUrl);

      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Successfully fetched article content, length:',
          response.length
        );
      }
      return response;
    } catch (error) {
      console.error(
        '[ArticlesApiService] Failed to fetch article content:',
        error
      );
      this.handleApiError(error, 'Get article content');
      return ''; // Return empty string on error
    }
  }

  /**
   * Batch update multiple articles
   */
  async batchUpdateArticles(
    updates: Array<{ id: string; updates: Partial<Article> }>
  ): Promise<Article[]> {
    try {
      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Batch updating articles:',
          updates.length
        );
      }

      const updatePromises = updates.map(({ id, updates: articleUpdates }) =>
        this.updateArticle({ id, updates: articleUpdates })
      );

      const articles = await Promise.all(updatePromises);

      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Successfully batch updated articles:',
          articles.length
        );
      }
      return articles;
    } catch (error) {
      throw this.handleApiError(error, 'Batch update articles');
    }
  }

  /**
   * Batch delete multiple articles
   */
  async batchDeleteArticles(ids: string[]): Promise<void> {
    try {
      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Batch deleting articles:',
          ids.length
        );
      }

      const deletePromises = ids.map(id => this.deleteArticle({ id }));
      await Promise.all(deletePromises);

      if (__DEV__) {
        console.log(
          '[ArticlesApiService] Successfully batch deleted articles:',
          ids.length
        );
      }
    } catch (error) {
      throw this.handleApiError(error, 'Batch delete articles');
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
      if (__DEV__) {
        console.log('[ArticlesApiService] Fetching article statistics');
      }

      // Fetch user profile which contains article stats
      const response = await readeckApiService.getUserProfile();
      const stats = (response.data as any).stats;

      return {
        total: stats.total_articles,
        read: stats.read_articles,
        favorite: stats.favorite_articles,
        archived: stats.archived_articles,
      };
    } catch (error) {
      throw this.handleApiError(error, 'Get article stats');
    }
  }

  /**
   * Clear article cache
   */
  clearCache(): void {
    if (__DEV__) {
      console.log('[ArticlesApiService] Clearing article cache');
    }
    cacheService.clearArticles();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheService.getStats().articles;
  }
}

// Export singleton instance for consistent usage across the app
export const articlesApiService = new ArticlesApiService();

// Export class for testing and custom instantiation
export default ArticlesApiService;
