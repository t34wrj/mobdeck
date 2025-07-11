/**
 * Readeck API Service with API token authentication
 * Comprehensive HTTP client with error handling, retry logic, and network resilience
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import { authStorageService } from './AuthStorageService';
import { errorHandler, ErrorCategory } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import {
  validateUrl,
  getSecurityHeaders,
  defaultRateLimiter,
  maskSensitiveData,
} from '../utils/security';
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
 * - API token authentication with automatic retrieval from secure storage
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
  private certificatePins: Map<string, string[]> = new Map();

  constructor(config: Partial<ReadeckApiConfig> = {}) {
    // Default configuration with security enforcement
    const isDevMode = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
    const defaultBaseUrl = isDevMode ? 'http://localhost:8000/api' : 'https://localhost:8000/api';
    this.config = {
      baseUrl: config.baseUrl || defaultBaseUrl,
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second base delay
      ...config,
    };

    // Validate and sanitize base URL with enhanced security
    const urlValidation = validateUrl(this.config.baseUrl);
    if (!urlValidation.isValid) {
      throw new Error(`Invalid API base URL: ${urlValidation.error}`);
    }
    this.config.baseUrl = urlValidation.sanitized || this.config.baseUrl;

    // Validate URL and warn about HTTP usage if needed
    this.validateAndWarnHttpUsage();

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

    // Create axios instance with enhanced security headers
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mobdeck-Mobile-Client/1.0.0',
        ...getSecurityHeaders(),
        ...this.getEnhancedSecurityHeaders(),
      },
      // Enhanced security configurations
      maxRedirects: 3, // Reduced from 5 for security
      validateStatus: (status) => status >= 200 && status < 300,
      withCredentials: false, // Prevent CORS credential leaks
      // Certificate validation and security options
      httpsAgent: undefined, // Will be configured in setupHttpsAgent if needed
      adapter: this.createSecureAdapter(),
    });

    this.setupInterceptors();
  }

  /**
   * Validate URL and warn about HTTP usage in production
   * @private
   */
  private validateAndWarnHttpUsage(): void {
    const isProduction = typeof __DEV__ === 'undefined' || __DEV__ === false;
    const isLocalhost = this.config.baseUrl.includes('localhost') || this.config.baseUrl.includes('127.0.0.1');
    const isHttps = this.config.baseUrl.startsWith('https://');
    const isHttp = this.config.baseUrl.startsWith('http://');
    
    // Warn about HTTP usage in production for non-localhost URLs
    if (isProduction && !isLocalhost && isHttp) {
      logger.warn('HTTP connection detected in production environment', {
        url: maskSensitiveData(this.config.baseUrl),
        recommendation: 'Consider using HTTPS for better security',
securityRisk: 'Data transmitted over HTTP is not encrypted'
      });
    }
    
    // Log HTTPS usage confirmation
    if (isHttps) {
      logger.info('Secure HTTPS connection established', {
        url: maskSensitiveData(this.config.baseUrl)
      });
    }
  }

  /**
   * Get enhanced security headers
   * @private
   */
  private getEnhancedSecurityHeaders(): Record<string, string> {
    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'X-Request-ID': this.generateRequestId(),
      'X-Client-Version': '1.0.0',
      'X-Platform': 'React-Native-Android',
    };
  }

  /**
   * Create secure adapter for axios with certificate validation
   * @private
   */
  private createSecureAdapter() {
    // Note: React Native uses native HTTP clients, so we can't use Node.js HTTPS agents
    // Certificate pinning is handled at the native level in React Native
    return undefined; // Use default adapter with native certificate validation
  }

  /**
   * Generate unique request ID for tracing
   * @private
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup request and response interceptors
   * @private
   */
  private setupInterceptors(): void {
    // Request interceptor for API token injection and security checks
    this.client.interceptors.request.use(
      async config => {
        // Rate limiting check
        const endpoint = `${config.method}:${config.url}`;
        if (!defaultRateLimiter.isAllowed(endpoint)) {
          throw this.createApiError(
            new Error('Rate limit exceeded'),
            ReadeckErrorCode.RATE_LIMITED
          );
        }

        // Skip auth for login endpoint
        if (config.url?.includes('/auth')) {
          return config;
        }

        try {
          const token = await authStorageService.retrieveToken();
          if (token) {
            // Debug: Log token characteristics (sanitized)
            logger.debug('Token retrieved for validation', { 
              length: token.length, 
              startsWithBearer: token.startsWith('Bearer'),
              hasSpecialChars: /[^A-Za-z0-9-_.]/.test(token)
            });
            
            // Temporarily bypass token validation for testing
            // TODO: Implement proper token validation for Readeck API tokens
            logger.debug('Token validation bypassed for testing');
            config.headers.Authorization = `Bearer ${token}`;
            logger.debug('API token attached to request', { 
              url: config.url,
              hasAuthorization: true
            });
          } else {
            // Silently cancel requests without authentication
            // Return a rejected promise to prevent the request from proceeding
            return Promise.reject({
              name: 'AuthenticationError',
              message: 'No API token available',
              silent: true, // Flag to indicate this should be handled silently
            });
          }
        } catch (error: any) {
          // Only handle actual errors, not authentication cancellations
          if (error?.name !== 'AuthenticationError') {
            const handledError = errorHandler.handleError(error, {
              category: ErrorCategory.AUTHENTICATION,
              context: { actionType: 'token_retrieval', apiEndpoint: config.url },
            });
            logger.error('Failed to retrieve API token', { error: handledError });
          }
          return Promise.reject(error);
        }

        // Log request details and start performance timer
        const operationId = `api_${config.method}_${config.url}`;
        logger.startPerformanceTimer(operationId);
        (config as any)._startTime = Date.now();
        (config as any)._operationId = operationId;
        
        // Enhanced request URL validation and security checks
        if (config.url) {
          const fullUrl = config.url.startsWith('http') ? config.url : `${config.baseURL}${config.url}`;
          const urlValidation = validateUrl(fullUrl);
          if (!urlValidation.isValid) {
            throw new Error(`Invalid request URL: ${urlValidation.error}`);
          }
          
          // Log warning for HTTP URLs in production (but allow connection)
          if (fullUrl.startsWith('http://') && !fullUrl.includes('localhost') && !fullUrl.includes('127.0.0.1')) {
            const isProduction = typeof __DEV__ === 'undefined' || __DEV__ === false;
            if (isProduction) {
              logger.warn('HTTP request in production environment', {
                url: maskSensitiveData(fullUrl),
securityWarning: 'Unencrypted HTTP connection - data may be intercepted'
              });
            }
          }
          
          // Validate certificate pins if configured
          if (this.certificatePins.size > 0) {
            this.validateCertificatePinsForUrl(fullUrl);
          }
        }

        logger.debug('API Request initiated', {
          method: config.method,
          url: config.url,
          hasAuth: !!config.headers.Authorization,
        });

        return config;
      },
      error => {
        // Handle silent authentication errors without logging
        if (error.silent && error.name === 'AuthenticationError') {
          return Promise.reject(error);
        }
        
        errorHandler.handleError(error, {
          category: ErrorCategory.NETWORK,
          context: { actionType: 'request_interceptor' },
        });
        return Promise.reject(
          this.createApiError(error, ReadeckErrorCode.UNKNOWN_ERROR)
        );
      }
    );

    // Response interceptor for security validation and error handling
    this.client.interceptors.response.use(
      response => {
        // Performance tracking
        const operationId = (response.config as any)._operationId;
        if (operationId) {
          logger.endPerformanceTimer(operationId, {
            status: response.status,
            url: response.config.url,
          });
        }
        
        // Security validation
        this.validateResponseSecurity(response);
        
        // Sanitize response data
        const sanitizedResponse = this.sanitizeResponseData(response);
        
        logger.debug('API Response received', {
          status: response.status,
          url: response.config.url,
          duration: Date.now() - (response.config as any)._startTime,
          hasSecurityHeaders: this.hasSecurityHeaders(response),
        });
        
        return sanitizedResponse;
      },
      error => {
        // Handle silent authentication errors without logging
        if (error.silent && error.name === 'AuthenticationError') {
          return Promise.reject(error);
        }

        // End performance timer for error cases
        const operationId = (error.config as any)?._operationId;
        if (operationId) {
          logger.endPerformanceTimer(operationId, {
            status: error.response?.status || 0,
            url: error.config?.url,
            error: true,
          });
        }
        
        const apiError = this.handleResponseError(error);
        return Promise.reject(apiError);
      }
    );
  }

  /**
   * Validate certificate pins for URL
   * @private
   */
  private validateCertificatePinsForUrl(url: string): void {
    try {
      const hostname = new URL(url).hostname;
      if (this.certificatePins.has(hostname)) {
        logger.debug('Certificate pinning validation enabled for hostname', { hostname });
        // Note: In React Native, certificate pinning is handled at the native level
        // This method serves as a validation point for future native integration
      }
    } catch (error) {
      logger.warn('Failed to validate certificate pins for URL', { url: maskSensitiveData(url) });
    }
  }

  /**
   * Validate response security headers and properties
   * @private
   */
  private validateResponseSecurity(response: AxiosResponse): void {
    // Check for HTTPS in production
    const isProduction = typeof __DEV__ === 'undefined' || __DEV__ === false;
    const requestUrl = response.config.url || '';
    const baseUrl = response.config.baseURL || '';
    const fullUrl = requestUrl.startsWith('http') ? requestUrl : `${baseUrl}${requestUrl}`;
    
    if (isProduction && fullUrl.startsWith('http://') && 
        !fullUrl.includes('localhost') && !fullUrl.includes('127.0.0.1')) {
      logger.warn('HTTP response received in production', {
        url: maskSensitiveData(fullUrl),
        status: response.status,
securityNote: 'Consider using HTTPS for encrypted communication'
      });
    }

    // Validate response headers for security indicators
    const headers = response.headers;
    if (headers && typeof headers === 'object') {
      // Check for security headers
      const securityHeaders = [
        'strict-transport-security',
        'x-content-type-options',
        'x-frame-options',
        'content-security-policy'
      ];
      
      const missingHeaders = securityHeaders.filter(header => 
        !headers[header] && !headers[header.toLowerCase()]
      );
      
      if (missingHeaders.length > 0) {
        logger.debug('Response missing security headers', { 
          missingHeaders,
          url: maskSensitiveData(fullUrl)
        });
      }
    }
  }

  /**
   * Check if response has security headers
   * @private
   */
  private hasSecurityHeaders(response: AxiosResponse): boolean {
    const headers = response.headers;
    if (!headers || typeof headers !== 'object') return false;
    
    const securityHeaders = [
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options'
    ];
    
    return securityHeaders.some(header => 
      headers[header] || headers[header.toLowerCase()]
    );
  }

  /**
   * Sanitize response data to prevent potential security issues
   * @private
   */
  private sanitizeResponseData(response: AxiosResponse): AxiosResponse {
    // Create a copy to avoid mutating the original response
    const sanitizedResponse = { ...response };
    
    // Remove potentially sensitive headers from response
    if (sanitizedResponse.headers) {
      const sensitiveHeaders = ['server', 'x-powered-by', 'x-aspnet-version'];
      sensitiveHeaders.forEach(header => {
        delete sanitizedResponse.headers[header];
        delete sanitizedResponse.headers[header.toLowerCase()];
      });
    }
    
    // Validate response data structure
    if (sanitizedResponse.data && typeof sanitizedResponse.data === 'object') {
      // Remove any potentially dangerous properties
      if (Array.isArray(sanitizedResponse.data)) {
        // For arrays, validate each item
        sanitizedResponse.data = sanitizedResponse.data.map(this.sanitizeDataObject);
      } else {
        // For objects, sanitize properties
        sanitizedResponse.data = this.sanitizeDataObject(sanitizedResponse.data);
      }
    }
    
    return sanitizedResponse;
  }

  /**
   * Sanitize individual data objects
   * @private
   */
  private sanitizeDataObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = { ...obj };
    
    // Remove potentially dangerous properties
    const dangerousProps = ['__proto__', 'constructor', 'prototype'];
    dangerousProps.forEach(prop => {
      delete sanitized[prop];
    });
    
    return sanitized;
  }

  /**
   * Get error category for centralized error handling
   * @private
   */
  private getErrorCategory(error: AxiosError): ErrorCategory {
    if (!error.response) {
      return ErrorCategory.NETWORK;
    }
    
    const status = error.response.status;
    if (status === 401) {
      return ErrorCategory.AUTHENTICATION;
    } else if (status >= 400 && status < 500) {
      return ErrorCategory.VALIDATION;
    } else if (status >= 500) {
      return ErrorCategory.NETWORK;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Handle response errors with proper categorization using centralized error handler
   * @private
   */
  private handleResponseError(error: AxiosError): ReadeckApiError {
    // Use centralized error handling for consistent categorization
    errorHandler.handleError(error, {
      category: this.getErrorCategory(error),
      context: { 
        actionType: 'api_request',
        apiEndpoint: error.config?.url,
        serverUrl: this.config.baseUrl,
      },
    });

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
    } else if (status === 404) {
      return this.createApiError(error, ReadeckErrorCode.NOT_FOUND);
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
   * Create standardized API error with security considerations
   * @private
   */
  private createApiError(error: any, code: ReadeckErrorCode): ReadeckApiError {
    const message = this.getErrorMessage(error, code);
    const statusCode = error.response?.status;
    // Sanitize error details to prevent information leakage
    const details = this.sanitizeErrorDetails(error.message || String(error));
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
   * Sanitize error details to prevent sensitive information leakage
   * @private
   */
  private sanitizeErrorDetails(details: string): string {
    // Remove potential sensitive information patterns
    return details
      .replace(/Bearer\s+[\w-.]+/gi, 'Bearer [REDACTED]')
      .replace(/[\w-]+@[\w-]+(\.[\w-]+)+/g, '[EMAIL]')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
      .replace(/password[\s=:]+[\S]+/gi, 'password=[REDACTED]')
      .replace(/api[_-]?key[\s=:]+[\S]+/gi, 'api_key=[REDACTED]');
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
   * Execute request with retry logic and centralized error handling
   * @private
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    config?: RequestConfig
  ): Promise<ReadeckApiResponse<T>> {
    const attempts = config?.retryAttempts ?? this.retryConfig.attempts;
    const skipRetry = config?.skipRetry ?? false;

    let lastError: ReadeckApiError | undefined;

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
        // Use centralized error handling for network errors
        const networkErrorHandler = errorHandler.getNetworkErrorHandler();
        const handledError = networkErrorHandler(error);
        
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

        logger.info(
          `API retry attempt ${attempt}/${attempts} after ${delay}ms`,
          { error: maskSensitiveData(handledError.userMessage) }
        );
        await new Promise<void>(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Request failed after retries');
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
      headers: {
        ...this.client.defaults.headers.common,
        ...options.headers,
      },
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
    // Map to Readeck API auth request format exactly as documented
    const authRequest = {
      application: 'Mobdeck Mobile App',
      username: credentials.username,
      password: credentials.password
    };
    
    return this.makeRequest<ReadeckLoginResponse>({
      method: 'POST',
      url: '/auth',
      data: authRequest,
      config: { skipAuth: true },
    });
  }

  async validateToken(timeout?: number): Promise<ReadeckApiResponse<ReadeckUser>> {
    return this.makeRequest<ReadeckUser>({
      method: 'GET',
      url: '/profile',
      config: {
        timeout: timeout || this.config.timeout
      }
    });
  }

  // Note: Readeck API doesn't have token refresh endpoint
  async refreshToken(): Promise<ReadeckApiResponse<ReadeckLoginResponse>> {
    throw new Error('Token refresh not supported by Readeck API. Please re-authenticate.');
  }

  // Article methods
  async getArticles(
    filters?: ArticleFilters
  ): Promise<ReadeckApiResponse<ReadeckArticleList>> {
    return this.makeRequest<ReadeckArticleList>({
      method: 'GET',
      url: '/bookmarks',
      params: filters,
    });
  }

  async getArticle(id: string): Promise<ReadeckApiResponse<ReadeckArticle>> {
    logger.debug('Fetching article', { articleId: id });
    
    // Get the article metadata from the bookmarks endpoint
    const response = await this.makeRequest<ReadeckArticle>({
      method: 'GET',
      url: `/bookmarks/${id}`,
    });
    
    logger.debug('Article fetch successful', { 
      articleId: id,
      hasData: !!response.data,
      status: response.status
    });
    
    return response;
  }

  async createArticle(
    article: CreateArticleRequest
  ): Promise<ReadeckApiResponse<ReadeckArticle>> {
    return this.makeRequest<ReadeckArticle>({
      method: 'POST',
      url: '/bookmarks',
      data: article,
    });
  }

  async updateArticle(
    id: string,
    updates: UpdateArticleRequest
  ): Promise<ReadeckApiResponse<ReadeckArticle>> {
    return this.makeRequest<ReadeckArticle>({
      method: 'PATCH',
      url: `/bookmarks/${id}`,
      data: updates,
    });
  }

  async deleteArticle(id: string): Promise<ReadeckApiResponse<void>> {
    return this.makeRequest<void>({
      method: 'DELETE',
      url: `/bookmarks/${id}`,
    });
  }

  async getArticleContent(contentUrl: string): Promise<string> {
    logger.debug('Fetching article content', { 
      urlHash: maskSensitiveData(contentUrl),
      baseUrlHash: maskSensitiveData(this.config.baseUrl)
    });
      
      // Handle both absolute URLs and relative paths
      let requestUrl = contentUrl;
      
      // If it's a full URL, we need to extract the path relative to our base URL
      if (contentUrl.startsWith('http://') || contentUrl.startsWith('https://')) {
        // Remove the base URL portion to get just the path
        const baseUrlWithoutTrailingSlash = this.config.baseUrl.replace(/\/$/, '');
        
        if (contentUrl.startsWith(baseUrlWithoutTrailingSlash)) {
          // Extract the path after the base URL
          requestUrl = contentUrl.substring(baseUrlWithoutTrailingSlash.length);
          // Ensure it starts with /
          if (!requestUrl.startsWith('/')) {
            requestUrl = `/${  requestUrl}`;
          }
        } else {
          // If URL doesn't match our base URL, try extracting path after /api/
          const url = new URL(contentUrl);
          const apiIndex = url.pathname.indexOf('/api/');
          if (apiIndex !== -1) {
            requestUrl = url.pathname.substring(apiIndex + 4); // Skip '/api'
          } else {
            requestUrl = url.pathname;
          }
        }
      }
      
      logger.debug('Making content request to path', { pathHash: maskSensitiveData(requestUrl) });
      
      // Use the makeRequest method to ensure proper authentication and error handling
      const response = await this.makeRequest<string>({
        method: 'GET',
        url: requestUrl,
        headers: {
          'Accept': 'text/html',
        },
      });
      
      logger.debug('Content response received', { contentLength: response.data?.length || 0 });
      
      return response.data;
  }

  // User methods
  async getUserProfile(): Promise<ReadeckApiResponse<ReadeckUserProfile>> {
    return this.makeRequest<ReadeckUserProfile>({
      method: 'GET',
      url: '/profile',
    });
  }

  async updateUserProfile(
    updates: Partial<ReadeckUserProfile>
  ): Promise<ReadeckApiResponse<ReadeckUserProfile>> {
    // Note: Readeck API documentation doesn't show profile update endpoint
    // This might not be supported, but keeping for backward compatibility
    return this.makeRequest<ReadeckUserProfile>({
      method: 'PATCH',
      url: '/profile',
      data: updates,
    });
  }

  // System methods - Readeck API doesn't provide system info endpoint
  async getSystemInfo(): Promise<ReadeckApiResponse<ReadeckSystemInfo>> {
    throw new Error('System info endpoint not available in Readeck API');
  }

  // Sync methods - Readeck API doesn't have dedicated sync endpoints
  // Use getArticles with updated_since parameter for syncing
  async syncArticles(
    request?: SyncRequest
  ): Promise<ReadeckApiResponse<ReadeckSyncResponse>> {
    logger.debug('Initiating sync operation using getArticles with filters');
    
    // Map sync request to article filters
    const filters: any = {};
    if (request?.since) {
      filters.updated_since = request.since;
    }
    if (request?.limit) {
      filters.limit = request.limit;
    }
    
    const response = await this.getArticles(filters);
    
    // Transform response to match expected sync response format
    const syncResponse: ReadeckSyncResponse = {
      articles: Array.isArray(response.data) ? response.data : response.data.articles || [],
      last_updated: new Date().toISOString(),
      total_count: Array.isArray(response.data) ? response.data.length : response.data.pagination?.total_count || 0,
      has_more: Array.isArray(response.data) ? false : (response.data.pagination?.page || 1) < (response.data.pagination?.total_pages || 1)
    };
    
    return {
      data: syncResponse,
      status: response.status,
      headers: response.headers,
      timestamp: response.timestamp
    };
  }

  // Labels methods - Updated to match Readeck API documentation
  async getLabels(filters?: any): Promise<ReadeckApiResponse<any>> {
    return this.makeRequest<any>({
      method: 'GET',
      url: '/bookmarks/labels',
      params: filters,
    });
  }

  async getLabelInfo(name: string): Promise<ReadeckApiResponse<any>> {
    return this.makeRequest<any>({
      method: 'GET',
      url: `/bookmarks/labels/${encodeURIComponent(name)}`,
    });
  }

  async updateLabel(
    currentName: string,
    newName: string
  ): Promise<ReadeckApiResponse<any>> {
    return this.makeRequest<any>({
      method: 'PATCH',
      url: `/bookmarks/labels/${encodeURIComponent(currentName)}`,
      data: { name: newName },
    });
  }

  async deleteLabel(name: string): Promise<ReadeckApiResponse<void>> {
    return this.makeRequest<void>({
      method: 'DELETE',
      url: `/bookmarks/labels/${encodeURIComponent(name)}`,
    });
  }

  // Legacy method aliases for backward compatibility
  async getLabel(name: string): Promise<ReadeckApiResponse<any>> {
    return this.getLabelInfo(name);
  }

  async createLabel(_label: any): Promise<ReadeckApiResponse<any>> {
    // Note: Readeck API doesn't have a direct create label endpoint
    // Labels are created when assigned to bookmarks
    throw new Error('Creating labels directly is not supported by Readeck API. Labels are created when assigned to bookmarks.');
  }

  async assignLabel(_data: any): Promise<ReadeckApiResponse<void>> {
    // Note: Label assignment is done through bookmark update
    throw new Error('Use updateArticle with labels/add_labels fields instead of assignLabel');
  }

  async removeLabel(_data: any): Promise<ReadeckApiResponse<void>> {
    // Note: Label removal is done through bookmark update
    throw new Error('Use updateArticle with remove_labels field instead of removeLabel');
  }

  async batchLabels(_data: any): Promise<ReadeckApiResponse<any>> {
    // Note: Batch operations should be done through individual bookmark updates
    throw new Error('Batch label operations not supported. Use individual bookmark updates.');
  }

  async getLabelStats(): Promise<ReadeckApiResponse<any>> {
    // Note: Label stats are available through the labels list endpoint
    throw new Error('Use getLabels() to get label information including counts');
  }

  async getArticleLabels(_articleId: string): Promise<ReadeckApiResponse<any>> {
    // Note: Article labels are included in the bookmark details
    throw new Error('Article labels are included in bookmark details from getArticle()');
  }

  // Configuration methods
  updateConfig(config: Partial<ReadeckApiConfig>): void {
    // Validate new base URL if provided
    if (config.baseUrl) {
      const urlValidation = validateUrl(config.baseUrl);
      if (!urlValidation.isValid) {
        throw new Error(`Invalid API base URL: ${urlValidation.error}`);
      }
      config.baseUrl = urlValidation.sanitized || config.baseUrl;
    }

    this.config = { ...this.config, ...config };

    // Update axios instance configuration
    this.client.defaults.baseURL = this.config.baseUrl;
    this.client.defaults.timeout = this.config.timeout;

    // Update retry configuration
    this.retryConfig.attempts = this.config.retryAttempts;
    this.retryConfig.delay = this.config.retryDelay;

    logger.info('API configuration updated', {
      baseUrl: maskSensitiveData(this.config.baseUrl),
      timeout: this.config.timeout,
    });
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
    logger.debug('Network state updated', this.networkState);
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

  /**
   * Set certificate pins for enhanced security
   * @param hostname - The hostname to pin certificates for
   * @param pins - Array of SHA256 certificate fingerprints
   */
  setCertificatePins(hostname: string, pins: string[]): void {
    if (!hostname || !pins || pins.length === 0) {
      throw new Error('Invalid certificate pinning configuration');
    }
    this.certificatePins.set(hostname, pins);
    logger.info('Certificate pins configured', { hostname, pinCount: pins.length });
  }

  /**
   * Clear all certificate pins
   */
  clearCertificatePins(): void {
    this.certificatePins.clear();
    logger.info('Certificate pins cleared');
  }

  /**
   * Verify certificate pins (to be called by network security config)
   * @param hostname - The hostname to verify
   * @param certificateChain - The certificate chain to verify
   */
  verifyCertificatePins(hostname: string, certificateChain: string[]): boolean {
    const pins = this.certificatePins.get(hostname);
    if (!pins || pins.length === 0) {
      return true; // No pins configured, allow connection
    }

    // Check if any certificate in the chain matches our pins
    return certificateChain.some(cert => pins.includes(cert));
  }
}

// Export singleton instance for consistent usage across the app
export const readeckApiService = new ReadeckApiService();

// Export class for testing and custom instantiation
export default ReadeckApiService;
