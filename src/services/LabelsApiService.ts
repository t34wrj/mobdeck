/**
 * Labels API Service
 * Bridge between ReadeckApiService and Redux labels management
 * Handles CRUD operations for Readeck labels/tags with comprehensive error handling
 */

import { readeckApiService } from './ReadeckApiService';
import { PaginatedResponse } from '../types';
import {
  Label,
  ReadeckLabel,
  ReadeckLabelList,
  CreateLabelRequest,
  UpdateLabelRequest,
  LabelFilters,
  ILabelsApiService,
  FetchLabelsParams,
  CreateLabelParams,
  UpdateLabelParams,
  DeleteLabelParams,
  AssignLabelToArticleParams,
  RemoveLabelFromArticleParams,
  BatchAssignLabelsParams,
  BatchLabelAssignmentResult,
  LabelStats,
  LabelApiError,
  LabelErrorCode,
  LabelCacheEntry,
  AssignLabelRequest,
  RemoveLabelRequest,
  BatchLabelAssignmentRequest,
} from '../types/labels';
import { ReadeckApiResponse } from '../types/readeck';

/**
 * LabelsApiService - Comprehensive labels management service
 *
 * Features:
 * - Full CRUD operations for labels (fetch, create, update, delete)
 * - Label assignment/removal operations with articles
 * - Type conversion between ReadeckLabel and Label formats
 * - Pagination response transformation
 * - Comprehensive error handling with proper error propagation
 * - Caching mechanisms for improved performance
 * - Batch operations for efficient bulk updates
 * - Statistics and analytics for label usage
 * - Consistent interface for Redux async thunks
 */
class LabelsApiService implements ILabelsApiService {
  private labelCache = new Map<string, LabelCacheEntry>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  /**
   * Convert ReadeckLabel (snake_case) to Label (camelCase)
   * @private
   */
  private convertReadeckLabelToLabel(readeckLabel: ReadeckLabel): Label {
    return {
      id: readeckLabel.id,
      name: readeckLabel.name,
      color: readeckLabel.color,
      description: readeckLabel.description,
      articleCount: readeckLabel.article_count,
      createdAt: readeckLabel.created_at,
      updatedAt: readeckLabel.updated_at,
    };
  }

  /**
   * Convert Label (camelCase) to UpdateLabelRequest (snake_case)
   * @private
   */
  private convertLabelToUpdateRequest(
    updates: Partial<Label>
  ): UpdateLabelRequest {
    const request: UpdateLabelRequest = {};

    if (updates.name !== undefined) request.name = updates.name;
    if (updates.color !== undefined) request.color = updates.color;
    if (updates.description !== undefined)
      request.description = updates.description;

    return request;
  }

  /**
   * Convert filters to LabelFilters format
   * @private
   */
  private convertFiltersToReadeckFilters(
    params: FetchLabelsParams
  ): LabelFilters {
    const filters: LabelFilters = {
      page: params.page || 1,
      per_page: params.limit || 50,
      sort_by: 'name',
      sort_order: 'asc',
    };

    if (params.searchQuery) {
      filters.search = params.searchQuery;
    }

    if (params.sortBy) {
      const sortByMap: Record<string, string> = {
        name: 'name',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        articleCount: 'article_count',
      };
      filters.sort_by = sortByMap[params.sortBy] as any;
    }

    if (params.sortOrder) {
      filters.sort_order = params.sortOrder;
    }

    if (params.includeEmpty !== undefined) {
      filters.include_empty = params.includeEmpty;
    }

    return filters;
  }

  /**
   * Handle API errors with proper error propagation
   * @private
   */
  private handleApiError(
    error: any,
    operation: string,
    labelId?: string,
    articleId?: string
  ): never {
    console.error(`[LabelsApiService] ${operation} failed:`, error);

    if (error.code && error.message) {
      // ReadeckApiError - convert to LabelApiError
      const labelError: LabelApiError = {
        code: this.mapReadeckErrorToLabelError(error.code),
        message: error.message,
        labelId,
        articleId,
        statusCode: error.statusCode,
        details: error.details,
        retryable: error.retryable,
        timestamp: new Date().toISOString(),
      };
      throw labelError;
    } else {
      // Unknown error - wrap in standard format
      const labelError: LabelApiError = {
        code: LabelErrorCode.UNKNOWN_LABEL_ERROR,
        message: `${operation} failed: ${error.message || String(error)}`,
        labelId,
        articleId,
        retryable: false,
        timestamp: new Date().toISOString(),
      };
      throw labelError;
    }
  }

  /**
   * Map ReadeckErrorCode to LabelErrorCode
   * @private
   */
  private mapReadeckErrorToLabelError(readeckCode: string): LabelErrorCode {
    switch (readeckCode) {
      case 'AUTHENTICATION_ERROR':
      case 'AUTHORIZATION_ERROR':
        return LabelErrorCode.UNKNOWN_LABEL_ERROR;
      case 'NETWORK_ERROR':
      case 'CONNECTION_ERROR':
      case 'TIMEOUT_ERROR':
        return LabelErrorCode.UNKNOWN_LABEL_ERROR;
      case 'SERVER_ERROR':
        return LabelErrorCode.UNKNOWN_LABEL_ERROR;
      default:
        return LabelErrorCode.UNKNOWN_LABEL_ERROR;
    }
  }

  /**
   * Cache management methods
   * @private
   */
  private getCachedLabel(id: string): Label | null {
    const entry = this.labelCache.get(id);
    if (!entry) return null;

    const now = Date.now();
    if (entry.expiresAt && now > new Date(entry.expiresAt).getTime()) {
      this.labelCache.delete(id);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = new Date().toISOString();
    return entry.label;
  }

  private cacheLabel(label: Label): void {
    if (this.labelCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries
      const entries = [...this.labelCache.entries()];
      entries.sort(
        (a, b) =>
          new Date(a[1].lastAccessed).getTime() -
          new Date(b[1].lastAccessed).getTime()
      );

      const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE / 4));
      toRemove.forEach(([key]) => this.labelCache.delete(key));
    }

    const entry: LabelCacheEntry = {
      label,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.CACHE_TTL).toISOString(),
      accessCount: 1,
      lastAccessed: new Date().toISOString(),
    };

    this.labelCache.set(label.id, entry);
  }

  private invalidateCache(id?: string): void {
    if (id) {
      this.labelCache.delete(id);
    } else {
      this.labelCache.clear();
    }
  }

  /**
   * Fetch labels with pagination and filtering
   */
  async fetchLabels(
    params: FetchLabelsParams
  ): Promise<PaginatedResponse<Label>> {
    try {
      console.log('[LabelsApiService] Fetching labels with params:', params);

      const filters = this.convertFiltersToReadeckFilters(params);
      const response: ReadeckApiResponse<ReadeckLabelList> =
        await readeckApiService.getLabels(filters);

      // Ensure response.data and response.data.labels exist
      if (!response.data || !response.data.labels || !Array.isArray(response.data.labels)) {
        console.warn('[LabelsApiService] Invalid response structure:', response.data);
        return {
          items: [],
          page: 1,
          totalPages: 1,
          totalItems: 0,
        };
      }

      const labels = response.data.labels.map(readeckLabel => {
        const label = this.convertReadeckLabelToLabel(readeckLabel);
        if (!params.forceRefresh) {
          this.cacheLabel(label);
        }
        return label;
      });

      const paginatedResponse: PaginatedResponse<Label> = {
        items: labels,
        page: response.data.pagination?.page || 1,
        totalPages: response.data.pagination?.total_pages || 1,
        totalItems: response.data.pagination?.total_count || labels.length,
      };

      console.log(
        `[LabelsApiService] Successfully fetched ${labels.length} labels (page ${paginatedResponse.page}/${paginatedResponse.totalPages})`
      );
      return paginatedResponse;
    } catch (error) {
      return this.handleApiError(error, 'Fetch labels');
    }
  }

  /**
   * Create a new label
   */
  async createLabel(params: CreateLabelParams): Promise<Label> {
    try {
      console.log('[LabelsApiService] Creating label:', {
        name: params.name,
        color: params.color,
      });

      const createRequest: CreateLabelRequest = {
        name: params.name,
        color: params.color,
        description: params.description,
      };

      const response: ReadeckApiResponse<ReadeckLabel> =
        await readeckApiService.createLabel(createRequest);

      const label = this.convertReadeckLabelToLabel(response.data);
      this.cacheLabel(label);

      // Invalidate list cache since we added a new label
      this.invalidateCache();

      console.log('[LabelsApiService] Successfully created label:', label.id);
      return label;
    } catch (error) {
      return this.handleApiError(error, 'Create label');
    }
  }

  /**
   * Update an existing label
   */
  async updateLabel(params: UpdateLabelParams): Promise<Label> {
    try {
      console.log('[LabelsApiService] Updating label:', {
        id: params.id,
        updates: Object.keys(params.updates),
      });

      const updateRequest = this.convertLabelToUpdateRequest(params.updates);
      const response: ReadeckApiResponse<ReadeckLabel> =
        await readeckApiService.updateLabel(params.id, updateRequest);

      const label = this.convertReadeckLabelToLabel(response.data);
      this.cacheLabel(label);

      console.log('[LabelsApiService] Successfully updated label:', label.id);
      return label;
    } catch (error) {
      return this.handleApiError(error, 'Update label', params.id);
    }
  }

  /**
   * Delete a label
   */
  async deleteLabel(params: DeleteLabelParams): Promise<void> {
    try {
      console.log('[LabelsApiService] Deleting label:', {
        id: params.id,
        transferTo: params.transferToLabel,
      });

      const deleteParams: any = {};
      if (params.transferToLabel) {
        deleteParams.transfer_to = params.transferToLabel;
      }

      await readeckApiService.deleteLabel(params.id, deleteParams);

      this.invalidateCache(params.id);
      console.log('[LabelsApiService] Successfully deleted label:', params.id);
      return; // Explicitly return void
    } catch (error) {
      throw this.handleApiError(error, 'Delete label', params.id);
    }
  }

  /**
   * Assign a label to an article
   */
  async assignToArticle(params: AssignLabelToArticleParams): Promise<void> {
    try {
      console.log('[LabelsApiService] Assigning label to article:', {
        labelId: params.labelId,
        articleId: params.articleId,
      });

      const assignRequest: AssignLabelRequest = {
        article_id: params.articleId,
        label_id: params.labelId,
      };

      await readeckApiService.assignLabel(assignRequest);

      // Invalidate cache for the affected label
      this.invalidateCache(params.labelId);

      console.log('[LabelsApiService] Successfully assigned label to article');
      return; // Explicitly return void
    } catch (error) {
      throw this.handleApiError(
        error,
        'Assign label to article',
        params.labelId,
        params.articleId
      );
    }
  }

  /**
   * Remove a label from an article
   */
  async removeFromArticle(params: RemoveLabelFromArticleParams): Promise<void> {
    try {
      console.log('[LabelsApiService] Removing label from article:', {
        labelId: params.labelId,
        articleId: params.articleId,
      });

      const removeRequest: RemoveLabelRequest = {
        article_id: params.articleId,
        label_id: params.labelId,
      };

      await readeckApiService.removeLabel(removeRequest);

      // Invalidate cache for the affected label
      this.invalidateCache(params.labelId);

      console.log('[LabelsApiService] Successfully removed label from article');
      return; // Explicitly return void
    } catch (error) {
      throw this.handleApiError(
        error,
        'Remove label from article',
        params.labelId,
        params.articleId
      );
    }
  }

  /**
   * Get a single label by ID
   */
  async getLabel(id: string): Promise<Label> {
    try {
      // Check cache first
      const cachedLabel = this.getCachedLabel(id);
      if (cachedLabel) {
        console.log('[LabelsApiService] Returning cached label:', id);
        return cachedLabel;
      }

      console.log('[LabelsApiService] Fetching label:', id);

      const response: ReadeckApiResponse<ReadeckLabel> =
        await readeckApiService.getLabel(id);

      const label = this.convertReadeckLabelToLabel(response.data);
      this.cacheLabel(label);

      console.log('[LabelsApiService] Successfully fetched label:', label.id);
      return label;
    } catch (error) {
      return this.handleApiError(error, 'Get label', id);
    }
  }

  /**
   * Batch assign/remove labels to/from articles
   */
  async batchAssignLabels(
    params: BatchAssignLabelsParams
  ): Promise<BatchLabelAssignmentResult> {
    try {
      console.log(
        '[LabelsApiService] Batch label operation:',
        params.operation,
        {
          labelIds: params.labelIds.length,
          articleIds: params.articleIds.length,
        }
      );

      const batchRequest: BatchLabelAssignmentRequest = {
        label_ids: params.labelIds,
        article_ids: params.articleIds,
        operation: params.operation,
      };

      const response: ReadeckApiResponse<BatchLabelAssignmentResult> =
        await readeckApiService.batchLabels(batchRequest);

      // Invalidate cache for all affected labels
      params.labelIds.forEach(labelId => this.invalidateCache(labelId));

      console.log(
        `[LabelsApiService] Batch operation completed: ${response.data.successful.length} successful, ${response.data.failed.length} failed`
      );

      return response.data;
    } catch (error) {
      return this.handleApiError(error, 'Batch assign labels');
    }
  }

  /**
   * Get label statistics
   */
  async getLabelStats(): Promise<LabelStats> {
    try {
      console.log('[LabelsApiService] Fetching label statistics');

      const response: ReadeckApiResponse<{
        total_labels: number;
        total_assignments: number;
        most_used: Array<{
          label: ReadeckLabel;
          article_count: number;
        }>;
        unused_count: number;
        average_labels_per_article: number;
      }> = await readeckApiService.getLabelStats();

      const stats: LabelStats = {
        totalLabels: response.data.total_labels,
        totalAssignments: response.data.total_assignments,
        mostUsedLabels: response.data.most_used.map(item => ({
          label: this.convertReadeckLabelToLabel(item.label),
          articleCount: item.article_count,
        })),
        unusedLabels: response.data.unused_count,
        averageLabelsPerArticle: response.data.average_labels_per_article,
      };

      return stats;
    } catch (error) {
      return this.handleApiError(error, 'Get label stats');
    }
  }

  /**
   * Batch update multiple labels
   */
  async batchUpdateLabels(
    updates: Array<{ id: string; updates: Partial<Label> }>
  ): Promise<Label[]> {
    try {
      console.log('[LabelsApiService] Batch updating labels:', updates.length);

      const updatePromises = updates.map(({ id, updates: labelUpdates }) =>
        this.updateLabel({ id, updates: labelUpdates })
      );

      const labels = await Promise.all(updatePromises);

      console.log(
        '[LabelsApiService] Successfully batch updated labels:',
        labels.length
      );
      return labels;
    } catch (error) {
      return this.handleApiError(error, 'Batch update labels');
    }
  }

  /**
   * Batch delete multiple labels
   */
  async batchDeleteLabels(
    ids: string[],
    transferToLabel?: string
  ): Promise<void> {
    try {
      console.log('[LabelsApiService] Batch deleting labels:', ids.length);

      const deletePromises = ids.map(id =>
        this.deleteLabel({ id, transferToLabel })
      );
      await Promise.all(deletePromises);

      console.log(
        '[LabelsApiService] Successfully batch deleted labels:',
        ids.length
      );
    } catch (error) {
      this.handleApiError(error, 'Batch delete labels');
    }
  }

  /**
   * Search labels by name
   */
  async searchLabels(query: string, limit: number = 20): Promise<Label[]> {
    try {
      console.log('[LabelsApiService] Searching labels:', query);

      const response = await this.fetchLabels({
        searchQuery: query,
        limit,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      return response.items;
    } catch (error) {
      return this.handleApiError(error, 'Search labels');
    }
  }

  /**
   * Get labels for a specific article
   */
  async getLabelsForArticle(articleId: string): Promise<Label[]> {
    try {
      console.log('[LabelsApiService] Fetching labels for article:', articleId);

      const response: ReadeckApiResponse<{ labels: ReadeckLabel[] }> =
        await readeckApiService.getArticleLabels(articleId);

      // Ensure response.data and response.data.labels exist
      if (!response.data || !response.data.labels || !Array.isArray(response.data.labels)) {
        console.warn('[LabelsApiService] Invalid article labels response structure:', response.data);
        return [];
      }

      const labels = response.data.labels.map(readeckLabel => {
        const label = this.convertReadeckLabelToLabel(readeckLabel);
        this.cacheLabel(label);
        return label;
      });

      console.log(
        '[LabelsApiService] Successfully fetched labels for article:',
        labels.length
      );
      return labels;
    } catch (error) {
      return this.handleApiError(
        error,
        'Get labels for article',
        undefined,
        articleId
      );
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    console.log('[LabelsApiService] Clearing all caches');
    this.invalidateCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ id: string; accessCount: number; lastAccessed: string }>;
  } {
    const entries = [...this.labelCache.entries()].map(([id, entry]) => ({
      id,
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed,
    }));

    const totalAccesses = entries.reduce(
      (sum, entry) => sum + entry.accessCount,
      0
    );
    const hitRate =
      totalAccesses > 0 ? (entries.length / totalAccesses) * 100 : 0;

    return {
      size: this.labelCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate,
      entries,
    };
  }
}

// Export singleton instance for consistent usage across the app
export const labelsApiService = new LabelsApiService();

// Export class for testing and custom instantiation
export default LabelsApiService;
