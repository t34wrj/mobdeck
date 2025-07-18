/**
 * Strategic Mock Framework for Mobdeck
 * Focuses ONLY on external dependencies (APIs, storage, network)
 * Keeps business logic real and testable
 */

// External Dependency Mocks
export const mockAsyncStorage = {
  getItem: jest.fn((_key: string) => Promise.resolve(null as string | null)),
  setItem: jest.fn((_key: string, _value: string) =>
    Promise.resolve(undefined)
  ),
  removeItem: jest.fn((_key: string) => Promise.resolve(undefined)),
  clear: jest.fn(() => Promise.resolve(undefined)),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn((_keys: string[]) => Promise.resolve([])),
  multiSet: jest.fn((_keyValuePairs: [string, string][]) =>
    Promise.resolve(undefined)
  ),
  multiRemove: jest.fn((_keys: string[]) => Promise.resolve(undefined)),
};

export const mockKeychain = {
  setInternetCredentials: jest.fn(() => Promise.resolve()),
  getInternetCredentials: jest.fn(() =>
    Promise.resolve({ username: 'test', password: 'token' })
  ),
  resetInternetCredentials: jest.fn(() => Promise.resolve()),
  canImplyAuthentication: jest.fn(() => Promise.resolve(true)),
};

export const mockSQLite = {
  openDatabase: jest.fn(() => ({
    transaction: jest.fn(callback => {
      const tx = {
        executeSql: jest.fn((sql, params, success) => {
          if (success) success([], { rows: { _array: [] } });
        }),
      };
      callback(tx);
    }),
    close: jest.fn(),
  })),
  enablePromise: jest.fn(),
};

export const mockNetInfo = {
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
    })
  ),
};

export const mockAxios: any = {
  get: jest.fn(() => Promise.resolve({ data: [], status: 200 })),
  post: jest.fn(() => Promise.resolve({ data: {}, status: 201 })),
  put: jest.fn(() => Promise.resolve({ data: {}, status: 200 })),
  delete: jest.fn(() => Promise.resolve({ status: 204 })),
  create: jest.fn((): any => mockAxios),
  defaults: { headers: { common: {} } },
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  },
};

// Navigation Mocks (UI boundary)
export const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  isFocused: jest.fn(() => true),
  addListener: jest.fn(),
  removeListener: jest.fn(),
};

export const mockRoute = {
  params: {},
  key: 'test-route',
  name: 'test-route',
};

// Background Actions (System boundary)
export const mockBackgroundActions = {
  start: jest.fn(() => Promise.resolve()),
  stop: jest.fn(() => Promise.resolve()),
  updateNotification: jest.fn(() => Promise.resolve()),
  isRunning: jest.fn(() => false),
  on: jest.fn(),
};

// Test Data Factories
export const createMockArticle = (overrides = {}) => ({
  id: 'test-article-1',
  title: 'Test Article',
  url: 'https://example.com/article',
  content: 'Test content',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockApiResponse = (data: any, status = 200) => ({
  data,
  status,
  headers: {},
  config: {},
  statusText: 'OK',
});

// Reset all mocks
export const resetAllMocks = () => {
  jest.clearAllMocks();
  Object.values(mockAsyncStorage).forEach(
    fn => typeof fn === 'function' && (fn as jest.Mock).mockClear?.()
  );
  Object.values(mockKeychain).forEach(
    fn => typeof fn === 'function' && (fn as jest.Mock).mockClear?.()
  );
  Object.values(mockAxios).forEach(
    fn => typeof fn === 'function' && (fn as jest.Mock).mockClear?.()
  );
  (mockNavigation.navigate as jest.Mock).mockClear();
  (mockNavigation.goBack as jest.Mock).mockClear();
};
