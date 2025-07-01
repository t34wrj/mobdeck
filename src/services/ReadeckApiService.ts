/**
 * Readeck API Service with Bearer token authentication
 * Comprehensive HTTP client with error handling, retry logic, and network resilience
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import { authStorageService } from './AuthStorageService';
import {
  IReadeckApiService,
  ReadeckApiConfig,
  ReadeckApiError,
  ReadeckErrorCode,
  ReadeckApiResponse,
  ReadeckLoginRequest,
  ReadeckLoginResponse,
  ReadeckUser,
  ReadeckArticleList,
  ReadeckArticle,
  CreateArticleRequest,
  UpdateArticleRequest,
  ArticleFilters,
  ReadeckUserProfile,
  ReadeckSystemInfo,
  ReadeckSyncResponse,
  SyncRequest,
  RequestConfig,
  NetworkState,
  RetryConfig,
  ApiRequestOptions,
} from '../types/readeck';

/**
 * ReadeckApiService - Production-ready API client for Readeck servers
 *
 * Features:
 * - Bearer token authentication with automatic retrieval from secure storage
 * - Intelligent retry logic with exponential backoff
 * - Comprehensive error handling and categorization
 * - Network connectivity awareness
 * - Request/response logging for debugging
 * - Timeout management and cancellation support
 */
class ReadeckApiService implements IReadeckApiService {
  private readonly client: AxiosInstance;
  private config: ReadeckApiConfig;
  private retryConfig: RetryConfig;
  private networkState: NetworkState;

  constructor(config: Partial<ReadeckApiConfig> = {}) {
    // Default configuration
    this.config = {
      baseUrl: 'http://localhost:8000/api/v1',
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second base delay
      ...config,
    };

    // Retry configuration
    this.retryConfig = {
      attempts: this.config.retryAttempts,
      delay: this.config.retryDelay,
      backoffMultiplier: 2,
      maxDelay: 10000, // 10 seconds max
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      retryableErrorCodes: [
        ReadeckErrorCode.NETWORK_ERROR,
        ReadeckErrorCode.TIMEOUT_ERROR,
        ReadeckErrorCode.SERVER_ERROR,
        ReadeckErrorCode.SERVICE_UNAVAILABLE,
        ReadeckErrorCode.CONNECTION_ERROR,
      ],
    };

    // Network state initialization
    this.networkState = {
      isConnected: true,
      isWifiEnabled: false,
      isCellularEnabled: false,
      networkType: 'unknown',
    };

    // Create axios instance with default configuration
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mobdeck-Mobile-Client/1.0.0',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   * @private
   */
  private setupInterceptors(): void {
    // Request interceptor for Bearer token injection
    this.client.interceptors.request.use(
      async config => {
        // Skip auth for login endpoint
        if (config.url?.includes('/auth/login')) {
          return config;
        }

        try {
          const token = await authStorageService.retrieveToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('[ReadeckApiService] Bearer token attached to request');
          } else {
            console.warn(
              '[ReadeckApiService] No Bearer token available for request'
            );
          }
        } catch (error) {
          console.error(
            '[ReadeckApiService] Failed to retrieve Bearer token:',
            error
          );
        }

        // Log request details (excluding sensitive data)
        if (__DEV__) {
          const { data, headers, ...logConfig } = config;
          console.log('[ReadeckApiService] Request:', {
            ...logConfig,
            headers: {
              ...headers,
              Authorization: headers.Authorization
                ? '[BEARER_TOKEN]'
                : undefined,
            },
          });
        }

        return config;
      },
      error => {
        console.error('[ReadeckApiService] Request interceptor error:', error);
        return Promise.reject(
          this.createApiError(error, ReadeckErrorCode.UNKNOWN_ERROR)
        );
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => {
        if (__DEV__) {
          console.log('[ReadeckApiService] Response received:', {
            status: response.status,
            url: response.config.url,
            timestamp: new Date().toISOString(),
          });
        }
        return response;
      },
      error => {
        const apiError = this.handleResponseError(error);
        console.error('[ReadeckApiService] Response error:', apiError);
        return Promise.reject(apiError);
      }
    );
  }

  /**
   * Handle response errors with proper categorization
   * @private
   */
  private handleResponseError(error: AxiosError): ReadeckApiError {
    if (!error.response) {
      // Network or connection error
      if (error.code === 'ECONNABORTED') {
        return this.createApiError(error, ReadeckErrorCode.TIMEOUT_ERROR);
      }
      return this.createApiError(error, ReadeckErrorCode.CONNECTION_ERROR);
    }

    const { status } = error.response;

    // Categorize by HTTP status code
    if (status === 401) {
      return this.createApiError(error, ReadeckErrorCode.AUTHENTICATION_ERROR);
    } else if (status === 403) {
      return this.createApiError(error, ReadeckErrorCode.AUTHORIZATION_ERROR);
    } else if (status === 429) {
      return this.createApiError(error, ReadeckErrorCode.RATE_LIMITED);
    } else if (status >= 500) {
      return this.createApiError(error, ReadeckErrorCode.SERVER_ERROR);
    } else if (status === 503) {
      return this.createApiError(error, ReadeckErrorCode.SERVICE_UNAVAILABLE);
    } else {
      return this.createApiError(error, ReadeckErrorCode.UNKNOWN_ERROR);
    }
  }

  /**
   * Create standardized API error
   * @private
   */
  private createApiError(error: any, code: ReadeckErrorCode): ReadeckApiError {
    const message = this.getErrorMessage(error, code);
    const statusCode = error.response?.status;
    const details = error.message || String(error);
    const retryable =
      this.retryConfig.retryableErrorCodes.includes(code) ||
      (statusCode &&
        this.retryConfig.retryableStatusCodes.includes(statusCode));

    return {
      code,
      message,
      statusCode,
      details,
      retryable,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get user-friendly error message
   * @private
   */
  private getErrorMessage(error: any, code: ReadeckErrorCode): string {
    switch (code) {
      case ReadeckErrorCode.NETWORK_ERROR:
        return 'Network connection failed. Please check your internet connection.';
      case ReadeckErrorCode.AUTHENTICATION_ERROR:
        return 'Authentication failed. Please check your credentials.';
      case ReadeckErrorCode.AUTHORIZATION_ERROR:
        return 'Access denied. You may not have permission for this action.';
      case ReadeckErrorCode.TIMEOUT_ERROR:
        return 'Request timeout. The server took too long to respond.';
      case ReadeckErrorCode.RATE_LIMITED:
        return 'Too many requests. Please wait before trying again.';
      case ReadeckErrorCode.SERVER_ERROR:
        return 'Server error occurred. Please try again later.';
      case ReadeckErrorCode.SERVICE_UNAVAILABLE:
        return 'Service temporarily unavailable. Please try again later.';
      case ReadeckErrorCode.CONNECTION_ERROR:
        return 'Unable to connect to server. Please check your internet connection.';
      default:
        return (
          error.response?.data?.message ||
          error.message ||
          'An unexpected error occurred.'
        );
    }
  }

  /**
   * Execute request with retry logic
   * @private
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    config?: RequestConfig
  ): Promise<ReadeckApiResponse<T>> {
    const attempts = config?.retryAttempts ?? this.retryConfig.attempts;
    const skipRetry = config?.skipRetry ?? false;

    let lastError: ReadeckApiError;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await requestFn();

        return {
          data: response.data,
          status: response.status,
          headers: response.headers as Record<string, string>,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        lastError = error as ReadeckApiError;

        // Don't retry if configured to skip, on last attempt, or if error is not retryable
        if (skipRetry || attempt === attempts || !lastError.retryable) {
          break;
        }

        const delay = Math.min(
          this.retryConfig.delay *
            Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay
        );

        console.log(
          `[ReadeckApiService] Retry attempt ${attempt}/${attempts} after ${delay}ms`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Make HTTP request with proper error handling
   * @private
   */
  private async makeRequest<T>(
    options: ApiRequestOptions
  ): Promise<ReadeckApiResponse<T>> {
    const requestConfig: AxiosRequestConfig = {
      method: options.method,
      url: options.url,
      data: options.data,
      params: options.params,
      headers: options.headers,
      timeout: options.config?.timeout,
    };

    return this.executeWithRetry(
      () => this.client.request<T>(requestConfig),
      options.config
    );
  }

  // Authentication methods
  async login(
    credentials: ReadeckLoginRequest
  ): Promise<ReadeckApiResponse<ReadeckLoginResponse>> {
    return this.makeRequest<ReadeckLoginResponse>({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
      config: { skipAuth: true },
    });
  }

  async validateToken(): Promise<ReadeckApiResponse<ReadeckUser>> {
    return this.makeRequest<ReadeckUser>({
      method: 'GET',
      url: '/auth/me',
    });
  }

  async refreshToken(): Promise<ReadeckApiResponse<ReadeckLoginResponse>> {
    return this.makeRequest<ReadeckLoginResponse>({
      method: 'POST',
      url: '/auth/refresh',
    });
  }

  // Article methods
  async getArticles(
    filters?: ArticleFilters
  ): Promise<ReadeckApiResponse<ReadeckArticleList>> {
    return this.makeRequest<ReadeckArticleList>({
      method: 'GET',
      url: '/articles',
      params: filters,
    });
  }

  async getArticle(id: string): Promise<ReadeckApiResponse<ReadeckArticle>> {
    return this.makeRequest<ReadeckArticle>({
      method: 'GET',
      url: `/articles/${id}`,
    });
  }

  async createArticle(
    article: CreateArticleRequest
  ): Promise<ReadeckApiResponse<ReadeckArticle>> {
    return this.makeRequest<ReadeckArticle>({
      method: 'POST',
      url: '/articles',
      data: article,
    });
  }

  async updateArticle(
    id: string,
    updates: UpdateArticleRequest
  ): Promise<ReadeckApiResponse<ReadeckArticle>> {
    return this.makeRequest<ReadeckArticle>({
      method: 'PATCH',
      url: `/articles/${id}`,
      data: updates,
    });
  }

  async deleteArticle(id: string): Promise<ReadeckApiResponse<void>> {
    return this.makeRequest<void>({
      method: 'DELETE',
      url: `/articles/${id}`,
    });
  }

  // User methods
  async getUserProfile(): Promise<ReadeckApiResponse<ReadeckUserProfile>> {
    return this.makeRequest<ReadeckUserProfile>({
      method: 'GET',
      url: '/user/profile',
    });
  }

  async updateUserProfile(
    updates: Partial<ReadeckUserProfile>
  ): Promise<ReadeckApiResponse<ReadeckUserProfile>> {
    return this.makeRequest<ReadeckUserProfile>({
      method: 'PATCH',
      url: '/user/profile',
      data: updates,
    });
  }

  // System methods
  async getSystemInfo(): Promise<ReadeckApiResponse<ReadeckSystemInfo>> {
    return this.makeRequest<ReadeckSystemInfo>({
      method: 'GET',
      url: '/system/info',
      config: { skipAuth: true },
    });
  }

  // Sync methods
  async syncArticles(
    request?: SyncRequest
  ): Promise<ReadeckApiResponse<ReadeckSyncResponse>> {
    return this.makeRequest<ReadeckSyncResponse>({
      method: 'GET',
      url: '/sync/articles',
      params: request,
    });
  }

  // Labels methods
  async getLabels(filters?: any): Promise<ReadeckApiResponse<any>> {
    return this.makeRequest<any>({
      method: 'GET',
      url: '/labels',
      params: filters,
    });
  }

  async createLabel(label: any): Promise<ReadeckApiResponse<any>> {
    return this.makeRequest<any>({
      method: 'POST',
      url: '/labels',
      data: label,
    });
  }

  async updateLabel(
    id: string,
    updates: any
  ): Promise<ReadeckApiResponse<any>> {
    return this.makeRequest<any>({
      method: 'PATCH',
      url: `/labels/${id}`,
      data: updates,
    });
  }

  async deleteLabel(
    id: string,
    params?: any
  ): Promise<ReadeckApiResponse<void>> {
    return this.makeRequest<void>({
      method: 'DELETE',
      url: `/labels/${id}`,
      params,
    });
  }

  async getLabel(id: string): Promise<ReadeckApiResponse<any>> {
    return this.makeRequest<any>({
      method: 'GET',
      url: `/labels/${id}`,
    });
  }

  async assignLabel(data: any): Promise<ReadeckApiResponse<void>> {
    return this.makeRequest<void>({
      method: 'POST',
      url: '/labels/assign',
      data,
    });
  }

  async removeLabel(data: any): Promise<ReadeckApiResponse<void>> {
    return this.makeRequest<void>({
      method: 'POST',
      url: '/labels/remove',
      data,
    });
  }

  async batchLabels(data: any): Promise<ReadeckApiResponse<any>> {
    return this.makeRequest<any>({
      method: 'POST',
      url: '/labels/batch',
      data,
    });
  }

  async getLabelStats(): Promise<ReadeckApiResponse<any>> {
    return this.makeRequest<any>({
      method: 'GET',
      url: '/labels/stats',
    });
  }

  async getArticleLabels(articleId: string): Promise<ReadeckApiResponse<any>> {
    return this.makeRequest<any>({
      method: 'GET',
      url: `/articles/${articleId}/labels`,
    });
  }

  // Configuration methods
  updateConfig(config: Partial<ReadeckApiConfig>): void {
    this.config = { ...this.config, ...config };

    // Update axios instance configuration
    this.client.defaults.baseURL = this.config.baseUrl;
    this.client.defaults.timeout = this.config.timeout;

    // Update retry configuration
    this.retryConfig.attempts = this.config.retryAttempts;
    this.retryConfig.delay = this.config.retryDelay;

    console.log('[ReadeckApiService] Configuration updated:', this.config);
  }

  getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  /**
   * Update network connectivity state
   * Called by network monitoring service
   */
  updateNetworkState(state: Partial<NetworkState>): void {
    this.networkState = { ...this.networkState, ...state };
    console.log(
      '[ReadeckApiService] Network state updated:',
      this.networkState
    );
  }

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return this.networkState.isConnected;
  }

  /**
   * Get current configuration
   */
  getConfig(): ReadeckApiConfig {
    return { ...this.config };
  }
}

// Export singleton instance for consistent usage across the app
export const readeckApiService = new ReadeckApiService();

// Export class for testing and custom instantiation
export default ReadeckApiService;
