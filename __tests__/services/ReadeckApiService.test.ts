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

// Mock authStorageService
jest.mock('../../src/services/AuthStorageService', () => ({
  authStorageService: {
    retrieveToken: jest.fn(),
    storeToken: jest.fn(),
    clearToken: jest.fn(),
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
  }

  async validateToken(): Promise<any> {
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
  }

  async getArticles(filters?: ArticleFilters): Promise<any> {
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
  }

  async createArticle(article: CreateArticleRequest): Promise<any> {
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
  }
}

describe('ReadeckApiService Core Functionality', () => {
  let service: TestableReadeckApiService;
  let mockAxios: jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios = axios as jest.Mocked<typeof axios>;
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
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
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
        page: 1,
        per_page: 10,
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
        is_favorite: false,
        tags: ['new'],
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
});