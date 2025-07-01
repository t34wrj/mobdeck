/**
 * Share Handler Service
 * Processes shared URLs from Android share intents and adds them to Readeck
 */

import { articlesApiService, CreateArticleParams } from './ArticlesApiService';
import {
  validateUrl,
  extractUrlFromText,
  isLikelyArticleUrl,
  UrlValidationOptions,
} from '../utils/urlValidation';
import { SharedData, ShareModuleInterface } from '../types';
import { Article, AppError, ErrorCode } from '../types';
import { NativeModules } from 'react-native';

export interface ShareProcessingResult {
  success: boolean;
  article?: Article;
  error?: ShareHandlerError;
  validationResult?: {
    originalText: string;
    extractedUrl?: string;
    validationErrors: string[];
    validationWarnings: string[];
  };
}

export interface ShareHandlerError {
  code: ShareErrorCode;
  message: string;
  details?: any;
  retryable: boolean;
  timestamp: string;
}

export enum ShareErrorCode {
  NO_SHARED_DATA = 'NO_SHARED_DATA',
  NO_URL_FOUND = 'NO_URL_FOUND',
  INVALID_URL = 'INVALID_URL',
  URL_VALIDATION_FAILED = 'URL_VALIDATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  DUPLICATE_ARTICLE = 'DUPLICATE_ARTICLE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  SHARE_MODULE_ERROR = 'SHARE_MODULE_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ShareHandlerConfig {
  urlValidation: UrlValidationOptions;
  autoProcessing: {
    enabled: boolean;
    requireHttps: boolean;
    skipNonArticleUrls: boolean;
  };
  networking: {
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  processing: {
    maxUrlLength: number;
    extractUrlFromText: boolean;
    validateArticleUrl: boolean;
  };
}

const DEFAULT_CONFIG: ShareHandlerConfig = {
  urlValidation: {
    allowedProtocols: ['http', 'https'],
    requireHttps: false,
    maxUrlLength: 2048,
    validateDomain: true,
    blockedDomains: [],
    allowedDomains: [],
  },
  autoProcessing: {
    enabled: true,
    requireHttps: false,
    skipNonArticleUrls: false,
  },
  networking: {
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  processing: {
    maxUrlLength: 2048,
    extractUrlFromText: true,
    validateArticleUrl: true,
  },
};

/**
 * ShareHandlerService - Processes shared URLs and adds them to Readeck
 *
 * Features:
 * - URL extraction from shared text
 * - Comprehensive URL validation and security checks
 * - Integration with ArticlesApiService
 * - Error handling with detailed error reporting
 * - Retry logic for network failures
 * - Configuration options for different use cases
 */
class ShareHandlerService {
  private config: ShareHandlerConfig;
  private shareModule: ShareModuleInterface | null = null;

  constructor(config: Partial<ShareHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeShareModule();
  }

  /**
   * Initialize the native share module
   */
  private initializeShareModule(): void {
    try {
      const { ShareModule } = NativeModules;
      if (ShareModule && typeof ShareModule.getSharedData === 'function') {
        this.shareModule = ShareModule as ShareModuleInterface;
        console.log(
          '[ShareHandlerService] Share module initialized successfully'
        );
      } else {
        console.warn(
          '[ShareHandlerService] Share module not available - running in simulator or module not linked'
        );
      }
    } catch (error) {
      console.error(
        '[ShareHandlerService] Failed to initialize share module:',
        error
      );
    }
  }

  /**
   * Process shared data and add URL to Readeck
   */
  async processSharedData(): Promise<ShareProcessingResult> {
    try {
      console.log('[ShareHandlerService] Processing shared data');

      // Get shared data from native module
      const sharedData = await this.getSharedData();
      if (!sharedData) {
        return this.createErrorResult(
          ShareErrorCode.NO_SHARED_DATA,
          'No shared data available'
        );
      }

      console.log('[ShareHandlerService] Received shared data:', {
        textLength: sharedData.text?.length || 0,
        timestamp: sharedData.timestamp,
      });

      // Extract and validate URL
      const urlExtractionResult = await this.extractAndValidateUrl(
        sharedData.text
      );
      if (!urlExtractionResult.success) {
        return {
          success: false,
          error: urlExtractionResult.error,
          validationResult: urlExtractionResult.validationResult,
        };
      }

      const { url, validationResult } = urlExtractionResult;

      // Create article in Readeck
      const articleResult = await this.createArticleWithRetry({
        url,
        title: this.extractTitleFromSharedData(sharedData),
      });

      if (!articleResult.success) {
        return {
          success: false,
          error: articleResult.error,
          validationResult,
        };
      }

      // Clear shared data after successful processing
      await this.clearSharedData();

      console.log(
        '[ShareHandlerService] Successfully processed shared URL:',
        url
      );

      return {
        success: true,
        article: articleResult.article,
        validationResult,
      };
    } catch (error) {
      console.error(
        '[ShareHandlerService] Unexpected error processing shared data:',
        error
      );
      return this.createErrorResult(
        ShareErrorCode.PROCESSING_ERROR,
        'Unexpected error occurred while processing shared data',
        error
      );
    }
  }

  /**
   * Extract and validate URL from shared text
   */
  private async extractAndValidateUrl(text: string): Promise<{
    success: boolean;
    url?: string;
    error?: ShareHandlerError;
    validationResult?: {
      originalText: string;
      extractedUrl?: string;
      validationErrors: string[];
      validationWarnings: string[];
    };
  }> {
    const validationResult = {
      originalText: text,
      extractedUrl: undefined as string | undefined,
      validationErrors: [] as string[],
      validationWarnings: [] as string[],
    };

    try {
      // Extract URL from text if needed
      let url = text;
      if (this.config.processing.extractUrlFromText) {
        const extractedUrl = extractUrlFromText(text);
        if (extractedUrl) {
          url = extractedUrl;
          validationResult.extractedUrl = extractedUrl;
        } else if (!text.match(/^https?:\/\//i)) {
          validationResult.validationErrors.push(
            'No valid URL found in shared text'
          );
          return {
            success: false,
            error: this.createError(
              ShareErrorCode.NO_URL_FOUND,
              'No valid URL found in shared text'
            ),
            validationResult,
          };
        }
      }

      if (!url || !url.trim()) {
        validationResult.validationErrors.push('Empty URL provided');
        return {
          success: false,
          error: this.createError(
            ShareErrorCode.INVALID_URL,
            'Empty URL provided'
          ),
          validationResult,
        };
      }

      // Validate URL
      const validation = validateUrl(url, this.config.urlValidation);
      validationResult.validationErrors = validation.errors;
      validationResult.validationWarnings = validation.warnings;

      if (!validation.isValid) {
        console.log(
          '[ShareHandlerService] URL validation failed:',
          validation.errors
        );
        return {
          success: false,
          error: this.createError(
            ShareErrorCode.URL_VALIDATION_FAILED,
            `URL validation failed: ${validation.errors.join(', ')}`,
            { validationErrors: validation.errors, url }
          ),
          validationResult,
        };
      }

      const normalizedUrl = validation.normalizedUrl || url;

      // Check if URL looks like an article (if enabled)
      if (
        this.config.processing.validateArticleUrl &&
        this.config.autoProcessing.skipNonArticleUrls
      ) {
        if (!isLikelyArticleUrl(normalizedUrl)) {
          validationResult.validationWarnings.push('URL may not be an article');
          console.log(
            '[ShareHandlerService] URL may not be an article, but processing anyway:',
            normalizedUrl
          );
        }
      }

      return {
        success: true,
        url: normalizedUrl,
        validationResult,
      };
    } catch (error) {
      console.error(
        '[ShareHandlerService] Error during URL extraction/validation:',
        error
      );
      validationResult.validationErrors.push(
        'Unexpected error during URL processing'
      );
      return {
        success: false,
        error: this.createError(
          ShareErrorCode.PROCESSING_ERROR,
          'Unexpected error during URL processing',
          error
        ),
        validationResult,
      };
    }
  }

  /**
   * Create article with retry logic
   */
  private async createArticleWithRetry(params: CreateArticleParams): Promise<{
    success: boolean;
    article?: Article;
    error?: ShareHandlerError;
  }> {
    let lastError: any;

    for (
      let attempt = 1;
      attempt <= this.config.networking.retryAttempts;
      attempt++
    ) {
      try {
        console.log(
          `[ShareHandlerService] Creating article (attempt ${attempt}/${this.config.networking.retryAttempts}):`,
          params.url
        );

        const article = await articlesApiService.createArticle(params);

        console.log(
          '[ShareHandlerService] Article created successfully:',
          article.id
        );
        return {
          success: true,
          article,
        };
      } catch (error: any) {
        lastError = error;

        console.error(
          `[ShareHandlerService] Article creation failed (attempt ${attempt}):`,
          error
        );

        // Check if error is retryable
        if (
          !this.isRetryableError(error) ||
          attempt === this.config.networking.retryAttempts
        ) {
          break;
        }

        // Wait before retry
        if (attempt < this.config.networking.retryAttempts) {
          const delay =
            this.config.networking.retryDelay * Math.pow(2, attempt - 1);
          console.log(
            `[ShareHandlerService] Waiting ${delay}ms before retry...`
          );
          await this.delay(delay);
        }
      }
    }

    // Convert API error to ShareHandlerError
    const shareError = this.convertApiErrorToShareError(lastError);
    return {
      success: false,
      error: shareError,
    };
  }

  /**
   * Get shared data from native module
   */
  private async getSharedData(): Promise<SharedData | null> {
    try {
      if (!this.shareModule) {
        console.warn('[ShareHandlerService] Share module not available');
        return null;
      }

      const sharedData = await this.shareModule.getSharedData();
      return sharedData;
    } catch (error) {
      console.error('[ShareHandlerService] Error getting shared data:', error);
      throw this.createError(
        ShareErrorCode.SHARE_MODULE_ERROR,
        'Failed to get shared data from native module',
        error
      );
    }
  }

  /**
   * Clear shared data from native module
   */
  private async clearSharedData(): Promise<void> {
    try {
      if (!this.shareModule) {
        return;
      }

      await this.shareModule.clearSharedData();
      console.log('[ShareHandlerService] Shared data cleared');
    } catch (error) {
      console.error('[ShareHandlerService] Error clearing shared data:', error);
      // Don't throw here as it's not critical to the main flow
    }
  }

  /**
   * Extract title from shared data
   */
  private extractTitleFromSharedData(sharedData: SharedData): string {
    // Use subject if available, otherwise try to extract from URL
    if (sharedData.subject && sharedData.subject.trim()) {
      return sharedData.subject.trim();
    }

    // Extract domain name as fallback title
    try {
      const url = extractUrlFromText(sharedData.text) || sharedData.text;
      const parsedUrl = new URL(url);
      return `Article from ${parsedUrl.hostname}`;
    } catch {
      return 'Shared Article';
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors are typically retryable
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT_ERROR') {
      return true;
    }

    // Server errors (5xx) are retryable
    if (error.statusCode && error.statusCode >= 500) {
      return true;
    }

    // Rate limiting is retryable with backoff
    if (error.statusCode === 429 || error.code === 'RATE_LIMITED') {
      return true;
    }

    return false;
  }

  /**
   * Convert API error to ShareHandlerError
   */
  private convertApiErrorToShareError(error: any): ShareHandlerError {
    if (error.message && error.message.includes('duplicate')) {
      return this.createError(
        ShareErrorCode.DUPLICATE_ARTICLE,
        'Article already exists in Readeck',
        error
      );
    }

    if (error.statusCode === 429 || error.message?.includes('quota')) {
      return this.createError(
        ShareErrorCode.QUOTA_EXCEEDED,
        'API quota exceeded',
        error
      );
    }

    if (error.code === 'NETWORK_ERROR' || error.message?.includes('network')) {
      return this.createError(
        ShareErrorCode.NETWORK_ERROR,
        'Network error occurred',
        error
      );
    }

    return this.createError(
      ShareErrorCode.API_ERROR,
      error.message || 'API error occurred',
      error
    );
  }

  /**
   * Create ShareHandlerError
   */
  private createError(
    code: ShareErrorCode,
    message: string,
    details?: any
  ): ShareHandlerError {
    return {
      code,
      message,
      details,
      retryable: this.isRetryableError({
        code,
        statusCode: details?.statusCode,
      }),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create error result
   */
  private createErrorResult(
    code: ShareErrorCode,
    message: string,
    details?: any
  ): ShareProcessingResult {
    return {
      success: false,
      error: this.createError(code, message, details),
    };
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<ShareHandlerConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[ShareHandlerService] Configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): ShareHandlerConfig {
    return { ...this.config };
  }

  /**
   * Check if share module is available
   */
  isShareModuleAvailable(): boolean {
    return this.shareModule !== null;
  }

  /**
   * Process URL directly (useful for testing or manual URL processing)
   */
  async processUrl(
    url: string,
    title?: string
  ): Promise<ShareProcessingResult> {
    try {
      console.log('[ShareHandlerService] Processing URL directly:', url);

      const urlExtractionResult = await this.extractAndValidateUrl(url);
      if (!urlExtractionResult.success) {
        return {
          success: false,
          error: urlExtractionResult.error,
          validationResult: urlExtractionResult.validationResult,
        };
      }

      const { url: validatedUrl, validationResult } = urlExtractionResult;

      const articleResult = await this.createArticleWithRetry({
        url: validatedUrl,
        title: title || this.extractTitleFromUrl(validatedUrl),
      });

      if (!articleResult.success) {
        return {
          success: false,
          error: articleResult.error,
          validationResult,
        };
      }

      return {
        success: true,
        article: articleResult.article,
        validationResult,
      };
    } catch (error) {
      console.error(
        '[ShareHandlerService] Unexpected error processing URL:',
        error
      );
      return this.createErrorResult(
        ShareErrorCode.PROCESSING_ERROR,
        'Unexpected error occurred while processing URL',
        error
      );
    }
  }

  /**
   * Extract title from URL as fallback
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      return `Article from ${parsedUrl.hostname}`;
    } catch {
      return 'Shared Article';
    }
  }
}

// Export singleton instance for consistent usage across the app
export const shareHandlerService = new ShareHandlerService();

// Export class for testing and custom instantiation
export default ShareHandlerService;
