/**
 * ShareHandlerService Unit Tests
 * Comprehensive test coverage for URL processing and article creation
 */

import ShareHandlerService, { ShareErrorCode } from '../ShareHandlerService';
import { readeckApiService } from '../ReadeckApiService';
import { validateUrl, extractUrlFromText } from '../../utils/urlValidation';
import { SharedData } from '../../types';

// Mock dependencies
jest.mock('../ReadeckApiService', () => ({
  readeckApiService: {
    createArticleWithMetadata: jest.fn(),
  },
}));
jest.mock('../../utils/urlValidation');
// Mock the ShareModule while preserving other react-native mocks
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn(dict => dict.ios || dict.default),
  },
  Alert: {
    alert: jest.fn(),
  },
  NativeModules: {
    ShareModule: {
      getSharedData: jest.fn(),
      clearSharedData: jest.fn(),
    },
  },
}));

// Type the mocked modules
const mockReadeckApiService = readeckApiService as jest.Mocked<
  typeof readeckApiService
>;
const mockValidateUrl = validateUrl as jest.MockedFunction<typeof validateUrl>;
const mockExtractUrlFromText = extractUrlFromText as jest.MockedFunction<
  typeof extractUrlFromText
>;

// Mock React Native's NativeModules
const { NativeModules } = require('react-native');

describe('ShareHandlerService', () => {
  let service: ShareHandlerService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Suppress console outputs for cleaner test output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Reset ShareModule
    NativeModules.ShareModule = {
      getSharedData: jest.fn(),
      clearSharedData: jest.fn(),
    };

    // Create fresh service instance
    service = new ShareHandlerService();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('processSharedData', () => {
    const mockSharedData: SharedData = {
      text: 'https://example.com/article',
      subject: 'Interesting Article',
      timestamp: Date.now(),
    };

    const mockArticle = {
      id: '123',
      title: 'Test Article',
      url: 'https://example.com/article',
      summary: 'Test summary',
      content: 'Test content',
      isArchived: false,
      isFavorite: false,
      isRead: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    beforeEach(() => {
      // Setup default successful mocks
      NativeModules.ShareModule.getSharedData.mockResolvedValue(mockSharedData);
      NativeModules.ShareModule.clearSharedData.mockResolvedValue(true);
      mockValidateUrl.mockReturnValue({
        isValid: true,
        normalizedUrl: 'https://example.com/article',
        errors: [],
        warnings: [],
      });
      mockReadeckApiService.createArticleWithMetadata.mockResolvedValue(mockArticle);
    });

    it('should successfully process shared data with valid URL', async () => {
      const result = await service.processSharedData();

      expect(result.success).toBe(true);
      expect(result.article).toEqual(mockArticle);
      expect(NativeModules.ShareModule.getSharedData).toHaveBeenCalled();
      expect(mockValidateUrl).toHaveBeenCalledWith(
        'https://example.com/article',
        expect.any(Object)
      );
      expect(mockReadeckApiService.createArticleWithMetadata).toHaveBeenCalledWith({
        url: 'https://example.com/article',
        title: 'Interesting Article',
      });
      expect(NativeModules.ShareModule.clearSharedData).toHaveBeenCalled();
    });

    it('should handle no shared data available', async () => {
      NativeModules.ShareModule.getSharedData.mockResolvedValue(null);

      const result = await service.processSharedData();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ShareErrorCode.NO_SHARED_DATA);
      expect(result.error?.message).toBe('No shared data available');
    });

    it('should handle URL validation failure', async () => {
      mockValidateUrl.mockReturnValue({
        isValid: false,
        errors: ['Invalid URL format'],
        warnings: [],
      });

      const result = await service.processSharedData();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ShareErrorCode.URL_VALIDATION_FAILED);
      expect(result.validationResult?.validationErrors).toEqual([
        'Invalid URL format',
      ]);
    });

    it('should extract URL from text when configured', async () => {
      const textWithUrl =
        'Check out this article: https://example.com/article and let me know what you think!';
      NativeModules.ShareModule.getSharedData.mockResolvedValue({
        ...mockSharedData,
        text: textWithUrl,
      });
      mockExtractUrlFromText.mockReturnValue('https://example.com/article');

      const result = await service.processSharedData();

      expect(result.success).toBe(true);
      expect(mockExtractUrlFromText).toHaveBeenCalledWith(textWithUrl);
      expect(result.validationResult?.extractedUrl).toBe(
        'https://example.com/article'
      );
    });

    it('should handle no URL found in text', async () => {
      NativeModules.ShareModule.getSharedData.mockResolvedValue({
        ...mockSharedData,
        text: 'This is just plain text with no URL',
      });
      mockExtractUrlFromText.mockReturnValue(null);

      const result = await service.processSharedData();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ShareErrorCode.NO_URL_FOUND);
    });

    it('should handle API errors with retry logic', async () => {
      const networkError = {
        code: 'NETWORK_ERROR',
        message: 'Network error',
        statusCode: 500,
      };
      mockReadeckApiService.createArticleWithMetadata
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue(mockArticle);

      const result = await service.processSharedData();

      expect(result.success).toBe(true);
      expect(mockReadeckApiService.createArticleWithMetadata).toHaveBeenCalledTimes(3);
    });

    it('should handle non-retryable errors', async () => {
      const apiError = {
        message: 'Article with this URL already exists as duplicate',
        statusCode: 409,
      };
      mockReadeckApiService.createArticleWithMetadata.mockRejectedValue(apiError);

      const result = await service.processSharedData();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ShareErrorCode.DUPLICATE_ARTICLE);
      expect(mockReadeckApiService.createArticleWithMetadata).toHaveBeenCalledTimes(1);
    });

    it('should handle quota exceeded errors', async () => {
      const apiError = {
        message: 'Quota exceeded',
        statusCode: 429,
      };
      mockReadeckApiService.createArticleWithMetadata.mockRejectedValue(apiError);

      const result = await service.processSharedData();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ShareErrorCode.QUOTA_EXCEEDED);
    });

    it('should handle share module errors', async () => {
      const shareModuleError = new Error('Native module error');
      NativeModules.ShareModule.getSharedData.mockRejectedValue(
        shareModuleError
      );

      const result = await service.processSharedData();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ShareErrorCode.PROCESSING_ERROR);
      expect(result.error?.message).toMatch(/Unexpected error/);
    });
  });

  describe('processUrl', () => {
    const mockArticle = {
      id: '123',
      title: 'Test Article',
      url: 'https://example.com/article',
      summary: 'Test summary',
      content: 'Test content',
      isArchived: false,
      isFavorite: false,
      isRead: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockValidateUrl.mockReturnValue({
        isValid: true,
        normalizedUrl: 'https://example.com/article',
        errors: [],
        warnings: [],
      });
      mockReadeckApiService.createArticleWithMetadata.mockResolvedValue(mockArticle);
    });

    it('should process URL directly with custom title', async () => {
      const result = await service.processUrl(
        'https://example.com/article',
        'Custom Title'
      );

      expect(result.success).toBe(true);
      expect(result.article).toEqual(mockArticle);
      expect(mockReadeckApiService.createArticleWithMetadata).toHaveBeenCalledWith({
        url: 'https://example.com/article',
        title: 'Custom Title',
      });
    });

    it('should process URL with auto-generated title', async () => {
      const result = await service.processUrl('https://example.com/article');

      expect(result.success).toBe(true);
      expect(mockReadeckApiService.createArticleWithMetadata).toHaveBeenCalledWith({
        url: 'https://example.com/article',
        title: 'Article from example.com',
      });
    });

    it('should handle invalid URL in direct processing', async () => {
      mockValidateUrl.mockReturnValue({
        isValid: false,
        errors: ['Invalid URL format'],
        warnings: [],
      });
      mockExtractUrlFromText.mockReturnValue('invalid-url'); // Ensure URL extraction works

      const result = await service.processUrl('invalid-url');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ShareErrorCode.URL_VALIDATION_FAILED);
    });
  });

  describe('configuration', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        urlValidation: {
          requireHttps: true,
          maxUrlLength: 1000,
        },
        networking: {
          timeout: 60000,
          retryAttempts: 5,
        },
      };

      service.updateConfig(newConfig);
      const currentConfig = service.getConfig();

      expect(currentConfig.urlValidation.requireHttps).toBe(true);
      expect(currentConfig.urlValidation.maxUrlLength).toBe(1000);
      expect(currentConfig.networking.timeout).toBe(60000);
      expect(currentConfig.networking.retryAttempts).toBe(5);
    });

    it('should return current configuration', () => {
      const config = service.getConfig();

      expect(config).toHaveProperty('urlValidation');
      expect(config).toHaveProperty('autoProcessing');
      expect(config).toHaveProperty('networking');
      expect(config).toHaveProperty('processing');
    });
  });

  describe('share module availability', () => {
    it('should detect share module availability', () => {
      expect(service.isShareModuleAvailable()).toBe(true);
    });

    it('should handle missing share module', () => {
      // Create service with no share module
      NativeModules.ShareModule = null;
      const serviceWithoutModule = new ShareHandlerService();

      expect(serviceWithoutModule.isShareModuleAvailable()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      NativeModules.ShareModule.getSharedData.mockResolvedValue({
        text: 'https://example.com/article',
        timestamp: Date.now(),
      });

      // Make validateUrl throw an unexpected error
      mockValidateUrl.mockImplementation(() => {
        throw new Error('Unexpected validation error');
      });

      const result = await service.processSharedData();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ShareErrorCode.PROCESSING_ERROR);
      expect(result.error?.message).toMatch(/Unexpected error/);
    });

    it('should handle malformed shared data', async () => {
      NativeModules.ShareModule.getSharedData.mockResolvedValue({
        text: '',
        timestamp: Date.now(),
      });
      mockExtractUrlFromText.mockReturnValue(null); // No URL found

      const result = await service.processSharedData();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ShareErrorCode.NO_URL_FOUND);
    });
  });

  describe('retry logic', () => {
    it('should retry network errors with exponential backoff', async () => {
      const networkError = { code: 'NETWORK_ERROR', message: 'Network error' };

      mockReadeckApiService.createArticleWithMetadata
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({
          id: '123',
          title: 'Test Article',
          url: 'https://example.com/article',
          summary: 'Test summary',
          content: 'Test content',
          isArchived: false,
          isFavorite: false,
          isRead: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        });

      NativeModules.ShareModule.getSharedData.mockResolvedValue({
        text: 'https://example.com/article',
        timestamp: Date.now(),
      });

      mockValidateUrl.mockReturnValue({
        isValid: true,
        normalizedUrl: 'https://example.com/article',
        errors: [],
        warnings: [],
      });

      const result = await service.processSharedData();

      expect(result.success).toBe(true);
      expect(mockReadeckApiService.createArticleWithMetadata).toHaveBeenCalledTimes(3);
    });

    it('should give up after max retries', async () => {
      const networkError = { code: 'NETWORK_ERROR', message: 'Network error' };
      mockReadeckApiService.createArticleWithMetadata.mockRejectedValue(networkError);

      NativeModules.ShareModule.getSharedData.mockResolvedValue({
        text: 'https://example.com/article',
        timestamp: Date.now(),
      });

      mockValidateUrl.mockReturnValue({
        isValid: true,
        normalizedUrl: 'https://example.com/article',
        errors: [],
        warnings: [],
      });

      const result = await service.processSharedData();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ShareErrorCode.NETWORK_ERROR);
      expect(mockReadeckApiService.createArticleWithMetadata).toHaveBeenCalledTimes(3); // Default retry attempts
    });
  });

  describe('validation warnings', () => {
    it('should include validation warnings in result', async () => {
      NativeModules.ShareModule.getSharedData.mockResolvedValue({
        text: 'http://example.com/article', // HTTP instead of HTTPS
        timestamp: Date.now(),
      });

      mockValidateUrl.mockReturnValue({
        isValid: true,
        normalizedUrl: 'http://example.com/article',
        errors: [],
        warnings: ['Using HTTP instead of HTTPS may be insecure'],
      });

      mockReadeckApiService.createArticleWithMetadata.mockResolvedValue({
        id: '123',
        title: 'Test Article',
        url: 'http://example.com/article',
        summary: 'Test summary',
        content: 'Test content',
        isArchived: false,
        isFavorite: false,
        isRead: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      const result = await service.processSharedData();

      expect(result.success).toBe(true);
      expect(result.validationResult?.validationWarnings).toContain(
        'Using HTTP instead of HTTPS may be insecure'
      );
    });
  });
});
