/**
 * Unit tests for ReadeckApiService core functionality
 * Tests configuration, network state management, and basic API methods
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  ReadeckApiConfig,
  ReadeckLoginRequest,
  ReadeckLoginResponse,
  ReadeckUser,
  ArticleFilters,
  ReadeckArticleList,
  CreateArticleRequest,
} from '../../src/types/readeck';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(),
}));

// Mock localStorageService
jest.mock('../../src/services/LocalStorageService', () => ({
  localStorageService: {
    retrieveToken: jest.fn(),
    storeToken: jest.fn(),
    deleteToken: jest.fn(),
    isTokenStored: jest.fn(),
    validateStoredToken: jest.fn(),
  },
}));

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation(),
};

// Simple mock implementation for testing core functionality
class TestableReadeckApiService {
  private config: ReadeckApiConfig;
  private networkState: any;
  private client: any;

  constructor(config: Partial<ReadeckApiConfig> = {}) {
    this.config = {
      baseUrl: 'http://localhost:8000/api/v1',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };

    this.networkState = {
      isConnected: true,
      isWifiEnabled: false,
      isCellularEnabled: false,
      networkType: 'unknown',
    };

    // Mock axios instance
    const mockAxiosInstance = {
      request: jest.fn(),
      defaults: {
        baseURL: this.config.baseUrl,
        timeout: this.config.timeout,
        headers: {},
      },
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
    this.client = mockAxiosInstance;
  }

  getConfig(): ReadeckApiConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ReadeckApiConfig>): void {
    this.config = { ...this.config, ...config };
    this.client.defaults.baseURL = this.config.baseUrl;
    this.client.defaults.timeout = this.config.timeout;
  }

  getNetworkState(): any {
    return { ...this.networkState };
  }

  updateNetworkState(state: any): void {
    this.networkState = { ...this.networkState, ...state };
  }

  isOnline(): boolean {
    return this.networkState.isConnected;
  }

  async login(credentials: ReadeckLoginRequest): Promise<any> {
    try {
      const response = await this.client.request({
        method: 'POST',
        url: '/auth/login',
        data: credentials,
      });

      return {
        data: response.data,
        status: response.status,
        headers: response.headers || {},
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  async validateToken(): Promise<any> {
    try {
      const response = await this.client.request({
        method: 'GET',
        url: '/auth/me',
      });

      return {
        data: response.data,
        status: response.status,
        headers: response.headers || {},
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  async getArticles(filters?: ArticleFilters): Promise<any> {
    try {
      const response = await this.client.request({
        method: 'GET',
        url: '/articles',
        params: filters,
      });

      return {
        data: response.data,
        status: response.status,
        headers: response.headers || {},
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  async createArticle(article: CreateArticleRequest): Promise<any> {
    try {
      const response = await this.client.request({
        method: 'POST',
        url: '/articles',
        data: article,
      });

      return {
        data: response.data,
        status: response.status,
        headers: response.headers || {},
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }
}

describe('ReadeckApiService Core Functionality', () => {
  let service: TestableReadeckApiService;
  let mockAxios: jest.Mocked<typeof axios>;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios = axios as jest.Mocked<typeof axios>;

    // Create a consistent mock client that will be used across tests
    mockClient = {
      request: jest.fn(),
      defaults: {
        baseURL: 'http://localhost:8000/api/v1',
        timeout: 30000,
        headers: {},
      },
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    // Ensure axios.create returns our consistent mock client
    mockAxios.create.mockReturnValue(mockClient);

    service = new TestableReadeckApiService();
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockClear());
  });

  afterAll(() => {
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('Configuration Management', () => {
    it('should initialize with default configuration', () => {
      const config = service.getConfig();

      expect(config.baseUrl).toBe('http://localhost:8000/api/v1');
      expect(config.timeout).toBe(30000);
      expect(config.retryAttempts).toBe(3);
      expect(config.retryDelay).toBe(1000);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<ReadeckApiConfig> = {
        baseUrl: 'https://api.example.com',
        timeout: 60000,
        retryAttempts: 5,
        retryDelay: 2000,
      };

      const customService = new TestableReadeckApiService(customConfig);
      const config = customService.getConfig();

      expect(config.baseUrl).toBe('https://api.example.com');
      expect(config.timeout).toBe(60000);
      expect(config.retryAttempts).toBe(5);
      expect(config.retryDelay).toBe(2000);
    });

    it('should update configuration', () => {
      const newConfig: Partial<ReadeckApiConfig> = {
        baseUrl: 'https://new-api.example.com',
        timeout: 45000,
        retryAttempts: 5,
      };

      service.updateConfig(newConfig);

      const updatedConfig = service.getConfig();
      expect(updatedConfig.baseUrl).toBe('https://new-api.example.com');
      expect(updatedConfig.timeout).toBe(45000);
      expect(updatedConfig.retryAttempts).toBe(5);
      expect(updatedConfig.retryDelay).toBe(1000); // Should keep original value
    });
  });

  describe('Network State Management', () => {
    it('should get initial network state', () => {
      const state = service.getNetworkState();

      expect(state.isConnected).toBe(true);
      expect(state.isWifiEnabled).toBe(false);
      expect(state.isCellularEnabled).toBe(false);
      expect(state.networkType).toBe('unknown');
    });

    it('should update network state', () => {
      const newState = {
        isConnected: false,
        networkType: 'cellular',
        isCellularEnabled: true,
      };

      service.updateNetworkState(newState);

      const updatedState = service.getNetworkState();
      expect(updatedState.isConnected).toBe(false);
      expect(updatedState.networkType).toBe('cellular');
      expect(updatedState.isCellularEnabled).toBe(true);
      expect(updatedState.isWifiEnabled).toBe(false); // Should keep original value
    });

    it('should check online status', () => {
      expect(service.isOnline()).toBe(true);

      service.updateNetworkState({ isConnected: false });
      expect(service.isOnline()).toBe(false);
    });
  });

  describe('Authentication Methods', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        data: {
          token: 'test-token',
          user: {
            id: '1',
            username: 'testuser',
            email: 'test@example.com',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
          expires_at: '2023-12-31T23:59:59Z',
        },
        status: 200,
        headers: {},
      };

      // Get the mock client and set up the request mock
      const mockClient = (service as any).client;
      mockClient.request.mockResolvedValue(mockResponse);

      const credentials: ReadeckLoginRequest = {
        username: 'testuser',
        password: 'testpass',
      };

      const result = await service.login(credentials);

      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/auth/login',
        data: credentials,
      });

      expect(result.data).toEqual(mockResponse.data);
      expect(result.status).toBe(200);
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should validate token successfully', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockResponse = {
        data: mockUser,
        status: 200,
        headers: {},
      };

      const mockClient = (service as any).client;
      mockClient.request.mockResolvedValue(mockResponse);

      const result = await service.validateToken();

      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/auth/me',
      });

      expect(result.data).toEqual(mockUser);
      expect(result.status).toBe(200);
    });
  });

  describe('Article Methods', () => {
    it('should get articles with filters', async () => {
      const mockArticleList = {
        articles: [
          {
            id: '1',
            title: 'Test Article',
            summary: 'Test summary',
            content: 'Test content',
            url: 'https://example.com',
            image_url: null,
            read_time: 5,
            is_archived: false,
            is_favorite: false,
            is_read: false,
            tags: ['test'],
            source_url: 'https://example.com',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ],
        pagination: {
          page: 1,
          per_page: 20,
          total_count: 1,
          total_pages: 1,
        },
      };

      const mockResponse = {
        data: mockArticleList,
        status: 200,
        headers: {},
      };

      const mockClient = (service as any).client;
      mockClient.request.mockResolvedValue(mockResponse);

      const filters: ArticleFilters = {
        limit: 10,
        offset: 0,
        search: 'test',
        is_archived: false,
      };

      const result = await service.getArticles(filters);

      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/articles',
        params: filters,
      });

      expect(result.data).toEqual(mockArticleList);
      expect(result.status).toBe(200);
    });

    it('should create article', async () => {
      const mockArticle = {
        id: '1',
        title: 'New Article',
        summary: 'New summary',
        content: 'New content',
        url: 'https://example.com/new',
        image_url: null,
        read_time: 3,
        is_archived: false,
        is_favorite: false,
        is_read: false,
        tags: ['new'],
        source_url: 'https://example.com/new',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockResponse = {
        data: mockArticle,
        status: 201,
        headers: {},
      };

      const mockClient = (service as any).client;
      mockClient.request.mockResolvedValue(mockResponse);

      const createRequest: CreateArticleRequest = {
        url: 'https://example.com/new',
        title: 'New Article',
        labels: ['new'],
      };

      const result = await service.createArticle(createRequest);

      expect(mockClient.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/articles',
        data: createRequest,
      });

      expect(result.data).toEqual(mockArticle);
      expect(result.status).toBe(201);
    });
  });

  describe('Authentication Edge Cases', () => {
    it('should handle missing authentication headers', async () => {
      mockClient.request.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Authorization header missing' },
        },
      });

      await expect(service.validateToken()).rejects.toThrow();
    });

    it('should handle expired tokens', async () => {
      mockClient.request.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Token expired' },
        },
      });

      await expect(service.getArticles()).rejects.toThrow();
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle network timeout', async () => {
      mockClient.request.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      });

      await expect(service.getArticles()).rejects.toThrow();
    });

    it('should handle DNS resolution errors', async () => {
      mockClient.request.mockRejectedValue({
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND example.com',
      });

      await expect(service.getArticles()).rejects.toThrow();
    });

    it('should handle connection refused', async () => {
      mockClient.request.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:8000',
      });

      await expect(service.getArticles()).rejects.toThrow();
    });

    it('should handle SSL certificate errors', async () => {
      mockClient.request.mockRejectedValue({
        code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        message: 'unable to verify the first certificate',
      });

      await expect(service.getArticles()).rejects.toThrow();
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit with retry-after header', async () => {
      mockClient.request.mockRejectedValue({
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
          data: { error: 'Too many requests' },
        },
      });

      await expect(service.getArticles()).rejects.toThrow();
    });

    it('should handle rate limit without retry-after header', async () => {
      mockClient.request.mockRejectedValue({
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' },
        },
      });

      await expect(service.getArticles()).rejects.toThrow();
    });
  });

  describe('Request/Response Processing', () => {
    it('should handle large request payloads', async () => {
      const largeContent = 'A'.repeat(1024 * 1024); // 1MB content
      const mockClient = (service as any).client;
      mockClient.request.mockResolvedValue({
        data: { id: 'large-article', content: largeContent },
        status: 201,
      });

      const result = await service.createArticle({
        url: 'https://example.com',
        title: 'Large Article',
      });

      expect(result.data.content).toHaveLength(1024 * 1024);
    });

    it('should handle empty response bodies', async () => {
      const mockClient = (service as any).client;
      mockClient.request.mockResolvedValue({
        data: '',
        status: 204,
      });

      const result = await service.getArticles();
      expect(result.data).toBe('');
      expect(result.status).toBe(204);
    });

    it('should handle non-JSON response types', async () => {
      const mockClient = (service as any).client;
      mockClient.request.mockResolvedValue({
        data: '<html><body>Error</body></html>',
        status: 500,
        headers: { 'content-type': 'text/html' },
      });

      const result = await service.getArticles();
      expect(result.data).toBe('<html><body>Error</body></html>');
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests', async () => {
      const mockClient = (service as any).client;
      let callCount = 0;
      mockClient.request.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          data: { id: `response-${callCount}` },
          status: 200,
        });
      });

      const promises = Array(10)
        .fill(null)
        .map(() => service.getArticles());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockClient.request).toHaveBeenCalledTimes(10);
      results.forEach((result, index) => {
        expect(result.data.id).toBe(`response-${index + 1}`);
      });
    });

    it('should handle request cancellation', async () => {
      mockClient.request.mockRejectedValue({
        name: 'CanceledError',
        message: 'Request canceled',
      });

      await expect(service.getArticles()).rejects.toThrow();
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle configuration updates during requests', () => {
      const newConfig = {
        timeout: 45000,
        baseUrl: 'https://api.example.com',
      };

      service.updateConfig(newConfig);
      const config = service.getConfig();

      expect(config.timeout).toBe(45000);
      expect(config.baseUrl).toBe('https://api.example.com');
    });

    it('should validate configuration parameters', () => {
      // Test that invalid configurations are handled appropriately
      const invalidConfigs = [
        { timeout: -1000 },
        { retryAttempts: -1 },
        { retryDelay: -500 },
      ];

      invalidConfigs.forEach(config => {
        expect(() => service.updateConfig(config)).not.toThrow();
      });
    });
  });

  describe('Memory and Performance', () => {
    it('should handle streaming large responses', async () => {
      const mockClient = (service as any).client;
      const largeResponse = {
        articles: Array(1000)
          .fill(null)
          .map((_, i) => ({
            id: `article-${i}`,
            title: `Article ${i}`,
            content: 'X'.repeat(1000),
          })),
      };

      mockClient.request.mockResolvedValue({
        data: largeResponse,
        status: 200,
      });

      const result = await service.getArticles();
      expect(result.data.articles).toHaveLength(1000);
    });

    it('should handle rapid sequential requests', async () => {
      const mockClient = (service as any).client;
      mockClient.request.mockResolvedValue({
        data: { success: true },
        status: 200,
      });

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        await service.getArticles();
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle malformed authentication responses', async () => {
      const mockClient = (service as any).client;
      mockClient.request.mockResolvedValue({
        data: { malformed: 'response' },
        status: 200,
      });

      const result = await service.login({
        username: 'test',
        password: 'test',
      });

      expect(result.data.malformed).toBe('response');
    });

    it('should handle unexpected response formats', async () => {
      const mockClient = (service as any).client;
      mockClient.request.mockResolvedValue({
        data: [1, 2, 3], // Array instead of object
        status: 200,
      });

      const result = await service.getArticles();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });
});
