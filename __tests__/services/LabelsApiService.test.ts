/**
 * LabelsApiService Unit Tests
 * Comprehensive test suite for labels API service operations
 */

import { readeckApiService } from '../../src/services/ReadeckApiService';
import LabelsApiService, {
  labelsApiService,
} from '../../src/services/LabelsApiService';
import {
  Label,
  ReadeckLabel,
  ReadeckLabelList,
  LabelApiError,
  LabelErrorCode,
  BatchLabelAssignmentResult,
  LabelStats,
} from '../../src/types/labels';
import { ReadeckApiResponse, ReadeckApiError } from '../../src/types/readeck';

// Mock the ReadeckApiService
jest.mock('../../src/services/ReadeckApiService', () => ({
  readeckApiService: {
    getLabels: jest.fn(),
    createLabel: jest.fn(),
    updateLabel: jest.fn(),
    deleteLabel: jest.fn(),
    getLabel: jest.fn(),
    assignLabel: jest.fn(),
    removeLabel: jest.fn(),
    batchLabels: jest.fn(),
    getLabelStats: jest.fn(),
    getArticleLabels: jest.fn(),
  },
}));

const mockReadeckApiService = readeckApiService as jest.Mocked<
  typeof readeckApiService
>;

describe('LabelsApiService', () => {
  let service: LabelsApiService;

  beforeEach(() => {
    service = new LabelsApiService();
    jest.clearAllMocks();
    // Clear cache before each test
    service.clearCache();
  });

  // Mock data
  const mockReadeckLabel: ReadeckLabel = {
    id: '1',
    name: 'Technology',
    color: '#007AFF',
    description: 'Tech related articles',
    article_count: 15,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  const mockLabel: Label = {
    id: '1',
    name: 'Technology',
    color: '#007AFF',
    description: 'Tech related articles',
    articleCount: 15,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  };

  const mockReadeckLabelList: ReadeckLabelList = {
    labels: [mockReadeckLabel],
    pagination: {
      page: 1,
      per_page: 50,
      total_pages: 1,
      total_count: 1,
    },
  };

  const mockApiResponse: ReadeckApiResponse<ReadeckLabelList> = {
    data: mockReadeckLabelList,
    status: 200,
    headers: {},
    timestamp: '2023-01-01T00:00:00Z',
  };

  describe('fetchLabels', () => {
    it('should fetch labels successfully with default parameters', async () => {
      mockReadeckApiService.getLabels.mockResolvedValue(mockApiResponse);

      const result = await service.fetchLabels({});

      expect(mockReadeckApiService.getLabels).toHaveBeenCalledWith({
        page: 1,
        per_page: 50,
        sort_by: 'name',
        sort_order: 'asc',
      });

      expect(result).toEqual({
        items: [mockLabel],
        page: 1,
        totalPages: 1,
        totalItems: 1,
      });
    });

    it('should fetch labels with custom parameters', async () => {
      mockReadeckApiService.getLabels.mockResolvedValue(mockApiResponse);

      const params = {
        page: 2,
        limit: 25,
        searchQuery: 'tech',
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
        includeEmpty: true,
      };

      await service.fetchLabels(params);

      expect(mockReadeckApiService.getLabels).toHaveBeenCalledWith({
        page: 2,
        per_page: 25,
        search: 'tech',
        sort_by: 'created_at',
        sort_order: 'desc',
        include_empty: true,
      });
    });

    it('should handle API errors properly', async () => {
      const apiError: ReadeckApiError = {
        code: 'NETWORK_ERROR' as any,
        message: 'Network connection failed',
        retryable: true,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.getLabels.mockRejectedValue(apiError);

      await expect(service.fetchLabels({})).rejects.toMatchObject({
        code: LabelErrorCode.UNKNOWN_LABEL_ERROR,
        message: 'Network connection failed',
        retryable: true,
      });
    });
  });

  describe('createLabel', () => {
    it('should create a label successfully', async () => {
      const createResponse: ReadeckApiResponse<ReadeckLabel> = {
        data: mockReadeckLabel,
        status: 201,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.createLabel.mockResolvedValue(createResponse);

      const params = {
        name: 'Technology',
        color: '#007AFF',
        description: 'Tech related articles',
      };

      const result = await service.createLabel(params);

      expect(mockReadeckApiService.createLabel).toHaveBeenCalledWith({
        name: 'Technology',
        color: '#007AFF',
        description: 'Tech related articles',
      });

      expect(result).toEqual(mockLabel);
    });

    it('should handle duplicate label error', async () => {
      const apiError: ReadeckApiError = {
        code: 'SERVER_ERROR' as any,
        message: 'Label already exists',
        statusCode: 400,
        retryable: false,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.createLabel.mockRejectedValue(apiError);

      await expect(
        service.createLabel({ name: 'Technology' })
      ).rejects.toMatchObject({
        code: LabelErrorCode.UNKNOWN_LABEL_ERROR,
        message: 'Label already exists',
        retryable: false,
      });
    });
  });

  describe('updateLabel', () => {
    it('should update a label successfully', async () => {
      const updateResponse: ReadeckApiResponse<ReadeckLabel> = {
        data: { ...mockReadeckLabel, name: 'Updated Technology' },
        status: 200,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.updateLabel.mockResolvedValue(updateResponse);

      const params = {
        id: '1',
        updates: { name: 'Updated Technology' },
      };

      const result = await service.updateLabel(params);

      expect(mockReadeckApiService.updateLabel).toHaveBeenCalledWith('1', {
        name: 'Updated Technology',
      });
      expect(result.name).toBe('Updated Technology');
    });

    it('should handle label not found error', async () => {
      const apiError: ReadeckApiError = {
        code: 'SERVER_ERROR' as any,
        message: 'Label not found',
        statusCode: 404,
        retryable: false,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.updateLabel.mockRejectedValue(apiError);

      await expect(
        service.updateLabel({ id: '999', updates: { name: 'Test' } })
      ).rejects.toMatchObject({
        code: LabelErrorCode.UNKNOWN_LABEL_ERROR,
        labelId: '999',
      });
    });
  });

  describe('deleteLabel', () => {
    it('should delete a label successfully', async () => {
      mockReadeckApiService.deleteLabel.mockResolvedValue({
        data: undefined,
        status: 204,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      });

      await service.deleteLabel({ id: '1' });

      expect(mockReadeckApiService.deleteLabel).toHaveBeenCalledWith('1', {});
    });

    it('should delete a label with transfer option', async () => {
      mockReadeckApiService.deleteLabel.mockResolvedValue({
        data: undefined,
        status: 204,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      });

      await service.deleteLabel({ id: '1', transferToLabel: '2' });

      expect(mockReadeckApiService.deleteLabel).toHaveBeenCalledWith('1', {
        transfer_to: '2',
      });
    });
  });

  describe('assignToArticle', () => {
    it('should assign label to article successfully', async () => {
      mockReadeckApiService.assignLabel.mockResolvedValue({
        data: undefined,
        status: 200,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      });

      await service.assignToArticle({ labelId: '1', articleId: 'article-1' });

      expect(mockReadeckApiService.assignLabel).toHaveBeenCalledWith({
        label_id: '1',
        article_id: 'article-1',
      });
    });

    it('should handle assignment error', async () => {
      const apiError: ReadeckApiError = {
        code: 'SERVER_ERROR' as any,
        message: 'Assignment failed',
        retryable: false,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.assignLabel.mockRejectedValue(apiError);

      await expect(
        service.assignToArticle({ labelId: '1', articleId: 'article-1' })
      ).rejects.toMatchObject({
        code: LabelErrorCode.UNKNOWN_LABEL_ERROR,
        labelId: '1',
        articleId: 'article-1',
      });
    });
  });

  describe('removeFromArticle', () => {
    it('should remove label from article successfully', async () => {
      mockReadeckApiService.removeLabel.mockResolvedValue({
        data: undefined,
        status: 200,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      });

      await service.removeFromArticle({ labelId: '1', articleId: 'article-1' });

      expect(mockReadeckApiService.removeLabel).toHaveBeenCalledWith({
        label_id: '1',
        article_id: 'article-1',
      });
    });
  });

  describe('getLabel', () => {
    it('should get a single label successfully', async () => {
      const getResponse: ReadeckApiResponse<ReadeckLabel> = {
        data: mockReadeckLabel,
        status: 200,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.getLabel.mockResolvedValue(getResponse);

      const result = await service.getLabel('1');

      expect(mockReadeckApiService.getLabel).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockLabel);
    });

    it('should return cached label when available', async () => {
      // First call to cache the label
      const getResponse: ReadeckApiResponse<ReadeckLabel> = {
        data: mockReadeckLabel,
        status: 200,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.getLabel.mockResolvedValue(getResponse);
      await service.getLabel('1');

      // Clear mock calls
      mockReadeckApiService.getLabel.mockClear();

      // Second call should use cache
      const result = await service.getLabel('1');

      expect(mockReadeckApiService.getLabel).not.toHaveBeenCalled();
      expect(result).toEqual(mockLabel);
    });
  });

  describe('batchAssignLabels', () => {
    it('should perform batch label assignment successfully', async () => {
      const batchResult: BatchLabelAssignmentResult = {
        successful: [
          { article_id: 'article-1', label_id: '1' },
          { article_id: 'article-2', label_id: '1' },
        ],
        failed: [],
        totalProcessed: 2,
      };

      const batchResponse: ReadeckApiResponse<BatchLabelAssignmentResult> = {
        data: batchResult,
        status: 200,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.batchLabels.mockResolvedValue(batchResponse);

      const result = await service.batchAssignLabels({
        operation: 'assign',
        labelIds: ['1'],
        articleIds: ['article-1', 'article-2'],
      });

      expect(mockReadeckApiService.batchLabels).toHaveBeenCalledWith({
        label_ids: ['1'],
        article_ids: ['article-1', 'article-2'],
        operation: 'assign',
      });

      expect(result).toEqual(batchResult);
    });
  });

  describe('getLabelStats', () => {
    it('should get label statistics successfully', async () => {
      const statsData = {
        total_labels: 10,
        total_assignments: 50,
        most_used: [
          {
            label: mockReadeckLabel,
            article_count: 15,
          },
        ],
        unused_count: 2,
        average_labels_per_article: 2.5,
      };

      const statsResponse: ReadeckApiResponse<typeof statsData> = {
        data: statsData,
        status: 200,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.getLabelStats.mockResolvedValue(statsResponse);

      const result = await service.getLabelStats();

      expect(mockReadeckApiService.getLabelStats).toHaveBeenCalled();

      expect(result).toEqual({
        totalLabels: 10,
        totalAssignments: 50,
        mostUsedLabels: [
          {
            label: mockLabel,
            articleCount: 15,
          },
        ],
        unusedLabels: 2,
        averageLabelsPerArticle: 2.5,
      });
    });
  });

  describe('searchLabels', () => {
    it('should search labels successfully', async () => {
      mockReadeckApiService.getLabels.mockResolvedValue(mockApiResponse);

      const result = await service.searchLabels('tech', 10);

      expect(mockReadeckApiService.getLabels).toHaveBeenCalledWith({
        page: 1,
        per_page: 10,
        search: 'tech',
        sort_by: 'name',
        sort_order: 'asc',
      });

      expect(result).toEqual([mockLabel]);
    });
  });

  describe('getLabelsForArticle', () => {
    it('should get labels for article successfully', async () => {
      const articleLabelsResponse: ReadeckApiResponse<{
        labels: ReadeckLabel[];
      }> = {
        data: { labels: [mockReadeckLabel] },
        status: 200,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.getArticleLabels.mockResolvedValue(
        articleLabelsResponse
      );

      const result = await service.getLabelsForArticle('article-1');

      expect(mockReadeckApiService.getArticleLabels).toHaveBeenCalledWith(
        'article-1'
      );
      expect(result).toEqual([mockLabel]);
    });
  });

  describe('Cache Management', () => {
    it('should cache labels properly', async () => {
      const getResponse: ReadeckApiResponse<ReadeckLabel> = {
        data: mockReadeckLabel,
        status: 200,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.getLabel.mockResolvedValue(getResponse);

      // First call
      await service.getLabel('1');
      expect(mockReadeckApiService.getLabel).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await service.getLabel('1');
      expect(mockReadeckApiService.getLabel).toHaveBeenCalledTimes(1);
    });

    it('should clear cache properly', async () => {
      const getResponse: ReadeckApiResponse<ReadeckLabel> = {
        data: mockReadeckLabel,
        status: 200,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.getLabel.mockResolvedValue(getResponse);

      // Cache the label
      await service.getLabel('1');

      // Clear cache
      service.clearCache();

      // Should make API request again
      await service.getLabel('1');
      expect(mockReadeckApiService.getLabel).toHaveBeenCalledTimes(2);
    });

    it('should provide cache statistics', () => {
      const stats = service.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('entries');
      expect(Array.isArray(stats.entries)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown errors gracefully', async () => {
      const unknownError = new Error('Something went wrong');
      mockReadeckApiService.getLabels.mockRejectedValue(unknownError);

      await expect(service.fetchLabels({})).rejects.toMatchObject({
        code: LabelErrorCode.UNKNOWN_LABEL_ERROR,
        message: 'Fetch labels failed: Something went wrong',
      });
    });

    it('should preserve error context in label operations', async () => {
      const apiError: ReadeckApiError = {
        code: 'SERVER_ERROR' as any,
        message: 'Server error',
        statusCode: 500,
        retryable: true,
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.updateLabel.mockRejectedValue(apiError);

      await expect(
        service.updateLabel({ id: 'test-id', updates: { name: 'Test' } })
      ).rejects.toMatchObject({
        labelId: 'test-id',
        statusCode: 500,
        retryable: true,
      });
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(labelsApiService).toBeInstanceOf(LabelsApiService);
    });

    it('should maintain state across singleton usage', async () => {
      const getResponse: ReadeckApiResponse<ReadeckLabel> = {
        data: mockReadeckLabel,
        status: 200,
        headers: {},
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockReadeckApiService.getLabel.mockResolvedValue(getResponse);

      // Use singleton to cache a label
      await labelsApiService.getLabel('1');

      // Clear mock
      mockReadeckApiService.getLabel.mockClear();

      // Second call should use cache
      await labelsApiService.getLabel('1');
      expect(mockReadeckApiService.getLabel).not.toHaveBeenCalled();
    });
  });
});
